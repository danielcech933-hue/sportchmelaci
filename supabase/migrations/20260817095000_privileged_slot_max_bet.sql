-- Privileged CHMELOVCI CUP slot limits.
-- Danko + Chlaďar may bet up to 1,000,000 CZK; everyone else remains capped at 500 CZK.

CREATE OR REPLACE FUNCTION public.slot_spin(_bet numeric DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  slot_bal numeric;
  nickname text;
  max_bet numeric := 500;
  sess public.slot_bonus_sessions%ROWTYPE;
  is_free boolean := false;
  bonus_mult numeric := 1;
  base_bet numeric;
  next_slot numeric;
  sym text; base text; s text; cnt integer; line_amount numeric;
  total numeric := 0; scatter_count integer := 0; scatter_amount numeric := 0;
  scatter_cells jsonb := '[]'::jsonb; line_wins jsonb := '[]'::jsonb; grid jsonb := '[]'::jsonb;
  col jsonb; cells jsonb; row integer; reel integer; line_idx integer;
  r0 integer; r1 integer; r2 integer; r3 integer; r4 integer; payout numeric;
  bonus_options jsonb := '[]'::jsonb; bonus_done boolean := false; free_left integer := 0; bonus_total numeric := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT slot_czk, nickname INTO slot_bal, nickname FROM public.profiles WHERE id=uid FOR UPDATE;
  IF slot_bal IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  IF lower(trim(coalesce(nickname,''))) IN ('danko','chlaďar','chladar') THEN max_bet := 1000000; END IF;

  SELECT * INTO sess FROM public.slot_bonus_sessions WHERE user_id=uid FOR UPDATE;
  IF FOUND THEN
    IF sess.pending_pick THEN RAISE EXCEPTION 'bonus_pick_required'; END IF;
    IF sess.spins_remaining > 0 THEN
      is_free := true; bonus_mult := COALESCE(sess.multiplier,1); base_bet := COALESCE(sess.base_bet,10);
    END IF;
  END IF;

  IF is_free THEN
    IF COALESCE(_bet,0) <> 0 THEN RAISE EXCEPTION 'invalid_free_spin_bet'; END IF;
  ELSE
    IF _bet IS NULL OR _bet NOT IN (5,10,20,50,100,200,500,1000,2000,5000,10000,20000,50000,100000,200000,500000,1000000) OR _bet > max_bet THEN
      RAISE EXCEPTION 'invalid_slot_bet';
    END IF;
    IF slot_bal < _bet THEN RAISE EXCEPTION 'insufficient_slot'; END IF;
    base_bet := _bet; slot_bal := slot_bal - _bet;
  END IF;

  FOR reel IN 1..5 LOOP
    col := '[]'::jsonb;
    FOR row IN 1..3 LOOP
      sym := public.slot_random_symbol(); col := col || jsonb_build_array(sym);
      IF sym='scatter' THEN scatter_count := scatter_count + 1; scatter_cells := scatter_cells || jsonb_build_array(jsonb_build_array(reel-1,row-1)); END IF;
    END LOOP;
    grid := grid || jsonb_build_array(col);
  END LOOP;

  FOR line_idx IN 1..5 LOOP
    r0 := CASE line_idx WHEN 1 THEN 2 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 1 ELSE 3 END;
    r1 := CASE line_idx WHEN 1 THEN 2 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 2 ELSE 2 END;
    r2 := CASE line_idx WHEN 1 THEN 2 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 3 ELSE 1 END;
    r3 := CASE line_idx WHEN 1 THEN 2 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 2 ELSE 2 END;
    r4 := CASE line_idx WHEN 1 THEN 2 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 1 ELSE 3 END;
    base := NULL;
    FOR reel IN 1..5 LOOP
      row := CASE reel WHEN 1 THEN r0 WHEN 2 THEN r1 WHEN 3 THEN r2 WHEN 4 THEN r3 ELSE r4 END;
      s := grid->(reel-1)->>(row-1); IF s <> 'wild' THEN base := s; EXIT; END IF;
    END LOOP;
    IF base IS NULL OR base='scatter' THEN CONTINUE; END IF;
    cnt := 0; cells := '[]'::jsonb;
    FOR reel IN 1..5 LOOP
      row := CASE reel WHEN 1 THEN r0 WHEN 2 THEN r1 WHEN 3 THEN r2 WHEN 4 THEN r3 ELSE r4 END;
      s := grid->(reel-1)->>(row-1);
      IF s=base OR s='wild' THEN cnt := cnt + 1; cells := cells || jsonb_build_array(jsonb_build_array(reel-1,row-1)); ELSE EXIT; END IF;
    END LOOP;
    IF cnt >= 3 THEN
      payout := public.slot_pay(base,cnt); line_amount := round(payout * base_bet * bonus_mult,2);
      IF line_amount > 0 THEN total := total + line_amount; line_wins := line_wins || jsonb_build_array(jsonb_build_object('line',line_idx-1,'symbol',base,'count',cnt,'amount',line_amount,'cells',cells)); END IF;
    END IF;
  END LOOP;

  IF scatter_count >= 3 THEN
    payout := CASE LEAST(scatter_count,5) WHEN 3 THEN 5 WHEN 4 THEN 20 ELSE 100 END;
    scatter_amount := round(payout * base_bet * bonus_mult,2); total := total + scatter_amount;
  END IF;
  total := round(total,2); next_slot := round(slot_bal + total,2);

  IF is_free THEN
    UPDATE public.slot_bonus_sessions SET spins_remaining=spins_remaining-1,total=round(public.slot_bonus_sessions.total+total,2),updated_at=now() WHERE user_id=uid;
    SELECT spins_remaining,total INTO free_left,bonus_total FROM public.slot_bonus_sessions WHERE user_id=uid;
    IF free_left <= 0 THEN bonus_done := true; DELETE FROM public.slot_bonus_sessions WHERE user_id=uid; free_left := 0; END IF;
  ELSIF scatter_count >= 3 THEN
    SELECT jsonb_agg(jsonb_build_object('spins',spins,'mult',mult)) INTO bonus_options
    FROM (SELECT spins,mult FROM (VALUES (10,2::numeric),(15,3::numeric),(20,2::numeric),(25,4::numeric),(30,3::numeric),(50,8::numeric)) v(spins,mult) ORDER BY random() LIMIT 3) q;
    INSERT INTO public.slot_bonus_sessions(user_id,options,multiplier,base_bet,spins_remaining,total,pending_pick,created_at,updated_at)
    VALUES(uid,COALESCE(bonus_options,'[]'::jsonb),NULL,base_bet,0,0,true,now(),now())
    ON CONFLICT(user_id) DO UPDATE SET options=EXCLUDED.options,multiplier=NULL,base_bet=EXCLUDED.base_bet,spins_remaining=0,total=0,pending_pick=true,updated_at=now();
  END IF;

  UPDATE public.profiles SET slot_czk=next_slot WHERE id=uid;
  RETURN jsonb_build_object('grid',grid,'line_wins',line_wins,'scatter_count',scatter_count,'scatter_amount',scatter_amount,'scatter_cells',CASE WHEN scatter_count>=3 THEN scatter_cells ELSE '[]'::jsonb END,'total',total,'multiplier_of_bet',CASE WHEN base_bet>0 THEN round(total/base_bet,2) ELSE 0 END,'free_spins_triggered',(scatter_count>=3 AND NOT is_free),'bonus_options',CASE WHEN scatter_count>=3 AND NOT is_free THEN bonus_options ELSE '[]'::jsonb END,'free_spins_left',free_left,'bonus_total',bonus_total,'bonus_done',bonus_done,'slot_czk',next_slot);
END;
$$;

REVOKE ALL ON FUNCTION public.slot_spin(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.slot_spin(numeric) TO authenticated;
