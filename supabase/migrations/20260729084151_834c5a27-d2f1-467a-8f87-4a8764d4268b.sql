
-- 1. Balance column
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS balance numeric(10,2) NOT NULL DEFAULT 1000;
UPDATE public.profiles SET balance = 1000 WHERE balance IS NULL;

-- 2. Match locked flag
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS bets_locked_at timestamptz;

-- 3. Update handle_new_user to explicitly set balance (default handles it, but be explicit)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  desired TEXT;
  candidate TEXT;
  suffix INT := 0;
BEGIN
  desired := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'nickname'), ''), split_part(NEW.email, '@', 1), 'player');
  desired := substr(desired, 1, 30);
  candidate := desired;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE nickname = candidate) LOOP
    suffix := suffix + 1;
    candidate := substr(desired, 1, 26) || '_' || suffix::text;
  END LOOP;
  INSERT INTO public.profiles (id, nickname, balance) VALUES (NEW.id, candidate, 1000);
  RETURN NEW;
END;
$function$;

-- Prevent client-side updates to balance via profiles UPDATE policy: recreate more restrictive
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND balance = (SELECT balance FROM public.profiles WHERE id = auth.uid()));

-- 4. place_bet function
CREATE OR REPLACE FUNCTION public.place_bet(_match_id uuid, _pick text, _amount numeric, _note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  SELECT nickname, balance INTO nick, bal FROM public.profiles WHERE id = uid FOR UPDATE;
  IF nick IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  IF bal < _amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  SELECT id, ended_at, bets, bets_locked_at INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF m.ended_at IS NOT NULL THEN RAISE EXCEPTION 'match_ended'; END IF;
  IF m.bets_locked_at IS NOT NULL THEN RAISE EXCEPTION 'bets_locked'; END IF;

  -- One bet per user per match
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

  -- Lock if 2+ unique bettors after insert
  SELECT COUNT(DISTINCT b->>'userId') INTO unique_bettors
    FROM public.matches, jsonb_array_elements(bets) b
    WHERE id = _match_id;
  IF unique_bettors >= 2 THEN
    UPDATE public.matches SET bets_locked_at = now() WHERE id = _match_id AND bets_locked_at IS NULL;
  END IF;

  UPDATE public.profiles SET balance = balance - _amount WHERE id = uid;

  RETURN jsonb_build_object('bet_id', bet_id, 'balance', bal - _amount);
END;
$$;

-- 5. withdraw_bet
CREATE OR REPLACE FUNCTION public.withdraw_bet(_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  m record;
  my_bet jsonb;
  refund numeric := 0;
  new_bets jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
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
$$;

-- 6. settle_match — internal helper (called by trigger when ended_at set)
CREATE OR REPLACE FUNCTION public.settle_match(_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  SELECT id, sport, score_a, score_b, sets, bets, ended_at INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF m.id IS NULL OR m.ended_at IS NULL THEN RETURN; END IF;
  IF COALESCE(jsonb_array_length(m.bets), 0) = 0 THEN RETURN; END IF;

  -- Already settled? Check if any bet has status != 'open'
  IF EXISTS (SELECT 1 FROM jsonb_array_elements(m.bets) x WHERE x->>'status' IS NOT NULL AND x->>'status' <> 'open') THEN
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT x->>'userId') INTO unique_bettors FROM jsonb_array_elements(m.bets) x;

  IF unique_bettors < 2 THEN
    -- refund all
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

  -- determine winner: score first, sets as tiebreaker
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
    -- draw: refund all
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
    -- nobody bet on the winner (shouldn't happen with 2+ bettors on different sides, but possible if both on losing side): refund
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
$$;

-- 7. Trigger settlement when ended_at transitions from NULL to a value
CREATE OR REPLACE FUNCTION public.trg_match_settle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF (OLD.ended_at IS NULL AND NEW.ended_at IS NOT NULL) THEN
    PERFORM public.settle_match(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_settle_trigger ON public.matches;
CREATE TRIGGER match_settle_trigger
  AFTER UPDATE OF ended_at ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_match_settle();

-- 8. Refund open bets when match is deleted
CREATE OR REPLACE FUNCTION public.trg_match_delete_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE b jsonb;
BEGIN
  IF OLD.bets IS NULL THEN RETURN OLD; END IF;
  FOR b IN SELECT value FROM jsonb_array_elements(OLD.bets) LOOP
    IF COALESCE(b->>'status','open') = 'open' THEN
      UPDATE public.profiles SET balance = balance + COALESCE((b->>'amount')::numeric,0)
        WHERE id::text = b->>'userId';
    END IF;
  END LOOP;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS match_delete_refund_trigger ON public.matches;
CREATE TRIGGER match_delete_refund_trigger
  BEFORE DELETE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_match_delete_refund();

GRANT EXECUTE ON FUNCTION public.place_bet(uuid, text, numeric, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.withdraw_bet(uuid) TO authenticated;
