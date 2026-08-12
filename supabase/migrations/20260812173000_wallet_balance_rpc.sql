-- Keep the shared dollar wallet authoritative in public.profiles.balance.
-- Bets already use this balance through SECURITY DEFINER RPCs; the client wallet
-- must use the same source instead of a local dollar delta.

CREATE OR REPLACE FUNCTION public.wallet_adjust_balance(
  _delta numeric,
  _reason text DEFAULT 'wallet_adjustment'
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  new_balance numeric;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF _delta IS NULL OR _delta = 0 OR abs(_delta) > 100000 THEN
    RAISE EXCEPTION 'invalid_delta';
  END IF;

  SELECT balance
    INTO new_balance
    FROM public.profiles
   WHERE id = uid
   FOR UPDATE;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'no_profile';
  END IF;

  new_balance := round(new_balance + _delta, 2);
  IF new_balance < 0 THEN
    RAISE EXCEPTION 'insufficient_balance';
  END IF;

  UPDATE public.profiles
     SET balance = new_balance
   WHERE id = uid;

  RETURN new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_adjust_balance(numeric, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_adjust_balance(numeric, text) TO authenticated;
