-- ============ 1. BETTING RULES ============

CREATE OR REPLACE FUNCTION public.place_bet(_match_id uuid, _pick text, _amount numeric, _note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  nick text;
  bal numeric;
  m record;
  new_bet jsonb;
  bet_id uuid := gen_random_uuid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _pick NOT IN ('a','b') THEN RAISE EXCEPTION 'invalid_pick'; END IF;
  IF _amount IS NULL OR _amount < 1 OR _amount > 250 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  PERFORM set_config('app.bypass_match_guard', 'on', true);

  SELECT nickname, balance INTO nick, bal FROM public.profiles WHERE id = uid FOR UPDATE;
  IF nick IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  IF bal < _amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  SELECT id, ended_at, bets INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF m.ended_at IS NOT NULL THEN RAISE EXCEPTION 'match_ended'; END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(m.bets,'[]'::jsonb)) b
    WHERE b->>'userId' = uid::text
  ) THEN
    RAISE EXCEPTION 'already_bet';
  END IF;

  new_bet := jsonb_build_object(
    'id', bet_id::text,
    'userId', uid::text,
    'bettor', nick,
    'pick', _pick,
    'amount', _amount,
    'note', NULLIF(TRIM(_note), ''),
    'status', 'open',
    'createdAt', (extract(epoch from now()) * 1000)::bigint
  );

  UPDATE public.matches
    SET bets = COALESCE(bets,'[]'::jsonb) || jsonb_build_array(new_bet)
    WHERE id = _match_id;

  UPDATE public.profiles SET balance = balance - _amount WHERE id = uid;

  PERFORM public.write_audit('bet.placed', 'bet', bet_id, _match_id,
    jsonb_build_object('pick', _pick, 'amount', _amount, 'note', NULLIF(TRIM(_note),'')));

  RETURN jsonb_build_object('bet_id', bet_id, 'balance', bal - _amount);
END;
$function$;

CREATE OR REPLACE FUNCTION public.withdraw_bet(_match_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  m record;
  my_bet jsonb;
  refund numeric := 0;
  new_bets jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  PERFORM set_config('app.bypass_match_guard', 'on', true);

  SELECT id, ended_at, bets INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF m.ended_at IS NOT NULL THEN RAISE EXCEPTION 'match_ended'; END IF;

  SELECT b INTO my_bet FROM jsonb_array_elements(COALESCE(m.bets,'[]'::jsonb)) b WHERE b->>'userId' = uid::text LIMIT 1;
  IF my_bet IS NULL THEN RAISE EXCEPTION 'no_bet'; END IF;
  refund := COALESCE((my_bet->>'amount')::numeric, 0);

  SELECT COALESCE(jsonb_agg(b), '[]'::jsonb) INTO new_bets
    FROM jsonb_array_elements(m.bets) b WHERE b->>'userId' <> uid::text;

  UPDATE public.matches SET bets = new_bets WHERE id = _match_id;
  UPDATE public.profiles SET balance = balance + refund WHERE id = uid;

  PERFORM public.write_audit('bet.withdrawn', 'bet', (my_bet->>'id')::uuid, _match_id,
    jsonb_build_object('refund', refund, 'pick', my_bet->>'pick'));

  RETURN jsonb_build_object('refunded', refund);
END;
$function$;

CREATE OR REPLACE FUNCTION public.settle_match(_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m record;
  sets_a int;
  sets_b int;
  winner text;
  total_pool numeric := 0;
  winning_stake numeric := 0;
  b jsonb;
  updated_bets jsonb := '[]'::jsonb;
  payout numeric;
  status text;
  new_b jsonb;
BEGIN
  PERFORM set_config('app.bypass_match_guard', 'on', true);

  SELECT id, sport, score_a, score_b, sets, bets, ended_at INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF m.id IS NULL OR m.ended_at IS NULL THEN RETURN; END IF;
  IF COALESCE(jsonb_array_length(m.bets), 0) = 0 THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(m.bets) x WHERE x->>'status' IS NOT NULL AND x->>'status' <> 'open') THEN
    RETURN;
  END IF;

  IF m.score_a > m.score_b THEN winner := 'a';
  ELSIF m.score_b > m.score_a THEN winner := 'b';
  ELSE
    SELECT COUNT(*) INTO sets_a FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'a')::int > (s->>'b')::int;
    SELECT COUNT(*) INTO sets_b FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'b')::int > (s->>'a')::int;
    IF sets_a > sets_b THEN winner := 'a';
    ELSIF sets_b > sets_a THEN winner := 'b';
    ELSE winner := NULL; END IF;
  END IF;

  -- true tie: refund everyone
  IF winner IS NULL THEN
    FOR b IN SELECT value FROM jsonb_array_elements(m.bets) LOOP
      UPDATE public.profiles SET balance = balance + COALESCE((b->>'amount')::numeric,0)
        WHERE id::text = b->>'userId';
      new_b := b || jsonb_build_object('status','refunded','payout', COALESCE((b->>'amount')::numeric,0));
      updated_bets := updated_bets || jsonb_build_array(new_b);
    END LOOP;
    UPDATE public.matches SET bets = updated_bets WHERE id = _match_id;
    PERFORM public.write_audit('match.settled_refund', 'match', _match_id, _match_id,
      jsonb_build_object('reason','tie'));
    RETURN;
  END IF;

  SELECT COALESCE(SUM((x->>'amount')::numeric),0) INTO total_pool FROM jsonb_array_elements(m.bets) x;
  SELECT COALESCE(SUM((x->>'amount')::numeric),0) INTO winning_stake
    FROM jsonb_array_elements(m.bets) x WHERE x->>'pick' = winner;

  FOR b IN SELECT value FROM jsonb_array_elements(m.bets) LOOP
    IF b->>'pick' = winner AND winning_stake > 0 THEN
      payout := ROUND(COALESCE((b->>'amount')::numeric,0) * total_pool / winning_stake, 2);
      status := 'won';
      UPDATE public.profiles SET balance = balance + payout WHERE id::text = b->>'userId';
    ELSE
      payout := 0;
      status := 'lost';
    END IF;
    new_b := b || jsonb_build_object('status', status, 'payout', payout);
    updated_bets := updated_bets || jsonb_build_array(new_b);
  END LOOP;

  UPDATE public.matches SET bets = updated_bets WHERE id = _match_id;
  PERFORM public.write_audit('match.settled', 'match', _match_id, _match_id,
    jsonb_build_object('winner', winner, 'pool', total_pool, 'winning_stake', winning_stake));
