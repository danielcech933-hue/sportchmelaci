-- Unify Poker cash-out with the authoritative shared wallet.
-- Keeps the existing idempotent poker_cashout_ledger guard while routing
-- the actual balance mutation through wallet_apply().

CREATE OR REPLACE FUNCTION public.wallet_apply(
  _delta_dollars numeric DEFAULT 0,
  _delta_slot_czk numeric DEFAULT 0,
  _reason text DEFAULT 'wallet_adjustment'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  bal numeric;
  slot_bal numeric;
  expected numeric;
  next_balance numeric;
  next_slot numeric;
  last_bonus timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF _reason NOT IN ('exchange_to_slot','exchange_to_dollars','slot_bet','slot_win','daily_bonus','poker_cashout') THEN
    RAISE EXCEPTION 'invalid_wallet_reason';
  END IF;

  SELECT balance, slot_czk INTO bal, slot_bal
    FROM public.profiles WHERE id = uid FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;

  IF _reason = 'exchange_to_slot' THEN
    IF _delta_dollars >= 0 OR _delta_slot_czk <= 0 OR mod(_delta_dollars, 1) <> 0 THEN
      RAISE EXCEPTION 'invalid_exchange';
    END IF;
    expected := abs(_delta_dollars) * 100;
    IF _delta_slot_czk <> expected OR abs(_delta_dollars) > 1000 THEN
      RAISE EXCEPTION 'invalid_exchange';
    END IF;
  ELSIF _reason = 'exchange_to_dollars' THEN
    IF _delta_dollars <= 0 OR _delta_slot_czk >= 0 OR mod(_delta_dollars, 1) <> 0 THEN
      RAISE EXCEPTION 'invalid_exchange';
    END IF;
    expected := _delta_dollars * 100;
    IF abs(_delta_slot_czk) <> expected OR _delta_dollars > 1000 THEN
      RAISE EXCEPTION 'invalid_exchange';
    END IF;
  ELSIF _reason = 'slot_bet' THEN
    IF _delta_dollars <> 0 OR _delta_slot_czk >= 0 OR _delta_slot_czk < -100000 THEN
      RAISE EXCEPTION 'invalid_slot_bet';
    END IF;
  ELSIF _reason = 'slot_win' THEN
    IF _delta_dollars <> 0 OR _delta_slot_czk <= 0 OR _delta_slot_czk > 100000 THEN
      RAISE EXCEPTION 'invalid_slot_win';
    END IF;
  ELSIF _reason = 'daily_bonus' THEN
    IF _delta_slot_czk <> 0 OR _delta_dollars NOT IN (5,10,20,50) THEN
      RAISE EXCEPTION 'invalid_daily_bonus';
    END IF;
    SELECT last_claim_at INTO last_bonus FROM public.wallet_bonus_claims WHERE user_id = uid FOR UPDATE;
    IF last_bonus IS NOT NULL AND last_bonus > now() - interval '8 hours' THEN
      RAISE EXCEPTION 'daily_bonus_cooldown';
    END IF;
    INSERT INTO public.wallet_bonus_claims(user_id,last_claim_at)
      VALUES (uid, now())
      ON CONFLICT (user_id) DO UPDATE SET last_claim_at = EXCLUDED.last_claim_at;
  ELSIF _reason = 'poker_cashout' THEN
    IF _delta_dollars < 0 OR _delta_slot_czk <> 0 OR _delta_dollars > 1000000 THEN
      RAISE EXCEPTION 'invalid_poker_cashout';
    END IF;
  END IF;

  next_balance := round(bal + COALESCE(_delta_dollars,0), 2);
  next_slot := round(slot_bal + COALESCE(_delta_slot_czk,0), 2);
  IF next_balance < 0 THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  IF next_slot < 0 THEN RAISE EXCEPTION 'insufficient_slot'; END IF;

  UPDATE public.profiles
     SET balance = next_balance, slot_czk = next_slot
   WHERE id = uid;

  RETURN jsonb_build_object('balance', next_balance, 'slot_czk', next_slot);
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_apply(numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_apply(numeric,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.poker_cash_out(_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  t record;
  s record;
  cash numeric;
  inserted_id uuid;
  wallet_result jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO t FROM public.poker_tournaments WHERE id = _tournament_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'tournament_not_found'; END IF;
  IF t.status NOT IN ('finished','cancelled') THEN RAISE EXCEPTION 'cashout_not_available'; END IF;

  SELECT * INTO s FROM public.poker_seats
   WHERE tournament_id = _tournament_id AND user_id = uid FOR UPDATE;

  IF s.id IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.poker_cashout_ledger WHERE tournament_id = _tournament_id AND user_id = uid) THEN
      RETURN jsonb_build_object('ok', true, 'cashed', 0, 'already', true);
    END IF;
    RAISE EXCEPTION 'not_seated';
  END IF;

  cash := CASE
    WHEN t.starting_chips > 0 THEN ROUND((s.chips::numeric / t.starting_chips) * t.buy_in, 2)
    ELSE 0
  END;

  INSERT INTO public.poker_cashout_ledger(tournament_id, user_id, amount)
  VALUES (_tournament_id, uid, cash)
  ON CONFLICT (tournament_id, user_id) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'cashed', 0, 'already', true);
  END IF;

  wallet_result := public.wallet_apply(cash, 0, 'poker_cashout');
  DELETE FROM public.poker_seats WHERE id = s.id;

  RETURN jsonb_build_object(
    'ok', true,
    'cashed', cash,
    'already', false,
    'balance', wallet_result->'balance'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.poker_cash_out(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.poker_cash_out(uuid) TO authenticated;
