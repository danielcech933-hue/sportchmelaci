-- The previous implementation created an internal SportChmelaci credit wallet.
-- That was not the intended product: users should support the project so the
-- workspace owner can purchase Lovable workspace credits. Remove the internal
-- wallet and its client-facing RPCs; support payments remain project donations.

REVOKE ALL ON FUNCTION public.site_credit_apply_checkout(uuid, text, integer, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.site_credit_get_balance() FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.site_credit_apply_checkout(uuid, text, integer, jsonb);
DROP FUNCTION IF EXISTS public.site_credit_get_balance();

DROP TABLE IF EXISTS public.site_credit_transactions CASCADE;
DROP TABLE IF EXISTS public.site_credit_accounts CASCADE;
