-- CHMELOVCI CUP — allow zero-bet session records for server-authoritative free spins.
-- A paid spin must still use a positive bet; zero is reserved for bonus/free spins.
-- The slot_spin RPC already enforces that distinction and rejects zero for paid spins.

ALTER TABLE public.slot_sessions
  DROP CONSTRAINT IF EXISTS slot_sessions_bet_amount_check;

ALTER TABLE public.slot_sessions
  ADD CONSTRAINT slot_sessions_bet_amount_check
  CHECK (bet_amount >= 0);
