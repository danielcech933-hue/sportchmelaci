-- Add an auditable ledger for match betting credits/refunds.
-- The existing balance remains the spendable balance; this ledger records
-- settlement/refund events so Profile/History can use the same source of truth.

CREATE TABLE IF NOT EXISTS public.wallet_betting_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  kind text NOT NULL CHECK (kind IN ('bet_payout','bet_refund')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS wallet_betting_ledger_once
  ON public.wallet_betting_ledger(user_id, match_id, kind);
CREATE INDEX IF NOT EXISTS wallet_betting_ledger_user_created
  ON public.wallet_betting_ledger(user_id, created_at DESC);

ALTER TABLE public.wallet_betting_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wallet betting ledger own read" ON public.wallet_betting_ledger;
CREATE POLICY "wallet betting ledger own read"
  ON public.wallet_betting_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.wallet_betting_credit(
  _user_id uuid,
  _amount numeric,
  _reason text DEFAULT 'bet_settlement',
  _match_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance numeric;
  v_kind text;
  v_inserted boolean := false;
BEGIN
  IF _user_id IS NULL OR _amount IS NULL OR _amount <= 0 OR _amount > 100000 THEN
    RAISE EXCEPTION 'invalid_wallet_credit';
  END IF;

  v_kind := CASE WHEN _reason = 'bet_refund' THEN 'bet_refund' ELSE 'bet_payout' END;

  IF _match_id IS NOT NULL THEN
    INSERT INTO public.wallet_betting_ledger(user_id, match_id, amount, kind)
    VALUES (_user_id, _match_id, round(_amount,2), v_kind)
    ON CONFLICT (user_id, match_id, kind) DO NOTHING;
    v_inserted := FOUND;
    IF NOT v_inserted THEN
      SELECT balance INTO v_balance FROM public.profiles WHERE id = _user_id;
      IF v_balance IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
      RETURN v_balance;
    END IF;
  END IF;

  SELECT balance INTO v_balance
  FROM public.profiles WHERE id = _user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;

  v_balance := round(v_balance + _amount, 2);
  UPDATE public.profiles SET balance = v_balance, updated_at = now() WHERE id = _user_id;
  RETURN v_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_betting_credit(uuid,numeric,text,uuid) FROM PUBLIC, anon, authenticated;
