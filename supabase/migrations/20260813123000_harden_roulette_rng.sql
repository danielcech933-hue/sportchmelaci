-- Roulette result must not be predictable from the round number.
CREATE OR REPLACE FUNCTION public.roulette_result(_round_no bigint)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN floor(random() * 37)::integer;
END;
$function$;

REVOKE ALL ON FUNCTION public.roulette_result(bigint) FROM PUBLIC, anon, authenticated;