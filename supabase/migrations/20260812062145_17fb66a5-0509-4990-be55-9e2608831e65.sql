-- 1) Poker tournaments UPDATE hardening
DROP POLICY IF EXISTS "Allow update poker_tournaments for all authenticated users" ON public.poker_tournaments;
DROP POLICY IF EXISTS poker_tournaments_update_seated ON public.poker_tournaments;

CREATE POLICY poker_tournaments_update_participants
ON public.poker_tournaments FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.poker_seats s
    WHERE s.tournament_id = poker_tournaments.id AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.poker_seats s
    WHERE s.tournament_id = poker_tournaments.id AND s.user_id = auth.uid()
  )
);

CREATE OR REPLACE FUNCTION public.guard_poker_tournaments_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.buy_in IS DISTINCT FROM OLD.buy_in
     OR NEW.starting_chips IS DISTINCT FROM OLD.starting_chips
     OR NEW.max_players IS DISTINCT FROM OLD.max_players
     OR NEW.name IS DISTINCT FROM OLD.name THEN
    RAISE EXCEPTION 'immutable_tournament_settings';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_poker_tournaments_update ON public.poker_tournaments;
CREATE TRIGGER guard_poker_tournaments_update
BEFORE UPDATE ON public.poker_tournaments
FOR EACH ROW EXECUTE FUNCTION public.guard_poker_tournaments_update();

REVOKE ALL ON FUNCTION public.guard_poker_tournaments_update() FROM PUBLIC, anon, authenticated;

-- 2) Revoke EXECUTE on SECURITY DEFINER functions from anonymous callers
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f.sig);
  END LOOP;
END $$;

-- 3) Internal-only functions: also revoke from signed-in users
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND (p.prorettype = 'trigger'::regtype
           OR p.proname IN ('notify_win','write_audit','settle_match','advance_bracket_from',
                            'generate_tournament_notifications','handle_new_user'))
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', f.sig);
  END LOOP;
END $$;

-- 4) ELO recalculation is an admin-only operation
CREATE OR REPLACE FUNCTION public.sync_match_elo(_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m record;
  winner text;
  sets_a int;
  sets_b int;
  ids_a uuid[];
  ids_b uuid[];
  avg_a numeric;
  avg_b numeric;
  exp_a numeric;
  delta int;
  u uuid;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  SELECT * INTO m FROM public.matches WHERE id = _match_id;
  IF m.id IS NULL OR m.ended_at IS NULL OR m.confirmed_at IS NULL THEN RETURN; END IF;

  IF m.score_a > m.score_b THEN winner := 'a';
  ELSIF m.score_b > m.score_a THEN winner := 'b';
  ELSE
    SELECT COUNT(*) INTO sets_a FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'a')::int > (s->>'b')::int;
    SELECT COUNT(*) INTO sets_b FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'b')::int > (s->>'a')::int;
    IF sets_a > sets_b THEN winner := 'a';
    ELSIF sets_b > sets_a THEN winner := 'b';
    ELSE RETURN; END IF;
  END IF;

  SELECT COALESCE(array_agg(p.id), ARRAY[]::uuid[]) INTO ids_a FROM public.profiles p
    WHERE lower(p.nickname) = ANY (SELECT lower(trim(x)) FROM regexp_split_to_table(m.team_a, '[,&/+]') x);
  SELECT COALESCE(array_agg(p.id), ARRAY[]::uuid[]) INTO ids_b FROM public.profiles p
    WHERE lower(p.nickname) = ANY (SELECT lower(trim(x)) FROM regexp_split_to_table(m.team_b, '[,&/+]') x);

  IF array_length(ids_a,1) IS NULL OR array_length(ids_b,1) IS NULL THEN RETURN; END IF;

  SELECT AVG(elo) INTO avg_a FROM public.profiles WHERE id = ANY(ids_a);
  SELECT AVG(elo) INTO avg_b FROM public.profiles WHERE id = ANY(ids_b);
  exp_a := 1.0 / (1.0 + power(10.0, (avg_b - avg_a) / 400.0));

  IF winner = 'a' THEN delta := GREATEST(5, ROUND(32 * (1 - exp_a))::int);
  ELSE delta := GREATEST(5, ROUND(32 * exp_a)::int);
  END IF;

  IF winner = 'a' THEN
    UPDATE public.profiles SET elo = elo + delta WHERE id = ANY(ids_a);
    UPDATE public.profiles SET elo = GREATEST(100, elo - delta) WHERE id = ANY(ids_b);
    FOREACH u IN ARRAY ids_a LOOP
      PERFORM public.notify_win(u, 'match_win',
        '🏆 Výhra: ' || m.team_a || ' vs ' || m.team_b,
        to_char(COALESCE(m.ended_at, now()) AT TIME ZONE 'Europe/Prague', 'DD.MM.YYYY HH24:MI') ||
        ' • ' || m.score_a || ':' || m.score_b || ' • +' || delta || ' ELO');
    END LOOP;
  ELSE
    UPDATE public.profiles SET elo = elo + delta WHERE id = ANY(ids_b);
    UPDATE public.profiles SET elo = GREATEST(100, elo - delta) WHERE id = ANY(ids_a);
    FOREACH u IN ARRAY ids_b LOOP
      PERFORM public.notify_win(u, 'match_win',
        '🏆 Výhra: ' || m.team_b || ' vs ' || m.team_a,
        to_char(COALESCE(m.ended_at, now()) AT TIME ZONE 'Europe/Prague', 'DD.MM.YYYY HH24:MI') ||
        ' • ' || m.score_b || ':' || m.score_a || ' • +' || delta || ' ELO');
    END LOOP;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.sync_match_elo(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_match_elo(uuid) TO authenticated;