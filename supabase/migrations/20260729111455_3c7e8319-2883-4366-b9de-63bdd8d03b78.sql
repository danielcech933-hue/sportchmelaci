
-- Ensure guard trigger exists (blocks non-admin writes to bets / confirmed_* / bets_locked_at)
DROP TRIGGER IF EXISTS matches_guard_update ON public.matches;
CREATE TRIGGER matches_guard_update
BEFORE UPDATE ON public.matches
FOR EACH ROW EXECUTE FUNCTION public.guard_matches_update();

-- Only settle a match once an admin has confirmed it.
CREATE OR REPLACE FUNCTION public.trg_match_settle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.confirmed_at IS NOT NULL
     AND (OLD.ended_at IS NULL OR OLD.confirmed_at IS NULL) THEN
    PERFORM public.settle_match(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

-- When admin confirms an already-ended match, settlement fires via the trigger above.
-- Also, if admin un-confirms, do nothing (bets stay as-is; settlement already ran only if previously confirmed).
