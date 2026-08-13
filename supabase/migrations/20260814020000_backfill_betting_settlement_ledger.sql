-- Repair historical betting settlements that were credited to the wallet before
-- settle_match() was fixed to pass match_id into wallet_betting_credit().
--
-- This migration ONLY creates missing audit rows. It deliberately does not touch
-- wallet balances, so running it cannot double-credit users.

INSERT INTO public.wallet_betting_ledger (user_id, match_id, amount, kind, created_at)
SELECT
  (b->>'userId')::uuid AS user_id,
  m.id AS match_id,
  round((b->>'payout')::numeric, 2) AS amount,
  CASE
    WHEN b->>'status' = 'bet_refund' OR b->>'status' = 'refunded' THEN 'bet_refund'
    ELSE 'bet_payout'
  END AS kind,
  COALESCE(m.ended_at, now()) AS created_at
FROM public.matches AS m
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(m.bets, '[]'::jsonb)) AS b
WHERE m.ended_at IS NOT NULL
  AND b->>'userId' IS NOT NULL
  AND b->>'status' IN ('won', 'refunded', 'bet_refund')
  AND COALESCE((b->>'payout')::numeric, 0) > 0
ON CONFLICT (user_id, match_id, kind) DO NOTHING;
