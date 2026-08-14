-- Reconcile the deployed FUT squad schema with the current client RPC contract.
-- Existing fc_squads uses user_id as its primary key; we preserve that model and
-- add the fields required by the newer authoritative squad client.

ALTER TABLE public.fc_squads
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS name text NOT NULL DEFAULT 'Main Squad',
  ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

UPDATE public.fc_squads
SET id = COALESCE(id, gen_random_uuid()),
    name = COALESCE(NULLIF(trim(name), ''), 'Main Squad'),
    version = GREATEST(COALESCE(version, 1), 1),
    is_active = true;

ALTER TABLE public.fc_squads
  ALTER COLUMN id SET NOT NULL,
  ALTER COLUMN version SET DEFAULT 1,
  ALTER COLUMN version SET NOT NULL,
  ALTER COLUMN is_active SET DEFAULT true,
  ALTER COLUMN is_active SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS fc_squads_id_unique ON public.fc_squads(id);

CREATE OR REPLACE FUNCTION public.fc_squad_get_active()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  squad public.fc_squads%ROWTYPE;
  players jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO squad
  FROM public.fc_squads
  WHERE user_id = uid AND is_active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'user_card_id', sp.user_card_id,
    'slot_key', sp.slot_key,
    'position', sp.position,
    'squad_role', sp.squad_role,
    'is_captain', sp.is_captain
    ) ORDER BY sp.created_at), '[]'::jsonb)
  INTO players
  FROM public.fc_squad_players sp
  WHERE sp.squad_user_id = uid;

  RETURN jsonb_build_object(
    'id', squad.id,
    'name', squad.name,
    'formation', squad.formation,
    'version', squad.version,
    'players', players
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fc_squad_get_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_squad_get_active() TO authenticated;

CREATE OR REPLACE FUNCTION public.fc_squad_create(_name text DEFAULT 'Main Squad', _formation text DEFAULT '4-3-3')
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  squad public.fc_squads%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF COALESCE(_formation, '4-3-3') NOT IN ('4-3-3','4-4-2','4-2-3-1') THEN RAISE EXCEPTION 'unsupported_formation'; END IF;

  INSERT INTO public.fc_squads(user_id, name, formation, slots, team_ovr, chemistry, version, is_active)
  VALUES(uid, COALESCE(NULLIF(trim(_name), ''), 'Main Squad'), COALESCE(_formation, '4-3-3'), '{}'::jsonb, 0, 0, 1, true)
  ON CONFLICT (user_id) DO UPDATE SET
    is_active = true,
    name = COALESCE(NULLIF(trim(EXCLUDED.name), ''), public.fc_squads.name),
    updated_at = now()
  RETURNING * INTO squad;

  RETURN jsonb_build_object(
    'id', squad.id,
    'name', squad.name,
    'formation', squad.formation,
    'version', squad.version,
    'players', '[]'::jsonb
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fc_squad_create(text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_squad_create(text,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.fc_squad_save(
  _squad_id uuid,
  _expected_version integer,
  _name text,
  _formation text,
  _players jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  squad public.fc_squads%ROWTYPE;
  player jsonb;
  card_owner uuid;
  starter_count integer := 0;
  captain_count integer := 0;
  bench_count integer := 0;
  reserve_count integer := 0;
  new_version integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF COALESCE(_formation, '4-3-3') NOT IN ('4-3-3','4-4-2','4-2-3-1') THEN RAISE EXCEPTION 'unsupported_formation'; END IF;
  IF jsonb_typeof(COALESCE(_players, '[]'::jsonb)) <> 'array' THEN RAISE EXCEPTION 'invalid_players_payload'; END IF;

  SELECT * INTO squad
  FROM public.fc_squads
  WHERE id = _squad_id AND user_id = uid AND is_active = true
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'squad_not_found'; END IF;
  IF squad.version <> COALESCE(_expected_version, squad.version) THEN RAISE EXCEPTION 'squad_version_conflict'; END IF;

  SELECT COUNT(*) FILTER (WHERE p.squad_role = 'STARTER'),
         COUNT(*) FILTER (WHERE p.squad_role = 'BENCH'),
         COUNT(*) FILTER (WHERE p.squad_role = 'RESERVE'),
         COUNT(*) FILTER (WHERE COALESCE((p.is_captain)::boolean, false))
  INTO starter_count, bench_count, reserve_count, captain_count
  FROM jsonb_to_recordset(_players) AS p(
    user_card_id uuid,
    slot_key text,
    position text,
    squad_role text,
    is_captain boolean
  );

  IF starter_count <> 11 THEN RAISE EXCEPTION 'invalid_starting_xi'; END IF;
  IF bench_count > 7 THEN RAISE EXCEPTION 'too_many_bench_players'; END IF;
  IF reserve_count > 5 THEN RAISE EXCEPTION 'too_many_reserves'; END IF;
  IF captain_count <> 1 THEN RAISE EXCEPTION 'invalid_captain'; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(_players) AS p(user_card_id uuid, slot_key text, position text, squad_role text, is_captain boolean)
    GROUP BY p.slot_key HAVING COUNT(*) > 1
  ) THEN RAISE EXCEPTION 'duplicate_starting_slot'; END IF;

  IF EXISTS (
    SELECT 1
    FROM jsonb_to_recordset(_players) AS p(user_card_id uuid, slot_key text, position text, squad_role text, is_captain boolean)
    GROUP BY p.user_card_id HAVING COUNT(*) > 1
  ) THEN RAISE EXCEPTION 'duplicate_card'; END IF;

  FOR player IN SELECT value FROM jsonb_array_elements(_players)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.fc_user_cards uc
      WHERE uc.id = (player->>'user_card_id')::uuid AND uc.user_id = uid
    ) THEN
      RAISE EXCEPTION 'card_not_owned';
    END IF;

    IF COALESCE(player->>'squad_role','') NOT IN ('STARTER','BENCH','RESERVE') THEN
      RAISE EXCEPTION 'invalid_role';
    END IF;
  END LOOP;

  new_version := squad.version + 1;

  DELETE FROM public.fc_squad_players WHERE squad_user_id = uid;

  INSERT INTO public.fc_squad_players(squad_user_id, user_card_id, slot_key, position, squad_role, is_captain)
  SELECT uid, (p.user_card_id)::uuid, p.slot_key, p.position, p.squad_role, COALESCE(p.is_captain, false)
  FROM jsonb_to_recordset(_players) AS p(
    user_card_id text,
    slot_key text,
    position text,
    squad_role text,
    is_captain boolean
  );

  UPDATE public.fc_squads
  SET name = COALESCE(NULLIF(trim(_name), ''), name),
      formation = _formation,
      slots = COALESCE(slots, '{}'::jsonb),
      version = new_version,
      updated_at = now(),
      is_active = true
  WHERE user_id = uid;

  RETURN public.fc_squad_get_active();
END;
$$;

REVOKE ALL ON FUNCTION public.fc_squad_save(uuid,integer,text,text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_squad_save(uuid,integer,text,text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.fc_squad_metrics(_squad_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ovr integer := 0;
  chem integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fc_squads WHERE id = _squad_id AND user_id = uid AND is_active = true) THEN RAISE EXCEPTION 'squad_not_found'; END IF;

  SELECT COALESCE(ROUND(AVG(c.rating))::integer,0)
  INTO ovr
  FROM public.fc_squad_players sp
  JOIN public.fc_user_cards uc ON uc.id = sp.user_card_id AND uc.user_id = uid
  JOIN public.fc_cards c ON c.id = uc.card_id
  WHERE sp.squad_user_id = uid AND sp.squad_role = 'STARTER';

  SELECT LEAST(33, COALESCE(SUM(link_score),0))::integer INTO chem
  FROM (
    SELECT CASE WHEN COUNT(DISTINCT c.club) = 1 THEN 3 WHEN COUNT(DISTINCT c.club) <= 2 THEN 1 ELSE 0 END AS link_score
    FROM public.fc_squad_players sp
    JOIN public.fc_user_cards uc ON uc.id = sp.user_card_id AND uc.user_id = uid
    JOIN public.fc_cards c ON c.id = uc.card_id
    WHERE sp.squad_user_id = uid AND sp.squad_role = 'STARTER'
    GROUP BY c.league
  ) q;

  RETURN jsonb_build_object('starting_xi',11,'team_ovr',ovr,'chemistry',chem);
END;
$$;

REVOKE ALL ON FUNCTION public.fc_squad_metrics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_squad_metrics(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.fc_squad_match_readiness(_squad_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  formation_value text;
  version_value integer;
  starter_count integer;
  bench_count integer;
  reserve_count integer;
  captain_count integer;
  issues text[] := ARRAY[]::text[];
  supported boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT formation, version INTO formation_value, version_value FROM public.fc_squads WHERE id=_squad_id AND user_id=uid AND is_active=true;
  IF formation_value IS NULL THEN RAISE EXCEPTION 'squad_not_found'; END IF;

  supported := formation_value IN ('4-3-3','4-4-2','4-2-3-1');
  IF NOT supported THEN issues := array_append(issues,'invalid_formation'); END IF;

  SELECT COUNT(*) FILTER (WHERE squad_role='STARTER'), COUNT(*) FILTER (WHERE squad_role='BENCH'), COUNT(*) FILTER (WHERE squad_role='RESERVE'), COUNT(*) FILTER (WHERE is_captain)
  INTO starter_count, bench_count, reserve_count, captain_count
  FROM public.fc_squad_players WHERE squad_user_id=uid;

  IF starter_count <> 11 THEN issues := array_append(issues,'invalid_starting_xi'); END IF;
  IF bench_count > 7 THEN issues := array_append(issues,'invalid_bench_count'); END IF;
  IF reserve_count > 5 THEN issues := array_append(issues,'invalid_reserve_count'); END IF;
  IF captain_count <> 1 THEN issues := array_append(issues,'invalid_captain'); END IF;

  RETURN jsonb_build_object(
    'ready', COALESCE(array_length(issues,1),0)=0,
    'squad_id',_squad_id,
    'formation',formation_value,
    'starting_xi',starter_count,
    'bench',bench_count,
    'reserves',reserve_count,
    'captain_count',captain_count,
    'version',version_value,
    'issues',to_jsonb(issues)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fc_squad_match_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_squad_match_readiness(uuid) TO authenticated;
