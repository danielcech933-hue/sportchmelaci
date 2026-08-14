-- Site Credits: real-money top-ups become non-withdrawable platform credits.
-- 1 Kč = 1 credit. Credits are separate from Sports Dollars and Slot CZK.
-- Users never write balances directly; only the server-side payment finalizer can credit them.

CREATE TABLE IF NOT EXISTS public.site_credit_accounts (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.site_credit_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_session_id text NOT NULL,
  amount_credits integer NOT NULL CHECK (amount_credits > 0),
  amount_czk integer NOT NULL CHECK (amount_czk > 0),
  kind text NOT NULL DEFAULT 'topup',
  created_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (stripe_session_id)
);

CREATE INDEX IF NOT EXISTS site_credit_transactions_user_created_idx
  ON public.site_credit_transactions (user_id, created_at DESC);

ALTER TABLE public.site_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_credit_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS site_credit_accounts_self_select ON public.site_credit_accounts;
CREATE POLICY site_credit_accounts_self_select
  ON public.site_credit_accounts
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS site_credit_transactions_self_select ON public.site_credit_transactions;
CREATE POLICY site_credit_transactions_self_select
  ON public.site_credit_transactions
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

REVOKE ALL ON public.site_credit_accounts FROM anon, authenticated;
GRANT SELECT ON public.site_credit_accounts TO authenticated;
REVOKE ALL ON public.site_credit_transactions FROM anon, authenticated;
GRANT SELECT ON public.site_credit_transactions TO authenticated;

-- Idempotent server-only finalizer. The Stripe session itself is verified by
-- the trusted server function before this RPC is called.
CREATE OR REPLACE FUNCTION public.site_credit_apply_checkout(
  _user_id uuid,
  _stripe_session_id text,
  _amount_czk integer,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_new_balance integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'user_required'; END IF;
  IF _stripe_session_id IS NULL OR length(trim(_stripe_session_id)) < 10 THEN RAISE EXCEPTION 'session_required'; END IF;
  IF _amount_czk < 50 OR _amount_czk > 50000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  INSERT INTO public.site_credit_accounts (user_id, balance)
  VALUES (_user_id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  INSERT INTO public.site_credit_transactions (
    user_id, stripe_session_id, amount_credits, amount_czk, kind, metadata
  ) VALUES (
    _user_id, _stripe_session_id, _amount_czk, _amount_czk, 'topup', COALESCE(_metadata, '{}'::jsonb)
  )
  ON CONFLICT (stripe_session_id) DO NOTHING;

  IF FOUND THEN
    UPDATE public.site_credit_accounts
    SET balance = balance + _amount_czk,
        updated_at = now()
    WHERE user_id = _user_id
    RETURNING balance INTO v_new_balance;
  ELSE
    SELECT balance INTO v_new_balance
    FROM public.site_credit_accounts
    WHERE user_id = _user_id;
  END IF;

  RETURN COALESCE(v_new_balance, 0);
END;
$$;

REVOKE ALL ON FUNCTION public.site_credit_apply_checkout(uuid, text, integer, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.site_credit_apply_checkout(uuid, text, integer, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.site_credit_get_balance()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT balance FROM public.site_credit_accounts WHERE user_id = auth.uid()), 0);
$$;

REVOKE ALL ON FUNCTION public.site_credit_get_balance() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.site_credit_get_balance() TO authenticated;