END;
$function$;

-- settle as soon as the match ends (admin confirmation no longer required)
CREATE OR REPLACE FUNCTION public.trg_match_settle()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    PERFORM public.settle_match(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

-- ============ 2. TOURNAMENTS ============

CREATE TABLE IF NOT EXISTS public.tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sport text NOT NULL,
  format text NOT NULL CHECK (format IN ('round_robin','single_elimination')),
  status text NOT NULL DEFAULT 'active',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournaments TO authenticated;
GRANT ALL ON public.tournaments TO service_role;
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tournaments readable by authenticated" ON public.tournaments;
CREATE POLICY "tournaments readable by authenticated" ON public.tournaments
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admins insert tournaments" ON public.tournaments;
CREATE POLICY "admins insert tournaments" ON public.tournaments
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admins update tournaments" ON public.tournaments;
CREATE POLICY "admins update tournaments" ON public.tournaments
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
DROP POLICY IF EXISTS "admins delete tournaments" ON public.tournaments;
CREATE POLICY "admins delete tournaments" ON public.tournaments
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.tournament_teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.tournaments(id) ON DELETE CASCADE,
  name text NOT NULL,
  seed int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_teams TO authenticated;
GRANT ALL ON public.tournament_teams TO service_role;
ALTER TABLE public.tournament_teams ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tournament teams readable by authenticated" ON public.tournament_teams;
CREATE POLICY "tournament teams readable by authenticated" ON public.tournament_teams
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "admins manage tournament teams" ON public.tournament_teams;
CREATE POLICY "admins manage tournament teams" ON public.tournament_teams
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS round int,
  ADD COLUMN IF NOT EXISTS slot int,
  ADD COLUMN IF NOT EXISTS team_a_ref uuid,
  ADD COLUMN IF NOT EXISTS team_b_ref uuid;

CREATE INDEX IF NOT EXISTS matches_tournament_idx ON public.matches(tournament_id);

CREATE OR REPLACE FUNCTION public.create_tournament(_name text, _sport text, _format text, _teams text[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  t_id uuid;
  n int;
  size int := 1;
  rounds int;
  i int;
  j int;
  r int;
  slot_no int;
  ids uuid[] := ARRAY[]::uuid[];
  names text[] := ARRAY[]::text[];
  padded uuid[];
  padded_names text[];
  new_id uuid;
  a_ref uuid;
  b_ref uuid;
  a_name text;
  b_name text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF _format NOT IN ('round_robin','single_elimination') THEN RAISE EXCEPTION 'invalid_format'; END IF;

  SELECT array_agg(TRIM(x)) INTO names
    FROM unnest(_teams) x WHERE TRIM(COALESCE(x,'')) <> '';
  n := COALESCE(array_length(names,1), 0);
  IF n < 2 THEN RAISE EXCEPTION 'need_at_least_two_teams'; END IF;
  IF n > 32 THEN RAISE EXCEPTION 'too_many_teams'; END IF;

  INSERT INTO public.tournaments(name, sport, format, created_by)
    VALUES (COALESCE(NULLIF(TRIM(_name),''),'Turnaj'), _sport, _format, uid)
    RETURNING id INTO t_id;

  FOR i IN 1..n LOOP
    INSERT INTO public.tournament_teams(tournament_id, name, seed)
      VALUES (t_id, names[i], i) RETURNING id INTO new_id;
    ids := ids || new_id;
  END LOOP;

  IF _format = 'round_robin' THEN
    FOR i IN 1..n-1 LOOP
      FOR j IN i+1..n LOOP
        INSERT INTO public.matches(owner_id, sport, team_a, team_b, tournament_id, round, slot, team_a_ref, team_b_ref)
          VALUES (uid, _sport, names[i], names[j], t_id, 1, (i*100+j), ids[i], ids[j]);
      END LOOP;
    END LOOP;
  ELSE
    WHILE size < n LOOP size := size * 2; END LOOP;
    rounds := 0;
    i := size;
    WHILE i > 1 LOOP rounds := rounds + 1; i := i / 2; END LOOP;

    padded := ids;
    padded_names := names;
    FOR i IN n+1..size LOOP
      padded := padded || NULL::uuid;
      padded_names := padded_names || NULL::text;
    END LOOP;

    -- round 1
    slot_no := 0;
    i := 1;
    WHILE i <= size LOOP
      slot_no := slot_no + 1;
      a_ref := padded[i];
      b_ref := padded[i+1];
      a_name := COALESCE(padded_names[i], 'BYE');
      b_name := COALESCE(padded_names[i+1], 'BYE');
      INSERT INTO public.matches(owner_id, sport, team_a, team_b, tournament_id, round, slot, team_a_ref, team_b_ref, ended_at)
        VALUES (uid, _sport, a_name, b_name, t_id, 1, slot_no, a_ref, b_ref,
                CASE WHEN a_ref IS NULL OR b_ref IS NULL THEN now() ELSE NULL END);
      i := i + 2;
    END LOOP;

    -- later rounds (placeholders)
    FOR r IN 2..rounds LOOP
      FOR slot_no IN 1..(size / (2^r)::int) LOOP
        INSERT INTO public.matches(owner_id, sport, team_a, team_b, tournament_id, round, slot)
          VALUES (uid, _sport, 'TBD', 'TBD', t_id, r, slot_no);
      END LOOP;
    END LOOP;

    -- propagate byes from round 1
    PERFORM public.advance_bracket_from(m.id) FROM public.matches m
      WHERE m.tournament_id = t_id AND m.round = 1 AND (m.team_a_ref IS NULL OR m.team_b_ref IS NULL);
  END IF;

  RETURN t_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.advance_bracket_from(_match_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  m record;
  t record;
  win_ref uuid;
  win_name text;
  next_slot int;
  sets_a int;
  sets_b int;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id;
  IF m.id IS NULL OR m.tournament_id IS NULL OR m.round IS NULL THEN RETURN; END IF;
  SELECT * INTO t FROM public.tournaments WHERE id = m.tournament_id;
  IF t.format <> 'single_elimination' THEN RETURN; END IF;

  IF m.team_a_ref IS NULL AND m.team_b_ref IS NULL THEN RETURN; END IF;
  IF m.team_b_ref IS NULL THEN
    win_ref := m.team_a_ref;
  ELSIF m.team_a_ref IS NULL THEN
    win_ref := m.team_b_ref;
  ELSE
    IF m.ended_at IS NULL THEN RETURN; END IF;
    IF m.score_a > m.score_b THEN win_ref := m.team_a_ref;
    ELSIF m.score_b > m.score_a THEN win_ref := m.team_b_ref;
    ELSE
      SELECT COUNT(*) INTO sets_a FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'a')::int > (s->>'b')::int;
      SELECT COUNT(*) INTO sets_b FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'b')::int > (s->>'a')::int;
      IF sets_a > sets_b THEN win_ref := m.team_a_ref;
      ELSIF sets_b > sets_a THEN win_ref := m.team_b_ref;
      ELSE RETURN; END IF;
    END IF;
  END IF;

  SELECT name INTO win_name FROM public.tournament_teams WHERE id = win_ref;
  IF win_name IS NULL THEN RETURN; END IF;

  next_slot := ((m.slot + 1) / 2);

  PERFORM set_config('app.bypass_match_guard', 'on', true);

  IF m.slot % 2 = 1 THEN
    UPDATE public.matches SET team_a_ref = win_ref, team_a = win_name
      WHERE tournament_id = m.tournament_id AND round = m.round + 1 AND slot = next_slot;
  ELSE
    UPDATE public.matches SET team_b_ref = win_ref, team_b = win_name
      WHERE tournament_id = m.tournament_id AND round = m.round + 1 AND slot = next_slot;
  END IF;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_bracket_advance()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.tournament_id IS NOT NULL AND NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL THEN
    PERFORM public.advance_bracket_from(NEW.id);
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS bracket_advance_after_update ON public.matches;
CREATE TRIGGER bracket_advance_after_update
  AFTER UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_bracket_advance();

REVOKE ALL ON FUNCTION public.create_tournament(text, text, text, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_tournament(text, text, text, text[]) TO authenticated;
REVOKE ALL ON FUNCTION public.advance_bracket_from(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_match(uuid) FROM PUBLIC, anon, authenticated;