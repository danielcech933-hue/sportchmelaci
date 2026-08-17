-- Fix THUNDER EGG privileged slot runtime: avoid ambiguous nickname identifier.
-- Danko + Chlaďar/chladar: max 1,000,000 CZK. Everyone else: 500 CZK.

CREATE OR REPLACE FUNCTION public.slot_epic_spin(_game_id text, _bet numeric DEFAULT 10)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  bal numeric;
  game text := lower(trim(_game_id));
  bet numeric := COALESCE(_bet,0);
  cols integer; rows integer;
  grid jsonb := '[]'::jsonb; col jsonb; sym text; r integer; c integer; idx integer;
  scatter_count integer := 0; wild_count integer := 0; win_count integer := 0; money_count integer := 0;
  total numeric := 0; multiplier numeric := 1; feature text := 'SPIN'; bonus_mode text := NULL;
  free_left integer := 0; bonus_done boolean := false; bonus_triggered boolean := false;
  bonus_collected numeric := 0; retriggered boolean := false;
  divine_cells jsonb := '[]'::jsonb; coin_values jsonb := '[]'::jsonb; lightning_cells jsonb := '[]'::jsonb; money_values jsonb := '[]'::jsonb;
  session public.slot_variant_bonus_sessions%ROWTYPE; target text; count_target integer; p numeric;
  v_nickname text; max_bet numeric := 500;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF game NOT IN ('thunder-egg','bass-bounty') THEN RAISE EXCEPTION 'invalid_epic_game'; END IF;
  SELECT p.nickname INTO v_nickname FROM public.profiles AS p WHERE p.id = uid;
  IF lower(trim(coalesce(v_nickname,''))) IN ('danko','chlaďar','chladar') THEN max_bet := 1000000; END IF;
  IF bet NOT IN (0,5,10,20,50,100,200,500,1000,2000,5000,10000,20000,50000,100000,200000,500000,1000000) OR bet > max_bet THEN RAISE EXCEPTION 'invalid_slot_bet'; END IF;
  SELECT slot_czk INTO bal FROM public.profiles WHERE id = uid FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  SELECT * INTO session FROM public.slot_variant_bonus_sessions WHERE user_id = uid FOR UPDATE;
  IF FOUND AND session.game_id <> game THEN DELETE FROM public.slot_variant_bonus_sessions WHERE user_id=uid; session := NULL; END IF;
  IF FOUND AND session.user_id IS NOT NULL AND session.free_spins_remaining > 0 THEN
    IF bet <> 0 THEN RAISE EXCEPTION 'bonus_spin_must_be_zero'; END IF;
    bonus_mode := session.mode; free_left := session.free_spins_remaining; multiplier := session.multiplier; bonus_triggered := true;
  ELSE
    IF bal < bet THEN RAISE EXCEPTION 'insufficient_slot'; END IF;
    bal := bal - bet;
  END IF;

  IF game='thunder-egg' THEN
    cols:=6; rows:=5;
    FOR c IN 1..cols LOOP
      col:='[]'::jsonb;
      FOR r IN 1..rows LOOP
        idx:=floor(random()*100)::int;
        sym:=CASE WHEN idx<14 THEN 'zeus_k' WHEN idx<26 THEN 'zeus_q' WHEN idx<38 THEN 'zeus_j' WHEN idx<49 THEN 'zeus_10' WHEN idx<58 THEN 'thunder' WHEN idx<66 THEN 'eagle' WHEN idx<73 THEN 'pillar' WHEN idx<80 THEN 'egg' WHEN idx<86 THEN 'wild' WHEN idx<92 THEN 'hand' ELSE 'scatter' END;
        IF sym='scatter' THEN scatter_count:=scatter_count+1; END IF;
        IF sym='wild' THEN wild_count:=wild_count+1; END IF;
        col:=col||jsonb_build_array(sym);
      END LOOP;
      grid:=grid||jsonb_build_array(col);
    END LOOP;
    FOREACH target IN ARRAY ARRAY['zeus_k','zeus_q','zeus_j','zeus_10','thunder','eagle','pillar'] LOOP
      count_target:=0;
      FOR c IN 0..5 LOOP FOR r IN 0..4 LOOP IF (grid->c->>r)=target OR (grid->c->>r)='wild' THEN count_target:=count_target+1; END IF; END LOOP; END LOOP;
      IF count_target>=5 THEN
        p:=CASE target WHEN 'pillar' THEN 1.5 WHEN 'eagle' THEN 2 WHEN 'thunder' THEN 2.5 WHEN 'zeus_10' THEN 1 WHEN 'zeus_j' THEN 1.2 WHEN 'zeus_q' THEN 1.4 ELSE 1.8 END;
        total:=total+round(bet*p*GREATEST(1,multiplier),2); win_count:=win_count+1;
      END IF;
    END LOOP;
    IF win_count>0 THEN
      FOR c IN 0..5 LOOP FOR r IN 0..4 LOOP
        IF random()<0.24 THEN
          divine_cells:=divine_cells||jsonb_build_array(jsonb_build_array(c,r));
          p:=CASE WHEN random()<0.08 THEN 10 WHEN random()<0.16 THEN 6 WHEN random()<0.3 THEN 4 ELSE 1+floor(random()*4)::int END;
          coin_values:=coin_values||jsonb_build_array(p);
          IF random()<0.12 THEN lightning_cells:=lightning_cells||jsonb_build_array(jsonb_build_array(c,r)); p:=p*(2+floor(random()*5)::int); END IF;
          total:=total+round(bet*p*multiplier,2);
        END IF;
      END LOOP; END LOOP;
      feature:='DIVINE REVEAL';
    END IF;
    IF scatter_count>=3 AND session.user_id IS NULL THEN
      bonus_triggered:=true; free_left:=10; bonus_mode:=CASE scatter_count WHEN 3 THEN 'storm' WHEN 4 THEN 'wheel' ELSE 'superstar' END;
      feature:=CASE bonus_mode WHEN 'storm' THEN 'STORM ASCENSION' WHEN 'wheel' THEN 'THUNDER WHEEL' ELSE 'SUPREME THUNDER' END;
      INSERT INTO public.slot_variant_bonus_sessions(user_id,game_id,mode,free_spins_remaining,multiplier,retriggers,collector,bonus_total,updated_at)
      VALUES(uid,game,bonus_mode,free_left,1,0,0,0,now())
      ON CONFLICT(user_id) DO UPDATE SET game_id=EXCLUDED.game_id,mode=EXCLUDED.mode,free_spins_remaining=EXCLUDED.free_spins_remaining,multiplier=1,retriggers=0,collector=0,bonus_total=0,updated_at=now();
    END IF;
  ELSE
    cols:=5; rows:=3;
    IF bonus_triggered THEN
      FOR c IN 1..cols LOOP
        col:='[]'::jsonb;
        FOR r IN 1..rows LOOP
          idx:=floor(random()*100)::int;
          sym:=CASE WHEN idx<13 THEN 'angler_wild' WHEN idx<30 THEN 'fish_money' WHEN idx<37 THEN 'boat_scatter' WHEN idx<49 THEN 'fish_k' WHEN idx<61 THEN 'fish_q' WHEN idx<73 THEN 'fish_j' WHEN idx<85 THEN 'fish_10' WHEN idx<93 THEN 'hook' ELSE 'lure' END;
          IF sym='angler_wild' THEN wild_count:=wild_count+1; END IF;
          IF sym='fish_money' THEN money_count:=money_count+1; p:=CASE WHEN random()<0.02 THEN 250 WHEN random()<0.05 THEN 100 WHEN random()<0.12 THEN 50 WHEN random()<0.25 THEN 25 ELSE 2+floor(random()*20)::int END; money_values:=money_values||jsonb_build_array(p); END IF;
          col:=col||jsonb_build_array(sym);
        END LOOP;
        grid:=grid||jsonb_build_array(col);
      END LOOP;
      IF wild_count>0 AND money_count=0 THEN money_count:=1; p:=5+floor(random()*20)::int; money_values:=money_values||jsonb_build_array(p); feature:='HOOKED FISH'; ELSE feature:='BIG CATCH'; END IF;
      IF money_count>0 AND wild_count>0 THEN FOR idx IN 0..jsonb_array_length(money_values)-1 LOOP bonus_collected:=bonus_collected+(money_values->>idx)::numeric; END LOOP; total:=round(bet*bonus_collected*multiplier,2); END IF;
      IF wild_count>0 THEN
        session.collector:=session.collector+wild_count;
        IF session.collector>=4 THEN retriggered:=true; session.retriggers:=session.retriggers+1; session.collector:=session.collector-4; multiplier:=CASE WHEN session.retriggers=1 THEN 2 WHEN session.retriggers=2 THEN 3 ELSE 10 END; free_left:=free_left+10; END IF;
      END IF;
      free_left:=GREATEST(free_left-1,0);
      IF free_left=0 THEN bonus_done:=true; bonus_mode:='big_catch'; DELETE FROM public.slot_variant_bonus_sessions WHERE user_id=uid; ELSE UPDATE public.slot_variant_bonus_sessions SET free_spins_remaining=free_left,multiplier=multiplier,retriggers=session.retriggers,collector=session.collector,bonus_total=bonus_total+total,updated_at=now() WHERE user_id=uid; END IF;
    ELSE
      FOR c IN 1..cols LOOP
        col:='[]'::jsonb;
        FOR r IN 1..rows LOOP
          idx:=floor(random()*100)::int;
          sym:=CASE WHEN idx<10 THEN 'fisher' WHEN idx<25 THEN 'fish_k' WHEN idx<40 THEN 'fish_q' WHEN idx<55 THEN 'fish_j' WHEN idx<70 THEN 'fish_10' WHEN idx<82 THEN 'hook' WHEN idx<92 THEN 'lure' ELSE 'boat_scatter' END;
          IF sym='boat_scatter' THEN scatter_count:=scatter_count+1; END IF;
          col:=col||jsonb_build_array(sym);
        END LOOP;
        grid:=grid||jsonb_build_array(col);
      END LOOP;
      feature:=CASE WHEN scatter_count>=3 THEN 'CAST INTO BONUS' ELSE 'OPEN WATER' END;
      IF scatter_count>=3 THEN
        bonus_triggered:=true; free_left:=CASE scatter_count WHEN 3 THEN 10 WHEN 4 THEN 15 ELSE 20 END; bonus_mode:='big_catch';
        INSERT INTO public.slot_variant_bonus_sessions(user_id,game_id,mode,free_spins_remaining,multiplier,retriggers,collector,bonus_total,updated_at)
        VALUES(uid,game,bonus_mode,free_left,1,0,0,0,now())
        ON CONFLICT(user_id) DO UPDATE SET game_id=EXCLUDED.game_id,mode=EXCLUDED.mode,free_spins_remaining=EXCLUDED.free_spins_remaining,multiplier=1,retriggers=0,collector=0,bonus_total=0,updated_at=now();
      END IF;
    END IF;
  END IF;

  total:=LEAST(round(total,2),round(GREATEST(bet,1)*1000,2));
  UPDATE public.profiles SET slot_czk=round(bal+total,2) WHERE id=uid;
  IF bonus_triggered AND NOT bonus_done THEN SELECT free_spins_remaining,multiplier INTO free_left,multiplier FROM public.slot_variant_bonus_sessions WHERE user_id=uid; END IF;
  RETURN jsonb_build_object('game_id',game,'grid',grid,'columns',cols,'rows',rows,'total',total,'multiplier_of_bet',CASE WHEN bet>0 THEN round(total/bet,2) ELSE 0 END,'feature',feature,'slot_czk',round(bal+total,2),'bonus_triggered',bonus_triggered,'bonus_mode',bonus_mode,'free_spins_left',free_left,'bonus_done',bonus_done,'bonus_collected',bonus_collected,'retriggered',retriggered,'divine_cells',divine_cells,'coin_values',coin_values,'lightning_cells',lightning_cells,'money_values',money_values,'wild_count',wild_count,'scatter_count',scatter_count,'collector',COALESCE(session.collector,0),'multiplier',multiplier);
END;
$function$;

REVOKE ALL ON FUNCTION public.slot_epic_spin(text,numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.slot_epic_spin(text,numeric) TO authenticated;
