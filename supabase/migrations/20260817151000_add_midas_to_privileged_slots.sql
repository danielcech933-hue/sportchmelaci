-- Add Midas / M1das to the privileged Thunder Egg slot users.
DO $$
DECLARE
  v_def text;
  v_old text := 'IN (''danko'',''chlaďar'',''chladar'')';
  v_new text := 'IN (''danko'',''chlaďar'',''chladar'',''midas'',''m1das'')';
BEGIN
  SELECT pg_get_functiondef('public.slot_epic_spin(text,numeric)'::regprocedure) INTO v_def;
  v_def := replace(v_def, v_old, v_new);
  IF v_def = pg_get_functiondef('public.slot_epic_spin(text,numeric)'::regprocedure) THEN
    RAISE EXCEPTION 'privileged nickname patch did not match';
  END IF;
  EXECUTE v_def;
END $$;
