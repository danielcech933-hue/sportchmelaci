-- Harden poker chip synchronization and direct-message updates.
-- The live database is reconciled separately; this migration keeps repository history aligned.

CREATE OR REPLACE FUNCTION public.poker_sync_chips(_tournament_id uuid, _stacks jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  own_stack integer;
  t record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO t FROM public.poker_tournaments WHERE id = _tournament_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'tournament_not_found'; END IF;
  IF t.status NOT IN ('lobby','active') THEN RAISE EXCEPTION 'tournament_not_active'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.poker_seats WHERE tournament_id = _tournament_id AND user_id = uid) THEN
    RAISE EXCEPTION 'not_seated';
  END IF;
  IF jsonb_typeof(_stacks) <> 'object' THEN RAISE EXCEPTION 'invalid_stacks'; END IF;
  IF NOT (_stacks ? uid::text) THEN RAISE EXCEPTION 'own_stack_required'; END IF;
  own_stack := GREATEST(0, LEAST(t.starting_chips, (_stacks->>uid::text)::integer));
  UPDATE public.poker_seats
     SET chips = own_stack
   WHERE tournament_id = _tournament_id AND user_id = uid;
END;
$function$;

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
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO t FROM public.poker_tournaments WHERE id = _tournament_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'tournament_not_found'; END IF;
  IF t.status NOT IN ('finished','cancelled') THEN RAISE EXCEPTION 'cashout_not_available'; END IF;
  SELECT * INTO s FROM public.poker_seats WHERE tournament_id = _tournament_id AND user_id = uid FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'not_seated'; END IF;
  cash := CASE WHEN t.starting_chips > 0 THEN ROUND((s.chips::numeric / t.starting_chips) * t.buy_in, 2) ELSE 0 END;
  DELETE FROM public.poker_seats WHERE id = s.id;
  IF cash > 0 THEN
    UPDATE public.profiles SET balance = balance + cash, updated_at = now() WHERE id = uid;
  END IF;
  RETURN jsonb_build_object('ok', true, 'cashed', cash);
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_direct_message_update()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.sender_id IS DISTINCT FROM OLD.sender_id
     OR NEW.recipient_id IS DISTINCT FROM OLD.recipient_id
     OR NEW.content IS DISTINCT FROM OLD.content
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'direct_message_immutable';
  END IF;
  IF NEW.read_at IS NOT DISTINCT FROM OLD.read_at THEN
    RAISE EXCEPTION 'direct_message_noop';
  END IF;
  IF auth.uid() IS DISTINCT FROM OLD.recipient_id THEN
    RAISE EXCEPTION 'not_message_recipient';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_direct_message_update ON public.direct_messages;
CREATE TRIGGER trg_guard_direct_message_update
BEFORE UPDATE ON public.direct_messages
FOR EACH ROW
EXECUTE FUNCTION public.guard_direct_message_update();

CREATE INDEX IF NOT EXISTS idx_direct_messages_recipient_unread
  ON public.direct_messages (recipient_id, created_at DESC)
  WHERE read_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_direct_messages_conversation
  ON public.direct_messages (sender_id, recipient_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at
  ON public.chat_messages (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_poker_seats_tournament
  ON public.poker_seats (tournament_id, seat_no);

CREATE INDEX IF NOT EXISTS idx_roulette_bets_round_open
  ON public.roulette_bets (round_no, settled)
  WHERE settled = false;

CREATE INDEX IF NOT EXISTS idx_slot_sessions_user_created
  ON public.slot_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_slot_bonus_user_updated
  ON public.slot_bonus_sessions (user_id, updated_at DESC);
