
-- Audit log table
CREATE TABLE public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_nickname text,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid,
  match_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read audit log"
  ON public.audit_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX audit_log_created_at_idx ON public.audit_log (created_at DESC);
CREATE INDEX audit_log_match_id_idx ON public.audit_log (match_id);

-- Helper: write a row (SECURITY DEFINER so triggers/rpcs can insert regardless of caller)
CREATE OR REPLACE FUNCTION public.write_audit(
  _action text,
  _entity_type text,
  _entity_id uuid,
  _match_id uuid,
  _details jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  nick text;
BEGIN
  IF uid IS NOT NULL THEN
    SELECT nickname INTO nick FROM public.profiles WHERE id = uid;
  END IF;
  INSERT INTO public.audit_log(actor_id, actor_nickname, action, entity_type, entity_id, match_id, details)
    VALUES (uid, nick, _action, _entity_type, _entity_id, _match_id, COALESCE(_details, '{}'::jsonb));
END;
$$;

REVOKE ALL ON FUNCTION public.write_audit(text,text,uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;

-- Trigger on matches: create / update / delete
CREATE OR REPLACE FUNCTION public.trg_matches_audit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  changed jsonb := '{}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.write_audit(
      'match.created', 'match', NEW.id, NEW.id,
      jsonb_build_object('sport', NEW.sport, 'team_a', NEW.team_a, 'team_b', NEW.team_b,
                          'scheduled_at', NEW.scheduled_at)
    );
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    PERFORM public.write_audit(
      'match.deleted', 'match', OLD.id, OLD.id,
      jsonb_build_object('team_a', OLD.team_a, 'team_b', OLD.team_b, 'sport', OLD.sport,
                          'score_a', OLD.score_a, 'score_b', OLD.score_b,
                          'had_bets', COALESCE(jsonb_array_length(OLD.bets),0))
    );
    RETURN OLD;
  ELSE
    -- UPDATE: capture confirmation transitions and end-of-match transitions
    IF NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at THEN
      IF NEW.confirmed_at IS NOT NULL THEN
        PERFORM public.write_audit('match.confirmed', 'match', NEW.id, NEW.id,
          jsonb_build_object('team_a', NEW.team_a, 'team_b', NEW.team_b,
                              'score_a', NEW.score_a, 'score_b', NEW.score_b));
      ELSE
        PERFORM public.write_audit('match.unconfirmed', 'match', NEW.id, NEW.id,
          jsonb_build_object('team_a', NEW.team_a, 'team_b', NEW.team_b));
      END IF;
    END IF;
    IF NEW.ended_at IS DISTINCT FROM OLD.ended_at THEN
      IF NEW.ended_at IS NOT NULL THEN
        PERFORM public.write_audit('match.finished', 'match', NEW.id, NEW.id,
          jsonb_build_object('score_a', NEW.score_a, 'score_b', NEW.score_b,
                              'team_a', NEW.team_a, 'team_b', NEW.team_b));
      ELSE
        PERFORM public.write_audit('match.reopened', 'match', NEW.id, NEW.id, '{}'::jsonb);
      END IF;
    END IF;
    IF NEW.score_a IS DISTINCT FROM OLD.score_a OR NEW.score_b IS DISTINCT FROM OLD.score_b THEN
      changed := changed || jsonb_build_object(
        'score_from', jsonb_build_array(OLD.score_a, OLD.score_b),
        'score_to', jsonb_build_array(NEW.score_a, NEW.score_b));
    END IF;
    IF changed <> '{}'::jsonb THEN
      PERFORM public.write_audit('match.score_changed', 'match', NEW.id, NEW.id, changed);
    END IF;
    RETURN NEW;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.trg_matches_audit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS matches_audit_trg ON public.matches;
CREATE TRIGGER matches_audit_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_matches_audit();

-- Extend place_bet to write audit
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
  unique_bettors int;
  bet_id uuid := gen_random_uuid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _pick NOT IN ('a','b') THEN RAISE EXCEPTION 'invalid_pick'; END IF;
  IF _amount IS NULL OR _amount < 1 OR _amount > 50 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  PERFORM set_config('app.bypass_match_guard', 'on', true);

  SELECT nickname, balance INTO nick, bal FROM public.profiles WHERE id = uid FOR UPDATE;
  IF nick IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  IF bal < _amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  SELECT id, ended_at, bets, bets_locked_at INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF m.ended_at IS NOT NULL THEN RAISE EXCEPTION 'match_ended'; END IF;
  IF m.bets_locked_at IS NOT NULL THEN RAISE EXCEPTION 'bets_locked'; END IF;

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

  SELECT COUNT(DISTINCT b->>'userId') INTO unique_bettors
    FROM public.matches, jsonb_array_elements(bets) b
    WHERE id = _match_id;
  IF unique_bettors >= 2 THEN
    UPDATE public.matches SET bets_locked_at = now() WHERE id = _match_id AND bets_locked_at IS NULL;
    PERFORM public.write_audit('match.bets_locked', 'match', _match_id, _match_id,
      jsonb_build_object('bettors', unique_bettors));
  END IF;

  UPDATE public.profiles SET balance = balance - _amount WHERE id = uid;

  PERFORM public.write_audit('bet.placed', 'bet', bet_id, _match_id,
    jsonb_build_object('pick', _pick, 'amount', _amount, 'note', NULLIF(TRIM(_note),'')));

  RETURN jsonb_build_object('bet_id', bet_id, 'balance', bal - _amount);
END;
$function$;

-- Extend withdraw_bet
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

  SELECT id, ended_at, bets, bets_locked_at INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF m.ended_at IS NOT NULL THEN RAISE EXCEPTION 'match_ended'; END IF;
  IF m.bets_locked_at IS NOT NULL THEN RAISE EXCEPTION 'bets_locked'; END IF;

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

-- Extend settle_match to audit payouts
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
  unique_bettors int;
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

  SELECT COUNT(DISTINCT x->>'userId') INTO unique_bettors FROM jsonb_array_elements(m.bets) x;

  IF unique_bettors < 2 THEN
    FOR b IN SELECT value FROM jsonb_array_elements(m.bets) LOOP
      UPDATE public.profiles
        SET balance = balance + COALESCE((b->>'amount')::numeric, 0)
        WHERE id::text = b->>'userId';
      new_b := b || jsonb_build_object('status','refunded','payout', COALESCE((b->>'amount')::numeric,0));
      updated_bets := updated_bets || jsonb_build_array(new_b);
    END LOOP;
    UPDATE public.matches SET bets = updated_bets WHERE id = _match_id;
    PERFORM public.write_audit('match.settled_refund', 'match', _match_id, _match_id,
      jsonb_build_object('reason','not_enough_bettors','bettors',unique_bettors));
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

  IF winning_stake = 0 THEN
    FOR b IN SELECT value FROM jsonb_array_elements(m.bets) LOOP
      UPDATE public.profiles SET balance = balance + COALESCE((b->>'amount')::numeric,0)
        WHERE id::text = b->>'userId';
      new_b := b || jsonb_build_object('status','refunded','payout', COALESCE((b->>'amount')::numeric,0));
      updated_bets := updated_bets || jsonb_build_array(new_b);
    END LOOP;
    UPDATE public.matches SET bets = updated_bets WHERE id = _match_id;
    PERFORM public.write_audit('match.settled_refund', 'match', _match_id, _match_id,
      jsonb_build_object('reason','no_winning_stake'));
    RETURN;
  END IF;

  FOR b IN SELECT value FROM jsonb_array_elements(m.bets) LOOP
    IF b->>'pick' = winner THEN
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
