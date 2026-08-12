-- Authoritative shared wallet: both dollars and Slot CZK live on the profile.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS slot_czk numeric(12,2) NOT NULL DEFAULT 10000;

CREATE TABLE IF NOT EXISTS public.wallet_bonus_claims (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_claim_at timestamptz
);
ALTER TABLE public.wallet_bonus_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own wallet bonus claims" ON public.wallet_bonus_claims;
CREATE POLICY "own wallet bonus claims"
  ON public.wallet_bonus_claims FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
REVOKE ALL ON public.wallet_bonus_claims FROM anon, authenticated;
GRANT SELECT ON public.wallet_bonus_claims TO authenticated;

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

  IF _reason NOT IN ('exchange_to_slot','exchange_to_dollars','slot_bet','slot_win','daily_bonus') THEN
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

-- Retire the earlier generic adjustment function so clients cannot mint arbitrary dollars.
REVOKE ALL ON FUNCTION public.wallet_adjust_balance(numeric,text) FROM PUBLIC, anon, authenticated;
