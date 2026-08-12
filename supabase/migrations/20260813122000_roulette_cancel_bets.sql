CREATE OR REPLACE FUNCTION public.roulette_cancel_bets(_round_no bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  cur bigint := floor(extract(epoch from now()) / 15)::bigint;
  refunded numeric := 0;
  bal numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _round_no <> cur THEN RAISE EXCEPTION 'round_closed'; END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text || ':' || _round_no::text, 902));

  SELECT COALESCE(SUM(amount),0) INTO refunded
  FROM public.roulette_bets
  WHERE user_id=uid AND round_no=_round_no AND settled=false;

  IF refunded > 0 THEN
    UPDATE public.profiles
      SET balance=balance+refunded, updated_at=now()
      WHERE id=uid
      RETURNING balance INTO bal;

    UPDATE public.roulette_bets
      SET settled=true, payout=amount
      WHERE user_id=uid AND round_no=_round_no AND settled=false;
  ELSE
    SELECT balance INTO bal FROM public.profiles WHERE id=uid;
  END IF;

  RETURN jsonb_build_object('ok',true,'refunded',refunded,'balance',bal);
END;
$function$;

REVOKE ALL ON FUNCTION public.roulette_cancel_bets(bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.roulette_cancel_bets(bigint) TO authenticated;