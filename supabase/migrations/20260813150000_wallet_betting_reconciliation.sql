-- Reconcile the legacy match betting settlement with the authoritative wallet.
-- Betting RPCs historically mutate profiles.balance directly. Keep settlement
-- semantics unchanged, but route future wallet movements through one audited helper.

CREATE OR REPLACE FUNCTION public.wallet_betting_credit(
  _user_id uuid,
  _amount numeric,
  _reason text DEFAULT 'bet_settlement'
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
BEGIN
  IF _user_id IS NULL OR _amount IS NULL OR _amount <= 0 OR _amount > 100000 THEN
    RAISE EXCEPTION 'invalid_wallet_credit';
  END IF;

  SELECT balance INTO v_balance
  FROM public.profiles
  WHERE id = _user_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'no_profile';
  END IF;

  v_balance := round(v_balance + _amount, 2);

  UPDATE public.profiles
  SET balance = v_balance, updated_at = now()
  WHERE id = _user_id;

  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_betting_credit(uuid,numeric,text) FROM PUBLIC, anon, authenticated;

-- Replace only the internal settlement credit operations. The trigger remains
-- the canonical entry point when ended_at transitions to a value.
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
  SELECT id, score_a, score_b, sets, bets, ended_at
    INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF m.id IS NULL OR m.ended_at IS NULL THEN RETURN; END IF;
  IF COALESCE(jsonb_array_length(m.bets), 0) = 0 THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(m.bets) x
             WHERE x->>'status' IS NOT NULL AND x->>'status' <> 'open') THEN
    RETURN;
  END IF;

  SELECT COUNT(DISTINCT x->>'userId') INTO unique_bettors
  FROM jsonb_array_elements(m.bets) x;

  IF unique_bettors < 2 THEN
    FOR b IN SELECT value FROM jsonb_array_elements(m.bets) LOOP
      IF COALESCE(b->>'status','open') = 'open' THEN
        PERFORM public.wallet_betting_credit((b->>'userId')::uuid,
          COALESCE((b->>'amount')::numeric,0), 'bet_refund');
      END IF;
      new_b := b || jsonb_build_object('status','refunded','payout',COALESCE((b->>'amount')::numeric,0));
      updated_bets := updated_bets || jsonb_build_array(new_b);
    END LOOP;
    UPDATE public.matches SET bets = updated_bets WHERE id = _match_id;
    RETURN;
  END IF;

  IF m.score_a > m.score_b THEN winner := 'a';
  ELSIF m.score_b > m.score_a THEN winner := 'b';
  ELSE
    SELECT COUNT(*) INTO sets_a FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s
      WHERE (s->>'a')::int > (s->>'b')::int;
    SELECT COUNT(*) INTO sets_b FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s
      WHERE (s->>'b')::int > (s->>'a')::int;
    IF sets_a > sets_b THEN winner := 'a';
    ELSIF sets_b > sets_a THEN winner := 'b';
    ELSE winner := NULL; END IF;
  END IF;

  IF winner IS NULL THEN
    FOR b IN SELECT value FROM jsonb_array_elements(m.bets) LOOP
      PERFORM public.wallet_betting_credit((b->>'userId')::uuid,
        COALESCE((b->>'amount')::numeric,0), 'bet_refund');
      new_b := b || jsonb_build_object('status','refunded','payout',COALESCE((b->>'amount')::numeric,0));
      updated_bets := updated_bets || jsonb_build_array(new_b);
    END LOOP;
    UPDATE public.matches SET bets = updated_bets WHERE id = _match_id;
    RETURN;
  END IF;

  SELECT COALESCE(SUM((x->>'amount')::numeric),0) INTO total_pool
  FROM jsonb_array_elements(m.bets) x;
  SELECT COALESCE(SUM((x->>'amount')::numeric),0) INTO winning_stake
  FROM jsonb_array_elements(m.bets) x WHERE x->>'pick' = winner;

  IF winning_stake = 0 THEN
    FOR b IN SELECT value FROM jsonb_array_elements(m.bets) LOOP
      PERFORM public.wallet_betting_credit((b->>'userId')::uuid,
        COALESCE((b->>'amount')::numeric,0), 'bet_refund');
      new_b := b || jsonb_build_object('status','refunded','payout',COALESCE((b->>'amount')::numeric,0));
      updated_bets := updated_bets || jsonb_build_array(new_b);
    END LOOP;
    UPDATE public.matches SET bets = updated_bets WHERE id = _match_id;
    RETURN;
  END IF;

  FOR b IN SELECT value FROM jsonb_array_elements(m.bets) LOOP
    IF b->>'pick' = winner THEN
      payout := ROUND(COALESCE((b->>'amount')::numeric,0) * total_pool / winning_stake, 2);
      status := 'won';
      PERFORM public.wallet_betting_credit((b->>'userId')::uuid, payout, 'bet_payout');
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

REVOKE ALL ON FUNCTION public.settle_match(uuid) FROM PUBLIC, anon, authenticated;
