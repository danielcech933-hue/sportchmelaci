
-- Guard trigger: prevent non-admin direct edits to bets, bets_locked_at, confirmed_at, confirmed_by
CREATE OR REPLACE FUNCTION public.guard_matches_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bypass text := current_setting('app.bypass_match_guard', true);
  is_admin boolean;
BEGIN
  IF bypass = 'on' THEN
    RETURN NEW;
  END IF;

  is_admin := public.has_role(auth.uid(), 'admin');

  IF (NEW.bets IS DISTINCT FROM OLD.bets
      OR NEW.bets_locked_at IS DISTINCT FROM OLD.bets_locked_at)
     AND NOT is_admin THEN
    RAISE EXCEPTION 'direct modification of bets is not allowed; use place_bet/withdraw_bet';
  END IF;

  IF (NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
      OR NEW.confirmed_by IS DISTINCT FROM OLD.confirmed_by)
     AND NOT is_admin THEN
    RAISE EXCEPTION 'only admins can confirm matches';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS matches_guard_update ON public.matches;
CREATE TRIGGER matches_guard_update
BEFORE UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.guard_matches_update();

-- Update RPCs to set bypass flag so they can legitimately modify guarded columns
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
  END IF;

  UPDATE public.profiles SET balance = balance - _amount WHERE id = uid;

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
END;
$function$;

-- Add a dedicated admin RPC for confirming matches (used by admin UI)
CREATE OR REPLACE FUNCTION public.confirm_match(_match_id uuid, _confirm boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;

  PERFORM set_config('app.bypass_match_guard', 'on', true);

  IF _confirm THEN
    UPDATE public.matches SET confirmed_at = now(), confirmed_by = uid WHERE id = _match_id;
  ELSE
    UPDATE public.matches SET confirmed_at = NULL, confirmed_by = NULL WHERE id = _match_id;
  END IF;
END;
$$;

-- Lock down EXECUTE on SECURITY DEFINER functions: no anon/public access
REVOKE ALL ON FUNCTION public.place_bet(uuid, text, numeric, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.withdraw_bet(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.settle_match(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_match_settle() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.trg_match_delete_refund() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.guard_matches_update() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.confirm_match(uuid, boolean) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.place_bet(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_bet(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_match(uuid, boolean) TO authenticated;
-- settle_match, trg_*, handle_new_user, guard_matches_update: internal only, no grants
