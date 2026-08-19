-- QA hardening: wallet_apply must never mint daily bonus funds directly.
-- Daily bonus is granted only by the dedicated cooldown-protected RPC.
CREATE OR REPLACE FUNCTION public.wallet_apply(
  _delta_dollars numeric DEFAULT 0,
  _delta_slot_czk numeric DEFAULT 0,
  _reason text DEFAULT 'wallet_adjustment'::text
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
  next_balance numeric;
  next_slot numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _delta_dollars IS NULL OR _delta_slot_czk IS NULL THEN RAISE EXCEPTION 'invalid_wallet_delta'; END IF;
  IF _delta_dollars <> round(_delta_dollars,2) OR _delta_slot_czk <> round(_delta_slot_czk,2) THEN
    RAISE EXCEPTION 'invalid_wallet_delta';
  END IF;

  IF _reason IN ('slot_bet','slot_win','daily_bonus') THEN
    RAISE EXCEPTION 'operation_must_use_dedicated_rpc';
  ELSIF _reason = 'exchange_to_slot' THEN
    IF _delta_dollars >= 0 OR _delta_slot_czk <= 0
       OR _delta_slot_czk <> (-_delta_dollars * 100)
       OR _delta_dollars <> trunc(_delta_dollars) THEN
      RAISE EXCEPTION 'invalid_exchange';
    END IF;
  ELSIF _reason = 'exchange_to_dollars' THEN
    IF _delta_dollars <= 0 OR _delta_slot_czk >= 0
       OR _delta_dollars <> (-_delta_slot_czk / 100)
       OR _delta_slot_czk <> trunc(_delta_slot_czk) THEN
      RAISE EXCEPTION 'invalid_exchange';
    END IF;
  ELSE
    RAISE EXCEPTION 'invalid_wallet_reason';
  END IF;

  SELECT balance, slot_czk INTO bal, slot_bal
  FROM public.profiles WHERE id = uid FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;

  next_balance := round(bal + _delta_dollars, 2);
  next_slot := round(slot_bal + _delta_slot_czk, 2);
  IF next_balance < 0 THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  IF next_slot < 0 THEN RAISE EXCEPTION 'insufficient_slot'; END IF;

  UPDATE public.profiles
  SET balance = next_balance, slot_czk = next_slot, updated_at = now()
  WHERE id = uid;

  RETURN jsonb_build_object('balance', next_balance, 'slot_czk', next_slot);
END;
$$;
