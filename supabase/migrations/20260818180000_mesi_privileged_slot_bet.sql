-- Allow Mesi to use the privileged 1,000,000 Slot CZK max bet.
-- The migration updates the server-authoritative slot RPCs without changing
-- the standard 500 max for other players.
DO $$
DECLARE
  fn record;
  src text;
  updated text;
BEGIN
  FOR fn IN
    SELECT p.oid, n.nspname, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('slot_epic_spin', 'slot_variant_spin')
  LOOP
    src := pg_get_functiondef(fn.oid);
    updated := src;

    IF fn.proname = 'slot_epic_spin' THEN
      updated := replace(
        updated,
        'bet numeric := coalesce(_bet,0);',
        'bet numeric := coalesce(_bet,0); privileged boolean := false;'
      );
      updated := replace(
        updated,
        'if game not in (''thunder-egg'',''bass-bounty'') then raise exception ''invalid_epic_game''; end if;\n  if bet not in (5,10,20,50,100,200,500) and not (bet = 0) then raise exception ''invalid_slot_bet''; end if;',
        'if game not in (''thunder-egg'',''bass-bounty'') then raise exception ''invalid_epic_game''; end if;\n  select lower(trim(nickname)) in (''danko'',''chlaďar'',''chladar'',''midas'',''m1das'',''messi'',''mesi'') into privileged from public.profiles where id=uid;\n  if not privileged and bet not in (5,10,20,50,100,200,500) and not (bet = 0) then raise exception ''invalid_slot_bet''; end if;'
      );
    ELSE
      updated := replace(
        updated,
        'bet numeric:=coalesce(_bet,0);',
        'bet numeric:=coalesce(_bet,0); privileged boolean:=false;'
      );
      updated := replace(
        updated,
        'IF bet NOT IN (5,10,20,50,100,200,500) THEN RAISE EXCEPTION ''invalid_slot_bet''; END IF;',
        'SELECT lower(trim(nickname)) IN (''danko'',''chlaďar'',''chladar'',''midas'',''m1das'',''messi'',''mesi'') INTO privileged FROM public.profiles WHERE id=uid;\n  IF NOT privileged AND bet NOT IN (5,10,20,50,100,200,500) THEN RAISE EXCEPTION ''invalid_slot_bet''; END IF;'
      );
    END IF;

    IF updated = src THEN
      RAISE EXCEPTION 'Privileged slot patch did not match %', fn.proname;
    END IF;

    EXECUTE updated;
  END LOOP;
END $$;
