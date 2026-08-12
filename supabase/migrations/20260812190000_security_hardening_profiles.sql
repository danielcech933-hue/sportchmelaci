-- Security hardening: keep money server-authoritative.
-- Clients may edit profile presentation fields, but never balances or account ownership.

-- Remove broad table privileges inherited from the initial profile migration.
REVOKE INSERT, DELETE ON public.profiles FROM authenticated;
REVOKE UPDATE ON public.profiles FROM authenticated;

-- Allow a signed-in user to edit only presentation fields on their own row.
GRANT UPDATE (nickname, avatar_path, updated_at) ON public.profiles TO authenticated;

-- Money is changed only through trusted SECURITY DEFINER functions.
-- This blocks direct PostgREST updates such as { balance: 999999 } or { slot_czk: 999999 }.
REVOKE UPDATE (balance, slot_czk) ON public.profiles FROM authenticated;

-- Do not expose the internal wallet bonus ledger directly.
REVOKE ALL ON public.wallet_bonus_claims FROM anon, authenticated;
GRANT SELECT ON public.wallet_bonus_claims TO authenticated;

-- The wallet RPC remains the only client entry point for balance changes.
REVOKE ALL ON FUNCTION public.wallet_apply(numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_apply(numeric,numeric,text) TO authenticated;

-- Retire the older generic balance RPC completely if it exists.
DO $$
BEGIN
  IF to_regprocedure('public.wallet_adjust_balance(numeric,text)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.wallet_adjust_balance(numeric,text) FROM PUBLIC, anon, authenticated;
  END IF;
END
$$;

-- Trigger-only security functions must never be callable by a client.
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.chat_force_nickname() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_matches_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_match_delete_refund() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_match_settle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_bracket_advance() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_matches_audit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_match(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.advance_bracket_from(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.write_audit(text,text,uuid,uuid,jsonb) FROM PUBLIC, anon, authenticated;
