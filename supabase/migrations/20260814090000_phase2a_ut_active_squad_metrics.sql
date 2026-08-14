-- FUT Phase 2A runtime bridge: expose the existing authoritative squad system
-- to the current Ultimate Team frontend without creating a second squad model.

CREATE OR REPLACE FUNCTION public.fc_squad_get_active()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  squad_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT id INTO squad_id
  FROM public.fc_squads
  WHERE user_id = uid
    AND is_active = true
  LIMIT 1;

  IF squad_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN public.fc_squad_get(squad_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.fc_squad_metrics(_squad_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  starter_count integer;
  starter_ovr integer := 0;
  chemistry integer := 0;
  nation_score numeric := 0;
  club_score numeric := 0;
  league_score numeric := 0;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.fc_squads
    WHERE id = _squad_id AND user_id = uid
  ) THEN
    RAISE EXCEPTION 'squad_not_found';
  END IF;

  SELECT count(*), COALESCE(round(avg(c.rating)), 0)::integer
  INTO starter_count, starter_ovr
  FROM public.fc_squad_players sp
  JOIN public.fc_user_cards uc ON uc.id = sp.user_card_id
  JOIN public.fc_cards c ON c.id = uc.card_id
  WHERE sp.squad_id = _squad_id
    AND sp.squad_role = 'STARTER';

  IF starter_count < 2 THEN
    RETURN jsonb_build_object(
      'squad_id', _squad_id,
      'starting_xi', starter_count,
      'team_ovr', starter_ovr,
      'chemistry', 0
    );
  END IF;

  SELECT COALESCE(sum(
    LEAST(3, GREATEST(0, nation_count - 1))
  ), 0)
  INTO nation_score
  FROM (
    SELECT c.id,
           count(*) OVER (PARTITION BY c.nation) AS nation_count
    FROM public.fc_squad_players sp
    JOIN public.fc_user_cards uc ON uc.id = sp.user_card_id
    JOIN public.fc_cards c ON c.id = uc.card_id
    WHERE sp.squad_id = _squad_id AND sp.squad_role = 'STARTER'
  ) q;

  SELECT COALESCE(sum(
    LEAST(3, GREATEST(0, club_count - 1))
  ), 0)
  INTO club_score
  FROM (
    SELECT c.id,
           count(*) OVER (PARTITION BY c.club) AS club_count
    FROM public.fc_squad_players sp
    JOIN public.fc_user_cards uc ON uc.id = sp.user_card_id
    JOIN public.fc_cards c ON c.id = uc.card_id
    WHERE sp.squad_id = _squad_id AND sp.squad_role = 'STARTER'
  ) q;

  SELECT COALESCE(sum(
    LEAST(3, GREATEST(0, league_count - 1))
  ), 0)
  INTO league_score
  FROM (
    SELECT c.id,
           count(*) OVER (PARTITION BY c.league) AS league_count
    FROM public.fc_squad_players sp
    JOIN public.fc_user_cards uc ON uc.id = sp.user_card_id
    JOIN public.fc_cards c ON c.id = uc.card_id
    WHERE sp.squad_id = _squad_id AND sp.squad_role = 'STARTER'
  ) q;

  chemistry := LEAST(33, round((nation_score + club_score + league_score) / 2)::integer);

  RETURN jsonb_build_object(
    'squad_id', _squad_id,
    'starting_xi', starter_count,
    'team_ovr', starter_ovr,
    'chemistry', chemistry
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fc_squad_get_active() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fc_squad_metrics(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_squad_get_active() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fc_squad_metrics(uuid) TO authenticated;
