CREATE OR REPLACE FUNCTION public.get_my_betting_ledger(_limit integer DEFAULT 50)
RETURNS TABLE (
  id text,
  user_id uuid,
  match_id uuid,
  amount numeric,
  kind text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(b->>'id', m.id::text || ':' || (b->>'userId')) AS id,
    auth.uid() AS user_id,
    m.id AS match_id,
    CASE
      WHEN b->>'status' = 'refunded' THEN 0::numeric
      ELSE ROUND(COALESCE((b->>'payout')::numeric, 0) - COALESCE((b->>'amount')::numeric, 0), 2)
    END AS amount,
    CASE WHEN b->>'status' = 'refunded' THEN 'bet_refund' ELSE 'bet_payout' END AS kind,
    COALESCE((b->>'createdAt')::timestamptz, m.ended_at, m.created_at) AS created_at
  FROM public.matches m
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.bets, '[]'::jsonb)) b
  WHERE auth.uid() IS NOT NULL
    AND b->>'userId' = auth.uid()::text
    AND COALESCE(b->>'status', 'open') IN ('won', 'lost', 'refunded')
  ORDER BY COALESCE((b->>'createdAt')::timestamptz, m.ended_at, m.created_at) DESC
  LIMIT GREATEST(COALESCE(_limit, 50), 1);
$$;

REVOKE ALL ON FUNCTION public.get_my_betting_ledger(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_betting_ledger(integer) TO authenticated;