-- Column-level hardening: owners/admins may only update non-critical match columns directly
REVOKE UPDATE ON public.matches FROM authenticated;
GRANT UPDATE (team_a, team_b, sport, score_a, score_b, sets, ended_at, scheduled_at, started_at, updated_at) ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;

-- Admin-only bet removal moves to a definer RPC (bets column is no longer client-updatable)
CREATE OR REPLACE FUNCTION public.admin_remove_bet(_match_id uuid, _bet_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_bets jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;

  PERFORM set_config('app.bypass_match_guard', 'on', true);

  SELECT COALESCE(jsonb_agg(b), '[]'::jsonb) INTO new_bets
    FROM public.matches m, jsonb_array_elements(COALESCE(m.bets, '[]'::jsonb)) b
    WHERE m.id = _match_id AND b->>'id' <> _bet_id::text;

  UPDATE public.matches SET bets = COALESCE(new_bets, '[]'::jsonb) WHERE id = _match_id;

  PERFORM public.write_audit('bet.removed_by_admin', 'bet', _bet_id, _match_id, '{}'::jsonb);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_remove_bet(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_remove_bet(uuid, uuid) TO authenticated;