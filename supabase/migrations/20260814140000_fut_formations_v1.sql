-- FUT formations v1: make formation a real server-authoritative roster contract.
-- Supported formations: 4-3-3 (legacy), 4-4-2, 4-2-3-1.

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
    squad public.fc_squads;
    player jsonb;
    role text;
    slot_key text;
    expected_position text;
    new_version integer;
    starter_count integer := 0;
    bench_count integer := 0;
    reserve_count integer := 0;
    player_count integer := 0;
    captain_count integer := 0;
    starter_captain_count integer := 0;
    missing_slot_count integer := 0;
    card_exists boolean;
    duplicate_card boolean;
    duplicate_slot boolean;
    new_squad jsonb;
BEGIN
    IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

    SELECT * INTO squad
      FROM public.fc_squads
     WHERE id = _squad_id AND user_id = uid
     FOR UPDATE;
    IF squad.id IS NULL THEN RAISE EXCEPTION 'squad_not_found'; END IF;
    IF _expected_version IS NULL THEN RAISE EXCEPTION 'version_required'; END IF;
    IF squad.version <> _expected_version THEN RAISE EXCEPTION 'squad_version_conflict'; END IF;
    IF length(trim(coalesce(_name, ''))) < 1 OR length(trim(_name)) > 40 THEN RAISE EXCEPTION 'invalid_squad_name'; END IF;
    IF trim(coalesce(_formation, '')) NOT IN ('4-3-3','4-4-2','4-2-3-1') THEN RAISE EXCEPTION 'unsupported_formation'; END IF;
    IF jsonb_typeof(_players) <> 'array' THEN RAISE EXCEPTION 'players_must_be_array'; END IF;

    player_count := jsonb_array_length(_players);
    IF player_count > 23 THEN RAISE EXCEPTION 'squad_too_large'; END IF;

    FOR player IN SELECT value FROM jsonb_array_elements(_players)
    LOOP
        role := upper(trim(coalesce(player->>'squad_role', 'STARTER')));
        slot_key := upper(trim(coalesce(player->>'slot_key', '')));

        IF player->>'user_card_id' IS NULL THEN RAISE EXCEPTION 'player_user_card_id_required'; END IF;
        IF slot_key = '' THEN RAISE EXCEPTION 'player_slot_required'; END IF;
        IF role NOT IN ('STARTER','BENCH','RESERVE') THEN RAISE EXCEPTION 'invalid_squad_role'; END IF;

        IF role = 'BENCH' THEN
            IF slot_key !~ '^BENCH[1-7]$' THEN RAISE EXCEPTION 'invalid_bench_slot'; END IF;
        ELSIF role = 'RESERVE' THEN
            IF slot_key !~ '^RESERVE[1-5]$' THEN RAISE EXCEPTION 'invalid_reserve_slot'; END IF;
        ELSE
            IF _formation = '4-3-3' AND slot_key NOT IN ('GK','LB','CB1','CB2','RB','CM1','CM2','CAM','LW','ST','RW') THEN RAISE EXCEPTION 'invalid_starting_slot'; END IF;
            IF _formation = '4-4-2' AND slot_key NOT IN ('GK','LB','CB1','CB2','RB','LM','CM1','CM2','RM','ST1','ST2') THEN RAISE EXCEPTION 'invalid_starting_slot'; END IF;
            IF _formation = '4-2-3-1' AND slot_key NOT IN ('GK','LB','CB1','CB2','RB','CDM1','CDM2','LW','CAM','RW','ST') THEN RAISE EXCEPTION 'invalid_starting_slot'; END IF;

            expected_position := CASE slot_key
                WHEN 'GK' THEN 'GK'
                WHEN 'LB' THEN 'LB'
                WHEN 'CB1' THEN 'CB'
                WHEN 'CB2' THEN 'CB'
                WHEN 'RB' THEN 'RB'
                WHEN 'CM1' THEN 'CM'
                WHEN 'CM2' THEN 'CM'
                WHEN 'CAM' THEN 'CAM'
                WHEN 'LM' THEN 'LM'
                WHEN 'RM' THEN 'RM'
                WHEN 'CDM1' THEN 'CDM'
                WHEN 'CDM2' THEN 'CDM'
                WHEN 'LW' THEN 'LW'
                WHEN 'RW' THEN 'RW'
                WHEN 'ST' THEN 'ST'
                WHEN 'ST1' THEN 'ST'
                WHEN 'ST2' THEN 'ST'
                ELSE NULL
            END;
            IF expected_position IS NULL THEN RAISE EXCEPTION 'invalid_starting_slot'; END IF;

            IF NOT EXISTS (
                SELECT 1
                  FROM public.fc_user_cards uc
                  JOIN public.fc_cards c ON c.id = uc.card_id
                 WHERE uc.id = (player->>'user_card_id')::uuid
                   AND uc.user_id = uid
                   AND (upper(c.position) = expected_position OR expected_position = ANY (SELECT upper(x) FROM unnest(coalesce(c.alt_positions,'{}'::text[])) x))
            ) THEN
                RAISE EXCEPTION 'invalid_player_position';
            END IF;
        END IF;

        SELECT EXISTS (
            SELECT 1 FROM public.fc_user_cards uc
             WHERE uc.id = (player->>'user_card_id')::uuid AND uc.user_id = uid
        ) INTO card_exists;
        IF NOT card_exists THEN RAISE EXCEPTION 'card_not_owned'; END IF;

        IF coalesce((player->>'is_captain')::boolean, false) THEN
            captain_count := captain_count + 1;
            IF role = 'STARTER' THEN starter_captain_count := starter_captain_count + 1; END IF;
        END IF;

        IF role = 'STARTER' THEN starter_count := starter_count + 1;
        ELSIF role = 'BENCH' THEN bench_count := bench_count + 1;
        ELSE reserve_count := reserve_count + 1;
        END IF;
    END LOOP;

    IF starter_count <> 11 THEN RAISE EXCEPTION 'invalid_starting_xi'; END IF;
    IF bench_count > 7 THEN RAISE EXCEPTION 'too_many_bench_players'; END IF;
    IF reserve_count > 5 THEN RAISE EXCEPTION 'too_many_reserves'; END IF;
    IF captain_count <> 1 OR starter_captain_count <> 1 THEN RAISE EXCEPTION 'invalid_captain'; END IF;

    SELECT count(*) INTO missing_slot_count
      FROM unnest(CASE _formation
        WHEN '4-3-3' THEN ARRAY['GK','LB','CB1','CB2','RB','CM1','CM2','CAM','LW','ST','RW']
        WHEN '4-4-2' THEN ARRAY['GK','LB','CB1','CB2','RB','LM','CM1','CM2','RM','ST1','ST2']
        ELSE ARRAY['GK','LB','CB1','CB2','RB','CDM1','CDM2','LW','CAM','RW','ST']
      END) required(slot_key)
     WHERE NOT EXISTS (
       SELECT 1 FROM jsonb_array_elements(_players) p
        WHERE upper(coalesce(p->>'squad_role','STARTER')) = 'STARTER'
          AND upper(trim(p->>'slot_key')) = required.slot_key
     );
    IF missing_slot_count > 0 THEN RAISE EXCEPTION 'missing_starting_slot'; END IF;

    SELECT EXISTS (
      SELECT 1 FROM (
        SELECT (value->>'user_card_id')::uuid user_card_id
          FROM jsonb_array_elements(_players) GROUP BY 1 HAVING count(*) > 1
      ) d
    ) INTO duplicate_card;
    IF duplicate_card THEN RAISE EXCEPTION 'duplicate_card'; END IF;

    SELECT EXISTS (
      SELECT 1 FROM (
        SELECT upper(trim(value->>'slot_key')) slot_key
          FROM jsonb_array_elements(_players)
         WHERE upper(coalesce(value->>'squad_role','STARTER')) = 'STARTER'
         GROUP BY 1 HAVING count(*) > 1
      ) d
    ) INTO duplicate_slot;
    IF duplicate_slot THEN RAISE EXCEPTION 'duplicate_starting_slot'; END IF;

    SELECT EXISTS (
      SELECT 1 FROM (
        SELECT upper(trim(value->>'slot_key')) slot_key
          FROM jsonb_array_elements(_players)
         WHERE upper(coalesce(value->>'squad_role','STARTER')) IN ('BENCH','RESERVE')
         GROUP BY 1 HAVING count(*) > 1
      ) d
    ) INTO duplicate_slot;
    IF duplicate_slot THEN RAISE EXCEPTION 'duplicate_roster_slot'; END IF;

    DELETE FROM public.fc_squad_players WHERE squad_id = _squad_id;
    INSERT INTO public.fc_squad_players (squad_id,user_card_id,slot_key,position,squad_role,is_captain)
    SELECT _squad_id,
           (value->>'user_card_id')::uuid,
           upper(trim(value->>'slot_key')),
           upper(trim(value->>'position')),
           upper(trim(coalesce(value->>'squad_role','STARTER'))),
           coalesce((value->>'is_captain')::boolean,false)
      FROM jsonb_array_elements(_players);

    new_version := squad.version + 1;
    UPDATE public.fc_squads
       SET name = trim(_name), formation = trim(_formation), version = new_version, updated_at = now()
     WHERE id = _squad_id;

    SELECT public.fc_squad_get(_squad_id) INTO new_squad;
    RETURN new_squad;
