-- Standard slot players stay capped at 500 Slot CZK.
-- Privileged players Danko, Midas, Chladar/Chlaďar and Messi may use up to 1,000,000.
DO $migration$
DECLARE
  current_def text;
  old_guard text := $old$
  IF _bet IS NULL OR _bet < 0 OR _bet > 500 OR round(_bet,2) <> _bet THEN RAISE EXCEPTION 'invalid_slot_bet'; END IF;
$old$;
  new_guard text := $new$
  IF _bet IS NULL OR _bet < 0 OR round(_bet,2) <> _bet THEN RAISE EXCEPTION 'invalid_slot_bet'; END IF;
  IF _bet > 1000000 THEN RAISE EXCEPTION 'invalid_slot_bet'; END IF;
  IF _bet > 500
     AND lower(trim(coalesce((SELECT nickname FROM public.profiles WHERE id=uid),''))) NOT IN ('danko','chlaďar','chladar','midas','m1das','messi')
  THEN RAISE EXCEPTION 'invalid_slot_bet'; END IF;
$new$;
BEGIN
  SELECT pg_get_functiondef('public.slot_spin(numeric)'::regprocedure) INTO current_def;
  IF position(old_guard IN current_def) = 0 THEN
    RAISE EXCEPTION 'slot_spin guard pattern not found';
  END IF;
  current_def := replace(current_def, old_guard, new_guard);
  EXECUTE current_def;
END;
$migration$;