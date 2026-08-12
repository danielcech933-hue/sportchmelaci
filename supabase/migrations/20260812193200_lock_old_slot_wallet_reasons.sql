-- The old wallet_apply RPC must no longer be usable to mint slot money.
-- Slot bets/wins are now performed atomically by slot_spin().

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
  next_balance numeric;
  next_slot numeric;
  last_bonus timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _reason NOT IN ('exchange_to_slot','exchange_to_dollars','daily_bonus') THEN
    RAISE EXCEPTION 'invalid_wallet_reason';
  END IF;

  SELECT balance,slot_czk INTO bal,slot_bal
    FROM public.profiles WHERE id=uid FOR UPDATE;
  IF bal IS NULL OR slot_bal IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;

  IF _reason='exchange_to_slot' THEN
    IF _delta_dollars >= 0 OR _delta_slot_czk <= 0
       OR mod(_delta_dollars,1)<>0
       OR _delta_slot_czk <> abs(_delta_dollars)*100
       OR abs(_delta_dollars)>1000 THEN
      RAISE EXCEPTION 'invalid_exchange';
    END IF;
  ELSIF _reason='exchange_to_dollars' THEN
    IF _delta_dollars <= 0 OR _delta_slot_czk >= 0
       OR mod(_delta_dollars,1)<>0
       OR abs(_delta_slot_czk) <> _delta_dollars*100
       OR _delta_dollars>1000 THEN
      RAISE EXCEPTION 'invalid_exchange';
    END IF;
  ELSE
    IF _delta_slot_czk<>0 OR _delta_dollars NOT IN (5,10,20,50) THEN
      RAISE EXCEPTION 'invalid_daily_bonus';
    END IF;
    SELECT last_claim_at INTO last_bonus
      FROM public.wallet_bonus_claims WHERE user_id=uid FOR UPDATE;
    IF last_bonus IS NOT NULL AND last_bonus > now()-interval '8 hours' THEN
      RAISE EXCEPTION 'daily_bonus_cooldown';
    END IF;
    INSERT INTO public.wallet_bonus_claims(user_id,last_claim_at)
      VALUES(uid,now())
      ON CONFLICT(user_id) DO UPDATE SET last_claim_at=EXCLUDED.last_claim_at;
  END IF;

  next_balance:=round(bal+COALESCE(_delta_dollars,0),2);
  next_slot:=round(slot_bal+COALESCE(_delta_slot_czk,0),2);
  IF next_balance<0 THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  IF next_slot<0 THEN RAISE EXCEPTION 'insufficient_slot'; END IF;

  UPDATE public.profiles SET balance=next_balance,slot_czk=next_slot WHERE id=uid;
  RETURN jsonb_build_object('balance',next_balance,'slot_czk',next_slot);
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_apply(numeric,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.wallet_apply(numeric,numeric,text) TO authenticated;
