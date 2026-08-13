-- Reconcile legacy settle_match() with the auditable betting ledger.
-- The legacy settlement function already updates profiles.balance and stores
-- the final bet status/payout inside matches.bets. This trigger mirrors those
-- finalized results into the ledger without changing the user's balance again.

CREATE OR REPLACE FUNCTION public.record_settled_bet_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  b jsonb;
  v_user_id uuid;
  v_amount numeric;
  v_kind text;
BEGIN
  IF NEW.ended_at IS NULL OR NEW.bets IS NULL OR jsonb_typeof(NEW.bets) <> 'array' THEN
    RETURN NEW;
  END IF;

  FOR b IN SELECT value FROM jsonb_array_elements(NEW.bets) LOOP
    IF b->>'status' IN ('won','refunded') THEN
      v_user_id := NULLIF(b->>'userId','')::uuid;
      v_amount := COALESCE((b->>'payout')::numeric, 0);
      v_kind := CASE WHEN b->>'status' = 'refunded' THEN 'bet_refund' ELSE 'bet_payout' END;

      IF v_user_id IS NOT NULL AND v_amount > 0 THEN
        INSERT INTO public.wallet_betting_ledger(user_id, match_id, amount, kind)
        VALUES (v_user_id, NEW.id, round(v_amount,2), v_kind)
        ON CONFLICT (user_id, match_id, kind) DO NOTHING;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zzz_record_settled_bet_ledger ON public.matches;
CREATE TRIGGER zzz_record_settled_bet_ledger
AFTER UPDATE OF ended_at, bets ON public.matches
FOR EACH ROW
WHEN (NEW.ended_at IS NOT NULL)
EXECUTE FUNCTION public.record_settled_bet_ledger();

REVOKE ALL ON FUNCTION public.record_settled_bet_ledger() FROM PUBLIC, anon, authenticated;

-- Read-only profile history endpoint. It is intentionally scoped to auth.uid()
-- so Profile/History never needs elevated access to the ledger.
CREATE OR REPLACE FUNCTION public.get_my_betting_ledger()
RETURNS TABLE (
  id uuid,
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
  SELECT l.id, l.match_id, l.amount, l.kind, l.created_at
  FROM public.wallet_betting_ledger l
  WHERE l.user_id = auth.uid()
  ORDER BY l.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.get_my_betting_ledger() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_betting_ledger() TO authenticated;
