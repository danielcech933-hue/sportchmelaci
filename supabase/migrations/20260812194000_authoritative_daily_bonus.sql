-- Server-authoritative daily wheel.
-- The browser never chooses or credits the prize and cannot bypass the cooldown.

CREATE TABLE IF NOT EXISTS public.daily_bonus_claims (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_claim_at timestamptz
);

ALTER TABLE public.daily_bonus_claims ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.daily_bonus_claims FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.daily_bonus_claim()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  current_balance numeric;
  last_claim timestamptz;
  next_claim timestamptz;
  prize numeric;
  roll integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT balance
    INTO current_balance
    FROM public.profiles
   WHERE id = uid
   FOR UPDATE;

  IF current_balance IS NULL THEN
    RAISE EXCEPTION 'no_profile';
  END IF;

  INSERT INTO public.daily_bonus_claims(user_id, last_claim_at)
  VALUES (uid, NULL)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT last_claim_at
    INTO last_claim
    FROM public.daily_bonus_claims
   WHERE user_id = uid
   FOR UPDATE;

  IF last_claim IS NOT NULL AND last_claim + interval '8 hours' > now() THEN
    RAISE EXCEPTION 'daily_bonus_cooldown';
  END IF;

  -- Four equally likely prizes: $5, $10, $20 or $50.
  roll := floor(random() * 4)::integer;
  prize := CASE roll
    WHEN 0 THEN 5
    WHEN 1 THEN 10
    WHEN 2 THEN 20
    ELSE 50
  END;

  current_balance := current_balance + prize;
  next_claim := now() + interval '8 hours';

  UPDATE public.profiles
     SET balance = current_balance
   WHERE id = uid;

  UPDATE public.daily_bonus_claims
     SET last_claim_at = now()
   WHERE user_id = uid;

  RETURN jsonb_build_object(
    'ok', true,
    'prize', prize,
    'balance', current_balance,
    'next_claim_at', next_claim
  );
END;
$$;

REVOKE ALL ON FUNCTION public.daily_bonus_claim() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.daily_bonus_claim() TO authenticated;
