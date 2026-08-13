-- Canonical sport-betting guard: keep database writes aligned with the UI contract.
-- Bets are stored as JSON on matches, so enforce the same $1..$250 range at the
-- database boundary as well as in the client.

CREATE OR REPLACE FUNCTION public.guard_match_bet_amounts()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  bet jsonb;
  amount numeric;
BEGIN
  IF NEW.bets IS NULL THEN
    RETURN NEW;
  END IF;

  IF jsonb_typeof(NEW.bets) <> 'array' THEN
    RAISE EXCEPTION 'invalid_bets_payload';
  END IF;

  FOR bet IN SELECT value FROM jsonb_array_elements(NEW.bets) LOOP
    IF bet ? 'amount' THEN
      BEGIN
        amount := (bet->>'amount')::numeric;
      EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
        RAISE EXCEPTION 'invalid_bet_amount';
      END;

      IF amount < 1 OR amount > 250 THEN
        RAISE EXCEPTION 'invalid_amount';
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guard_match_bet_amounts ON public.matches;
CREATE TRIGGER trg_guard_match_bet_amounts
BEFORE INSERT OR UPDATE OF bets ON public.matches
FOR EACH ROW
EXECUTE FUNCTION public.guard_match_bet_amounts();
