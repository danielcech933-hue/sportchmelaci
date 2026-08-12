-- CHMELOVCI CUP — fix authoritative slot grid shape.
-- Older slot_spin initialized every reel with the complete 11-symbol catalogue
-- and then overwrote only the first 3 entries. That produced 5 x 11 JSON arrays,
-- while the client contract is strictly 5 reels x 3 visible rows.
-- Keep the server authoritative; only correct the server-side grid container.

DO $$
DECLARE
  fn text;
  old_block text := $old$
  grid text[][] := ARRAY[
    ARRAY['ten','j','q','k','a','whistle','boots','silver','gold','wild','scatter'],
    ARRAY['ten','j','q','k','a','whistle','boots','silver','gold','wild','scatter'],
    ARRAY['ten','j','q','k','a','whistle','boots','silver','gold','wild','scatter'],
    ARRAY['ten','j','q','k','a','whistle','boots','silver','gold','wild','scatter'],
    ARRAY['ten','j','q','k','a','whistle','boots','silver','gold','wild','scatter']
  ];$old$;
  new_block text := $new$
  grid text[][] := ARRAY[
    ARRAY['','',''],
    ARRAY['','',''],
    ARRAY['','',''],
    ARRAY['','',''],
    ARRAY['','','']
  ];$new$;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'slot_spin'
     AND pg_get_function_identity_arguments(p.oid) = '_bet numeric';

  IF fn IS NULL THEN
    RAISE EXCEPTION 'slot_spin(numeric) not found';
  END IF;

  IF position(old_block IN fn) = 0 THEN
    -- If the function is already fixed, the migration is safely idempotent.
    IF position(new_block IN fn) > 0 THEN
      RETURN;
    END IF;
    RAISE EXCEPTION 'slot_spin grid initializer did not match expected legacy shape';
  END IF;

  fn := replace(fn, old_block, new_block);
  EXECUTE fn;
END;
$$;

-- Contract assertion: the live function must contain the strict grid initializer.
DO $$
DECLARE
  fn text;
BEGIN
  SELECT pg_get_functiondef(p.oid)
    INTO fn
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'slot_spin'
     AND pg_get_function_identity_arguments(p.oid) = '_bet numeric';

  IF fn IS NULL OR position('grid text[][] := ARRAY[' IN fn) = 0 THEN
    RAISE EXCEPTION 'slot_spin grid initializer is missing after migration';
  END IF;
END;
$$;
