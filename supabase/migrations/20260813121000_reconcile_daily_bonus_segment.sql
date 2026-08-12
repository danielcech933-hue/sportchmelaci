-- Keep the daily wheel payout and the animated segment authoritative together.
-- The UI has eight fixed segments: [5,10,20,50,5,10,20,50].

CREATE OR REPLACE FUNCTION public.daily_bonus_claim()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  claimed_at timestamptz := now();
  last_claim timestamptz;
  prize numeric;
  segment_index integer;
  new_balance numeric;
  prizes numeric[] := ARRAY[5,10,20,50,5,10,20,50];
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text, 901));

  SELECT last_claim_at INTO last_claim
  FROM public.daily_bonus_claims
  WHERE user_id = uid
  FOR UPDATE;

  IF last_claim IS NOT NULL AND last_claim > claimed_at - interval '8 hours' THEN
    RAISE EXCEPTION 'daily_bonus_cooldown';
  END IF;

  segment_index := floor(random() * 8)::integer;
  prize := prizes[segment_index + 1];

  INSERT INTO public.daily_bonus_claims(user_id,last_claim_at)
  VALUES(uid, claimed_at)
  ON CONFLICT (user_id) DO UPDATE SET last_claim_at = EXCLUDED.last_claim_at;

  UPDATE public.profiles
  SET balance = round(balance + prize, 2), updated_at = now()
  WHERE id = uid
  RETURNING balance INTO new_balance;

  IF new_balance IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'prize', prize,
    'amount', prize,
    'segment_index', segment_index,
    'balance', new_balance,
    'claimed_at', claimed_at,
    'next_claim_at', claimed_at + interval '8 hours'
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.daily_bonus_claim() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.daily_bonus_claim() TO authenticated;