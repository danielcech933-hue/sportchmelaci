-- Widen the authoritative shared-dollar wallet.
-- The previous numeric(10,2) cap is only 99,999,999.99.
-- Roll / virtual stock cases already use values up to 1e12, so the profile
-- wallet must support the same scale.

ALTER TABLE public.profiles
  ALTER COLUMN balance TYPE numeric(30,2)
  USING balance::numeric(30,2);

COMMENT ON COLUMN public.profiles.balance IS
  'Authoritative shared-dollar play-money balance. Supports up to 28 integer digits plus 2 decimals.';
