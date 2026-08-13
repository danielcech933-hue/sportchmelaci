-- Reassert roulette RNG hardening so the live database cannot fall back to the
-- old deterministic round-number implementation if an earlier migration was
-- skipped or deployed out of order.
CREATE OR REPLACE FUNCTION public.roulette_result(_round_no bigint)
RETURNS integer
LANGUAGE plpgsql
VOLATILE
SET search_path = public, extensions, pg_temp
AS $$
BEGIN
  RETURN floor(random() * 37)::integer;
END;
$$;

REVOKE ALL ON FUNCTION public.roulette_result(bigint) FROM PUBLIC, anon, authenticated;
