-- Read-only server state for the daily wheel cooldown.

CREATE OR REPLACE FUNCTION public.daily_bonus_status()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  last_claim timestamptz;
  next_claim timestamptz;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT last_claim_at
    INTO last_claim
    FROM public.daily_bonus_claims
   WHERE user_id = uid;

  next_claim := CASE
    WHEN last_claim IS NULL THEN NULL
    ELSE last_claim + interval '8 hours'
  END;

  RETURN jsonb_build_object(
    'last_claim_at', last_claim,
    'next_claim_at', next_claim,
    'can_claim', next_claim IS NULL OR next_claim <= now()
  );
END;
$$;

REVOKE ALL ON FUNCTION public.daily_bonus_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.daily_bonus_status() TO authenticated;
