
REVOKE ALL ON FUNCTION public.settle_match(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_match_settle() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trg_match_delete_refund() FROM PUBLIC, anon, authenticated;
