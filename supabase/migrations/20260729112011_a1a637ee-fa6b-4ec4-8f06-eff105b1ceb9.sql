
-- 1) Lock down SECURITY DEFINER trigger function
REVOKE ALL ON FUNCTION public.chat_force_nickname() FROM PUBLIC, anon, authenticated;

-- Also lock down other trigger-only definer functions that shouldn't be callable
REVOKE ALL ON FUNCTION public.guard_matches_update() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_match_delete_refund() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_match_settle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.settle_match(uuid) FROM PUBLIC, anon, authenticated;

-- 2) Column-level UPDATE restriction on matches: revoke blanket update, grant only safe columns.
REVOKE UPDATE ON public.matches FROM authenticated;
GRANT UPDATE (
  sport, team_a, team_b, score_a, score_b, sets,
  started_at, ended_at, scheduled_at, updated_at
) ON public.matches TO authenticated;
-- bets, bets_locked_at, confirmed_at, confirmed_by are intentionally excluded;
-- they are mutated only through SECURITY DEFINER RPCs (place_bet, withdraw_bet, confirm_match)
-- which run as postgres and bypass column privileges.
