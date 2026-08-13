-- Make poker cash-out auditable and idempotent.
-- The existing poker cash-out used a direct profiles.balance update with no
-- durable payout record. Keep the same gameplay contract, but make the wallet
-- movement atomic and replay-safe.

CREATE TABLE IF NOT EXISTS public.poker_cashout_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.poker_tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS poker_cashout_once
  ON public.poker_cashout_ledger(tournament_id, user_id);
CREATE INDEX IF NOT EXISTS poker_cashout_user_created
  ON public.poker_cashout_ledger(user_id, created_at DESC);

ALTER TABLE public.poker_cashout_ledger ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "poker cashout own read" ON public.poker_cashout_ledger;
CREATE POLICY "poker cashout own read"
  ON public.poker_cashout_ledger
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
REVOKE ALL ON public.poker_cashout_ledger FROM anon, authenticated;
GRANT SELECT ON public.poker_cashout_ledger TO authenticated;

CREATE OR REPLACE FUNCTION public.poker_cash_out(_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  t record;
  s record;
  cash numeric;
  inserted_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO t
    FROM public.poker_tournaments
   WHERE id = _tournament_id
   FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'tournament_not_found'; END IF;
  IF t.status NOT IN ('finished','cancelled') THEN
    RAISE EXCEPTION 'cashout_not_available';
  END IF;

  SELECT * INTO s
    FROM public.poker_seats
   WHERE tournament_id = _tournament_id
     AND user_id = uid
   FOR UPDATE;
  IF s.id IS NULL THEN
    IF EXISTS (
      SELECT 1 FROM public.poker_cashout_ledger
       WHERE tournament_id = _tournament_id AND user_id = uid
    ) THEN
      RETURN jsonb_build_object('ok', true, 'cashed', 0, 'already', true);
    END IF;
    RAISE EXCEPTION 'not_seated';
  END IF;

  cash := CASE
    WHEN t.starting_chips > 0
      THEN ROUND((s.chips::numeric / t.starting_chips) * t.buy_in, 2)
    ELSE 0
  END;

  INSERT INTO public.poker_cashout_ledger(tournament_id, user_id, amount)
  VALUES (_tournament_id, uid, cash)
  ON CONFLICT (tournament_id, user_id) DO NOTHING
  RETURNING id INTO inserted_id;

  IF inserted_id IS NULL THEN
    RETURN jsonb_build_object('ok', true, 'cashed', 0, 'already', true);
  END IF;

  IF cash > 0 THEN
    UPDATE public.profiles
       SET balance = ROUND(balance + cash, 2), updated_at = now()
     WHERE id = uid;
    IF NOT FOUND THEN RAISE EXCEPTION 'no_profile'; END IF;
  END IF;

  DELETE FROM public.poker_seats WHERE id = s.id;

  RETURN jsonb_build_object('ok', true, 'cashed', cash, 'already', false);
END;
$function$;

REVOKE ALL ON FUNCTION public.poker_cash_out(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.poker_cash_out(uuid) TO authenticated;
