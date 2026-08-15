-- Distinct SportChmeláci slot engines.
-- All balances are play-money Slot CZK and are settled server-side.

CREATE OR REPLACE FUNCTION public.slot_variant_spin(_game_id text, _bet numeric DEFAULT 10)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  bal numeric;
  cols integer;
  rows integer;
  game text := lower(trim(_game_id));
  grid jsonb := '[]'::jsonb;
  col jsonb;
  sym text;
  r integer;
  c integer;
  bet numeric := COALESCE(_bet, 0);
  total numeric := 0;
  mult numeric := 0;
  feature text := 'SPIN';
  wilds integer := 0;
  mystery integer := 0;
  max_run integer := 0;
  run integer;
  s text;
  target text;
  next_bal numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF game NOT IN ('neon-pints','hop-highway','golden-chmel','cursed-kegs','stadium-legends') THEN RAISE EXCEPTION 'invalid_slot_game'; END IF;
  IF bet NOT IN (5,10,20,50,100,200,500) THEN RAISE EXCEPTION 'invalid_slot_bet'; END IF;
  SELECT slot_czk INTO bal FROM public.profiles WHERE id = uid FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  IF bal < bet THEN RAISE EXCEPTION 'insufficient_slot'; END IF;
  cols := CASE game WHEN 'neon-pints' THEN 6 WHEN 'cursed-kegs' THEN 6 ELSE 5 END;
  rows := CASE game WHEN 'neon-pints' THEN 5 WHEN 'cursed-kegs' THEN 4 WHEN 'stadium-legends' THEN 4 ELSE 3 END;

  FOR c IN 1..cols LOOP
    col := '[]'::jsonb;
    FOR r IN 1..rows LOOP
      IF game = 'neon-pints' THEN
        sym := CASE floor(random()*10)::int WHEN 0 THEN 'pint' WHEN 1 THEN 'bolt' WHEN 2 THEN 'neon' WHEN 3 THEN 'ball' WHEN 4 THEN 'star' WHEN 5 THEN 'k' WHEN 6 THEN 'q' WHEN 7 THEN 'j' WHEN 8 THEN 'ten' ELSE 'wild' END;
      ELSIF game = 'hop-highway' THEN
        sym := CASE floor(random()*10)::int WHEN 0 THEN 'helmet' WHEN 1 THEN 'car' WHEN 2 THEN 'flag' WHEN 3 THEN 'boost' WHEN 4 THEN 'ball' WHEN 5 THEN 'k' WHEN 6 THEN 'q' WHEN 7 THEN 'j' WHEN 8 THEN 'ten' ELSE 'wild' END;
      ELSIF game = 'golden-chmel' THEN
        sym := CASE floor(random()*10)::int WHEN 0 THEN 'trophy_gold' WHEN 1 THEN 'trophy_silver' WHEN 2 THEN 'diamond' WHEN 3 THEN 'ball' WHEN 4 THEN 'whistle' WHEN 5 THEN 'k' WHEN 6 THEN 'q' WHEN 7 THEN 'j' WHEN 8 THEN 'ten' ELSE 'wild' END;
      ELSIF game = 'cursed-kegs' THEN
        sym := CASE floor(random()*10)::int WHEN 0 THEN 'cursed_keg' WHEN 1 THEN 'wild' WHEN 2 THEN 'skull' WHEN 3 THEN 'chain' WHEN 4 THEN 'ball' WHEN 5 THEN 'k' WHEN 6 THEN 'q' WHEN 7 THEN 'j' WHEN 8 THEN 'ten' ELSE 'mystery' END;
      ELSE
        sym := CASE floor(random()*10)::int WHEN 0 THEN 'legend' WHEN 1 THEN 'trophy_gold' WHEN 2 THEN 'wild' WHEN 3 THEN 'ball' WHEN 4 THEN 'boot' WHEN 5 THEN 'k' WHEN 6 THEN 'q' WHEN 7 THEN 'j' WHEN 8 THEN 'ten' ELSE 'champion' END;
      END IF;
      IF sym = 'wild' THEN wilds := wilds + 1; END IF;
      IF sym = 'mystery' OR sym = 'cursed_keg' THEN mystery := mystery + 1; END IF;
      col := col || jsonb_build_array(sym);
    END LOOP;
    grid := grid || jsonb_build_array(col);
  END LOOP;

  IF game = 'neon-pints' THEN
    feature := 'NEON CASCADE';
    FOREACH target IN ARRAY ARRAY['pint','bolt','neon','ball','star','k','q','j','ten'] LOOP
      run := 0;
      FOR c IN 0..cols-1 LOOP
        FOR r IN 0..rows-1 LOOP
          s := grid->c->>r;
          IF s = target OR s = 'wild' THEN run := run + 1; END IF;
        END LOOP;
      END LOOP;
      max_run := GREATEST(max_run, run);
    END LOOP;
    IF max_run >= 8 THEN total := round(bet * 6,2); ELSIF max_run >= 6 THEN total := round(bet * 3,2); ELSIF max_run >= 5 THEN total := round(bet * 1.5,2); END IF;
    IF total > 0 THEN feature := 'NEON CASCADE WIN'; END IF;
  ELSIF game = 'hop-highway' THEN
    feature := 'BOOST RUN';
    FOREACH target IN ARRAY ARRAY['helmet','car','flag','boost','ball','k','q','j','ten'] LOOP
      run := 0;
      FOR c IN 0..cols-1 LOOP
        IF EXISTS (SELECT 1 FROM jsonb_array_elements(grid->c) x WHERE x #>> '{}' = target OR x #>> '{}' = 'wild') THEN run := run + 1; ELSE EXIT; END IF;
      END LOOP;
      max_run := GREATEST(max_run, run);
    END LOOP;
    IF max_run >= 5 THEN total := round(bet * 8,2); ELSIF max_run = 4 THEN total := round(bet * 3.5,2); ELSIF max_run = 3 THEN total := round(bet * 1.5,2); END IF;
    IF wilds >= 2 THEN total := round(total + bet,2); feature := 'BOOST + WILD'; END IF;
  ELSIF game = 'golden-chmel' THEN
    feature := 'GOLDEN SERIES';
    FOREACH target IN ARRAY ARRAY['trophy_gold','trophy_silver','diamond','ball','whistle','k','q','j','ten'] LOOP
      run := 0;
      FOR c IN 0..cols-1 LOOP
        s := grid->c->>1;
        IF s = target OR s = 'wild' THEN run := run + 1; ELSE EXIT; END IF;
      END LOOP;
      max_run := GREATEST(max_run, run);
    END LOOP;
    IF max_run >= 5 THEN total := round(bet * 12,2); ELSIF max_run = 4 THEN total := round(bet * 4,2); ELSIF max_run = 3 THEN total := round(bet * 1.5,2); END IF;
    IF wilds >= 1 AND total > 0 THEN total := round(total * 1.5,2); feature := 'GOLD MULTIPLIER'; END IF;
  ELSIF game = 'cursed-kegs' THEN
    feature := 'CURSED WILD';
    IF mystery >= 2 THEN total := round(bet * (3 + mystery),2); feature := 'MYSTERY KEG'; END IF;
    IF wilds >= 3 THEN total := round(total + bet * 4,2); feature := 'CURSED WILD CHAIN'; END IF;
  ELSE
    feature := 'STADIUM LEGENDS';
    IF wilds >= 2 THEN total := round(bet * (2 + wilds),2); feature := 'LEGENDARY WILDS'; END IF;
    IF wilds >= 4 THEN total := round(total + bet * 8,2); feature := 'HALL OF FAME'; END IF;
  END IF;

  total := LEAST(round(total,2), round(bet*200,2));
  mult := CASE WHEN bet > 0 THEN round(total/bet,2) ELSE 0 END;
  next_bal := round(bal - bet + total,2);
  UPDATE public.profiles SET slot_czk = next_bal WHERE id = uid;

  RETURN jsonb_build_object('game_id',game,'grid',grid,'columns',cols,'rows',rows,'total',total,'multiplier_of_bet',mult,'feature',feature,'slot_czk',next_bal);
END;
$$;

REVOKE ALL ON FUNCTION public.slot_variant_spin(text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.slot_variant_spin(text,numeric) TO authenticated;
