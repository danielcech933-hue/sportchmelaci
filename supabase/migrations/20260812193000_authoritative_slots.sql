-- Phase 1 security: server-authoritative slot session storage.
-- The slot RPC implementation lives in the following migration so this file stays
-- safe to re-run while the engine is being hardened.

CREATE TABLE IF NOT EXISTS public.slot_bonus_sessions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  multiplier numeric(8,2),
  base_bet numeric(12,2),
  spins_remaining integer NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  pending_pick boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.slot_bonus_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.slot_bonus_sessions FROM anon, authenticated;