END;
$$;

CREATE OR REPLACE FUNCTION public.fc_squad_match_readiness(_squad_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  squad public.fc_squads;
  starter_count integer;
  captain_count integer;
  bench_count integer;
  reserve_count integer;
  invalid_role_count integer;
  invalid_slot_count integer;
  duplicate_card_count integer;
  duplicate_slot_count integer;
  missing_slot_count integer;
  required_slots text[];
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO squad FROM public.fc_squads WHERE id=_squad_id AND user_id=uid AND is_active=true;
  IF squad.id IS NULL THEN RAISE EXCEPTION 'squad_not_found'; END IF;

  required_slots := CASE squad.formation
    WHEN '4-3-3' THEN ARRAY['GK','LB','CB1','CB2','RB','CM1','CM2','CAM','LW','ST','RW']
    WHEN '4-4-2' THEN ARRAY['GK','LB','CB1','CB2','RB','LM','CM1','CM2','RM','ST1','ST2']
    WHEN '4-2-3-1' THEN ARRAY['GK','LB','CB1','CB2','RB','CDM1','CDM2','LW','CAM','RW','ST']
    ELSE ARRAY[]::text[]
  END;

  SELECT count(*) FILTER (WHERE squad_role='STARTER'), count(*) FILTER (WHERE squad_role='BENCH'), count(*) FILTER (WHERE squad_role='RESERVE'), count(*) FILTER (WHERE is_captain=true)
    INTO starter_count, bench_count, reserve_count, captain_count
    FROM public.fc_squad_players WHERE squad_id=_squad_id;

  SELECT count(*) INTO invalid_role_count FROM public.fc_squad_players WHERE squad_id=_squad_id AND squad_role NOT IN ('STARTER','BENCH','RESERVE');
  SELECT count(*) INTO invalid_slot_count
    FROM public.fc_squad_players
   WHERE squad_id=_squad_id AND (
     (squad_role='BENCH' AND slot_key !~ '^BENCH[1-7]$') OR
     (squad_role='RESERVE' AND slot_key !~ '^RESERVE[1-5]$') OR
     (squad_role='STARTER' AND NOT (slot_key = ANY(required_slots)))
   );
  SELECT count(*) INTO missing_slot_count FROM unnest(required_slots) req(slot_key)
   WHERE NOT EXISTS (SELECT 1 FROM public.fc_squad_players sp WHERE sp.squad_id=_squad_id AND sp.squad_role='STARTER' AND sp.slot_key=req.slot_key);
  SELECT count(*) INTO duplicate_slot_count FROM (SELECT slot_key FROM public.fc_squad_players WHERE squad_id=_squad_id AND squad_role='STARTER' GROUP BY slot_key HAVING count(*)>1) d;
  SELECT count(*) INTO duplicate_card_count FROM (SELECT user_card_id FROM public.fc_squad_players WHERE squad_id=_squad_id GROUP BY user_card_id HAVING count(*)>1) d;

  RETURN jsonb_build_object(
    'ready', (squad.formation IN ('4-3-3','4-4-2','4-2-3-1') AND starter_count=11 AND bench_count<=7 AND reserve_count<=5 AND captain_count=1 AND invalid_role_count=0 AND invalid_slot_count=0 AND missing_slot_count=0 AND duplicate_slot_count=0 AND duplicate_card_count=0),
    'squad_id', squad.id,
    'formation', squad.formation,
    'starting_xi', starter_count,
    'bench', bench_count,
    'reserves', reserve_count,
    'captain_count', captain_count,
    'invalid_role_count', invalid_role_count,
    'invalid_slot_count', invalid_slot_count,
    'missing_slot_count', missing_slot_count,
    'duplicate_slot_count', duplicate_slot_count,
    'duplicate_card_count', duplicate_card_count,
    'version', squad.version
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.fc_match_simulate(_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  m public.fc_matches;
  metrics jsonb;
  formation text;
  team_ovr integer;
  chemistry integer;
  captain_bonus integer := 0;
  attack_rating numeric := 0;
  defense_rating numeric := 0;
  midfield_rating numeric := 0;
  normalized_team numeric;
  normalized_opp numeric;
  attack_chance numeric;
  defense_chance numeric;
  seed_val double precision;
  user_goals integer;
  opp_goals integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO m FROM public.fc_matches WHERE id=_match_id AND user_id=uid FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF m.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION 'match_not_in_progress'; END IF;

  SELECT formation INTO formation FROM public.fc_squads WHERE id=m.squad_id;
  metrics := public.fc_squad_metrics(m.squad_id);
  team_ovr := COALESCE((metrics->>'team_ovr')::integer,0);
  chemistry := COALESCE((metrics->>'chemistry')::integer,0);
  IF COALESCE((metrics->>'starting_xi')::integer,0) <> 11 THEN RAISE EXCEPTION 'squad_not_ready'; END IF;

  SELECT
    COALESCE(avg(CASE
      WHEN (formation='4-3-3' AND sp.slot_key IN ('LW','ST','RW')) OR
           (formation='4-4-2' AND sp.slot_key IN ('ST1','ST2')) OR
           (formation='4-2-3-1' AND sp.slot_key='ST') THEN c.rating END),0),
    COALESCE(avg(CASE
      WHEN (formation='4-3-3' AND sp.slot_key IN ('CM1','CM2','CAM')) OR
           (formation='4-4-2' AND sp.slot_key IN ('LM','CM1','CM2','RM')) OR
           (formation='4-2-3-1' AND sp.slot_key IN ('CDM1','CDM2','LW','CAM','RW')) THEN c.rating END),0),
    COALESCE(avg(CASE WHEN sp.slot_key IN ('GK','LB','CB1','CB2','RB') THEN c.rating END),0)
  INTO attack_rating, midfield_rating, defense_rating
  FROM public.fc_squad_players sp
  JOIN public.fc_user_cards uc ON uc.id=sp.user_card_id
  JOIN public.fc_cards c ON c.id=uc.card_id
  WHERE sp.squad_id=m.squad_id AND sp.squad_role='STARTER';

  SELECT CASE WHEN EXISTS (SELECT 1 FROM public.fc_squad_players WHERE squad_id=m.squad_id AND squad_role='STARTER' AND is_captain=true) THEN 2 ELSE 0 END INTO captain_bonus;
  normalized_team := LEAST(99,GREATEST(1,team_ovr+chemistry*0.20+captain_bonus));
  normalized_opp := m.opponent_ovr;
  attack_chance := LEAST(0.92,GREATEST(0.08,0.18+(attack_rating-normalized_opp)/125.0+(midfield_rating-normalized_opp)/250.0));
  defense_chance := LEAST(0.88,GREATEST(0.12,0.16+(defense_rating-normalized_opp)/145.0+chemistry/500.0));
  seed_val := ('x'||substr(md5(m.id::text),1,12))::bit(48)::bigint/281474976710656.0;
  user_goals := LEAST(8,GREATEST(0,floor(attack_chance*3.2+seed_val*2.0)::integer));
  opp_goals := LEAST(8,GREATEST(0,floor((1.10-defense_chance)*4.0+(1.0-seed_val)*1.8+GREATEST(0,normalized_opp-normalized_team)/35.0)::integer));
  IF normalized_team >= normalized_opp+12 AND user_goals<=opp_goals THEN user_goals := LEAST(8,opp_goals+1); END IF;

  UPDATE public.fc_matches SET user_score=user_goals, opponent_score=opp_goals, updated_at=now() WHERE id=m.id;
  RETURN public.fc_match_get(m.id) || jsonb_build_object(
    'team_ovr',team_ovr,'chemistry',chemistry,'captain_bonus',captain_bonus,
    'attack_rating',round(attack_rating)::integer,'midfield_rating',round(midfield_rating)::integer,
    'defense_rating',round(defense_rating)::integer,'formation',formation,'simulation_engine','v3'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fc_squad_save(uuid,integer,text,text,jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fc_squad_save(uuid,integer,text,text,jsonb) TO authenticated;
REVOKE ALL ON FUNCTION public.fc_squad_match_readiness(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fc_squad_match_readiness(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.fc_match_simulate(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.fc_match_simulate(uuid) TO authenticated;
