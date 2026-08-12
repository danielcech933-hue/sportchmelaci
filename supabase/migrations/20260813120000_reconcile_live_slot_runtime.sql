-- Reconcile the live Chmelovci Cup slot runtime with the hardened client contract.
-- Safe to run after older slot migrations.

ALTER TABLE public.slot_bonus_sessions
  ADD COLUMN IF NOT EXISTS base_bet numeric(12,2);

ALTER TABLE public.slot_sessions
  DROP CONSTRAINT IF EXISTS slot_sessions_bet_amount_check;

ALTER TABLE public.slot_sessions
  ADD CONSTRAINT slot_sessions_bet_amount_check
  CHECK (bet_amount >= 0);

CREATE OR REPLACE FUNCTION public.slot_normalize_bonus_options()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
DECLARE
  item jsonb;
  normalized jsonb := '[]'::jsonb;
  fallback jsonb := jsonb_build_array(
    jsonb_build_object('spins',10,'mult',1),
    jsonb_build_object('spins',20,'mult',2),
    jsonb_build_object('spins',50,'mult',4),
    jsonb_build_object('spins',25,'mult',3),
    jsonb_build_object('spins',35,'mult',5)
  );
  candidate jsonb;
BEGIN
  IF NEW.pending_pick AND jsonb_typeof(NEW.options)='array' THEN
    FOR item IN SELECT value FROM jsonb_array_elements(NEW.options) LOOP
      IF jsonb_typeof(item)='object'
         AND item ? 'spins' AND item ? 'mult'
         AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(normalized) e WHERE e->>'mult'=item->>'mult') THEN
        normalized := normalized || jsonb_build_array(item);
      END IF;
    END LOOP;
    FOR candidate IN SELECT value FROM jsonb_array_elements(fallback) LOOP
      EXIT WHEN jsonb_array_length(normalized)>=3;
      IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(normalized) e WHERE e->>'mult'=candidate->>'mult') THEN
        normalized := normalized || jsonb_build_array(candidate);
      END IF;
    END LOOP;
    NEW.options := normalized;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_slot_bonus_unique_options ON public.slot_bonus_sessions;
CREATE TRIGGER trg_slot_bonus_unique_options
BEFORE INSERT OR UPDATE OF options, pending_pick
ON public.slot_bonus_sessions
FOR EACH ROW EXECUTE FUNCTION public.slot_normalize_bonus_options();

CREATE OR REPLACE FUNCTION public.slot_pick_bonus(_multiplier numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  sess public.slot_bonus_sessions%ROWTYPE;
  opt jsonb;
  matches integer := 0;
  spins integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _multiplier IS NULL OR _multiplier <= 0 THEN RAISE EXCEPTION 'invalid_bonus_pick'; END IF;
  SELECT * INTO sess FROM public.slot_bonus_sessions WHERE user_id=uid FOR UPDATE;
  IF NOT FOUND OR NOT sess.pending_pick THEN RAISE EXCEPTION 'no_bonus_pick'; END IF;
  FOR opt IN SELECT value FROM jsonb_array_elements(COALESCE(sess.options,'[]'::jsonb)) LOOP
    IF (opt->>'mult')::numeric=_multiplier THEN
      matches := matches + 1;
      spins := (opt->>'spins')::integer;
    END IF;
  END LOOP;
  IF matches <> 1 OR spins < 1 OR spins > 50 THEN RAISE EXCEPTION 'invalid_bonus_pick'; END IF;
  UPDATE public.slot_bonus_sessions
     SET multiplier=_multiplier,
         spins_remaining=spins,
         pending_pick=false,
         total=0,
         updated_at=now()
   WHERE user_id=uid;
  RETURN jsonb_build_object('ok',true,'spins',spins,'multiplier',_multiplier);
END;
$function$;

CREATE OR REPLACE FUNCTION public.slot_spin(_bet numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  p_slot numeric;
  b public.slot_bonus_sessions%ROWTYPE;
  bonus_bet numeric := 0;
  is_free boolean := false;
  mult numeric := 1;
  grid text[][] := ARRAY[
    ARRAY['','',''], ARRAY['','',''], ARRAY['','',''], ARRAY['','',''], ARRAY['','','']
  ];
  weights integer[] := ARRAY[16,15,14,13,12,10,9,6,4,5,4];
  symbols text[] := ARRAY['ten','j','q','k','a','whistle','boots','silver','gold','wild','scatter'];
  reel integer; row integer; pick integer; r integer; total_weight integer;
  line integer; count integer; base text; sym text; pay numeric; amount numeric;
  line_wins jsonb := '[]'::jsonb;
  scatter_cells jsonb := '[]'::jsonb;
  scatter_count integer := 0;
  scatter_amount numeric := 0;
  total numeric := 0;
  session_id uuid;
  options jsonb := '[]'::jsonb;
  free_left integer := 0;
  bonus_total numeric := 0;
  bonus_done boolean := false;
  line_rows integer[][] := ARRAY[
    ARRAY[1,1,1,1,1], ARRAY[0,0,0,0,0], ARRAY[2,2,2,2,2], ARRAY[0,1,2,1,0], ARRAY[2,1,0,1,2]
  ];
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _bet IS NULL OR _bet < 0 OR _bet > 500 OR round(_bet,2) <> _bet THEN RAISE EXCEPTION 'invalid_slot_bet'; END IF;

  SELECT * INTO b FROM public.slot_bonus_sessions WHERE user_id=uid FOR UPDATE;
  IF FOUND AND b.pending_pick THEN RAISE EXCEPTION 'bonus_pick_required'; END IF;
  IF FOUND AND b.spins_remaining > 0 THEN
    is_free := true;
    mult := COALESCE(b.multiplier,1);
    free_left := b.spins_remaining;
    bonus_total := b.total;
    IF _bet <> 0 THEN RAISE EXCEPTION 'invalid_free_spin_bet'; END IF;
    bonus_bet := COALESCE(b.base_bet,0);
    IF bonus_bet <= 0 THEN
      SELECT bet_amount INTO bonus_bet
        FROM public.slot_sessions
       WHERE user_id=uid AND bet_amount>0
       ORDER BY created_at DESC LIMIT 1;
    END IF;
    IF bonus_bet IS NULL OR bonus_bet <= 0 THEN RAISE EXCEPTION 'bonus_bet_missing'; END IF;
  ELSE
    IF _bet <= 0 THEN RAISE EXCEPTION 'invalid_slot_bet'; END IF;
    SELECT slot_czk INTO p_slot FROM public.profiles WHERE id=uid FOR UPDATE;
    IF p_slot IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
    IF p_slot < _bet THEN RAISE EXCEPTION 'insufficient_slot'; END IF;
    bonus_bet := _bet;
  END IF;

  total_weight := 0;
  FOR r IN 1..11 LOOP total_weight := total_weight + weights[r]; END LOOP;

  FOR reel IN 1..5 LOOP
    FOR row IN 1..3 LOOP
      pick := floor(random()*total_weight)::integer + 1;
      r := 1;
      WHILE pick > weights[r] LOOP
        pick := pick - weights[r];
        r := r + 1;
      END LOOP;
      grid[reel][row] := symbols[r];
    END LOOP;
  END LOOP;

  FOR reel IN 1..5 LOOP
    FOR row IN 1..3 LOOP
      IF grid[reel][row]='scatter' THEN
        scatter_count:=scatter_count+1;
        scatter_cells:=scatter_cells || jsonb_build_array(jsonb_build_array(reel-1,row-1));
      END IF;
    END LOOP;
  END LOOP;

  FOR line IN 1..5 LOOP
    base := NULL; count := 0;
    FOR reel IN 1..5 LOOP
      sym := grid[reel][line_rows[line][reel]];
      IF sym <> 'wild' AND sym <> 'scatter' THEN base := sym; EXIT; END IF;
    END LOOP;
    IF base IS NOT NULL THEN
      FOR reel IN 1..5 LOOP
        sym := grid[reel][line_rows[line][reel]];
        IF sym=base OR sym='wild' THEN count:=count+1; ELSE EXIT; END IF;
      END LOOP;
      IF count>=3 THEN
        pay := CASE base
          WHEN 'ten' THEN CASE count WHEN 3 THEN .4 WHEN 4 THEN 1 ELSE 2.5 END
          WHEN 'j' THEN CASE count WHEN 3 THEN .5 WHEN 4 THEN 1.2 ELSE 3 END
          WHEN 'q' THEN CASE count WHEN 3 THEN .6 WHEN 4 THEN 1.5 ELSE 4 END
          WHEN 'k' THEN CASE count WHEN 3 THEN .8 WHEN 4 THEN 2 ELSE 5 END
          WHEN 'a' THEN CASE count WHEN 3 THEN 1 WHEN 4 THEN 2.5 ELSE 6 END
          WHEN 'whistle' THEN CASE count WHEN 3 THEN 1.5 WHEN 4 THEN 4 ELSE 10 END
          WHEN 'boots' THEN CASE count WHEN 3 THEN 2 WHEN 4 THEN 6 ELSE 15 END
          WHEN 'silver' THEN CASE count WHEN 3 THEN 5 WHEN 4 THEN 15 ELSE 40 END
          WHEN 'gold' THEN CASE count WHEN 3 THEN 15 WHEN 4 THEN 40 ELSE 100 END
          ELSE 0 END;
        amount:=round(bonus_bet*pay*mult,2);
        IF amount>0 THEN
          line_wins := line_wins || jsonb_build_array(jsonb_build_object('line',line-1,'symbol',base,'count',count,'amount',amount,'cells',(SELECT jsonb_agg(jsonb_build_array(x-1,line_rows[line][x]-1)) FROM generate_series(1,count) x)));
          total:=total+amount;
        END IF;
      END IF;
    END IF;
  END LOOP;

  IF scatter_count>=3 THEN
    scatter_amount:=round(bonus_bet*(CASE WHEN scatter_count>=5 THEN 100 WHEN scatter_count=4 THEN 20 ELSE 5 END)*mult,2);
    total:=total+scatter_amount;
  END IF;
  total:=round(total,2);

  IF is_free THEN
    bonus_total:=round(bonus_total+total,2);
    free_left:=free_left-1;
    bonus_done:=free_left=0;
    UPDATE public.slot_bonus_sessions SET spins_remaining=free_left,total=bonus_total,updated_at=now() WHERE user_id=uid;
    SELECT slot_czk INTO p_slot FROM public.profiles WHERE id=uid;
  ELSE
    p_slot:=round(p_slot-_bet+total,2);
    UPDATE public.profiles SET slot_czk=p_slot,updated_at=now() WHERE id=uid;
    IF scatter_count>=3 THEN
      options:=jsonb_build_array(jsonb_build_object('spins',10,'mult',1),jsonb_build_object('spins',20,'mult',2),jsonb_build_object('spins',50,'mult',4));
      INSERT INTO public.slot_bonus_sessions(user_id,options,multiplier,base_bet,spins_remaining,total,pending_pick,created_at,updated_at)
      VALUES(uid,options,NULL,_bet,0,0,true,now(),now())
      ON CONFLICT(user_id) DO UPDATE SET options=EXCLUDED.options,multiplier=NULL,base_bet=EXCLUDED.base_bet,spins_remaining=0,total=0,pending_pick=true,updated_at=now();
    END IF;
  END IF;

  INSERT INTO public.slot_sessions(user_id,bet_amount,status,result,completed_at)
  VALUES(uid,CASE WHEN is_free THEN 0 ELSE _bet END,'completed',jsonb_build_object('grid',to_jsonb(grid),'line_wins',line_wins,'scatter_count',scatter_count,'scatter_amount',scatter_amount,'scatter_cells',scatter_cells,'total',total,'multiplier_of_bet',CASE WHEN bonus_bet>0 THEN total/bonus_bet ELSE 0 END,'free_spins_triggered',NOT is_free AND scatter_count>=3,'bonus_options',options,'free_spins_left',free_left,'bonus_total',bonus_total,'bonus_done',bonus_done,'slot_czk',p_slot),now())
  RETURNING id INTO session_id;

  RETURN jsonb_build_object('session_id',session_id,'grid',to_jsonb(grid),'line_wins',line_wins,'scatter_count',scatter_count,'scatter_amount',scatter_amount,'scatter_cells',scatter_cells,'total',total,'multiplier_of_bet',CASE WHEN bonus_bet>0 THEN total/bonus_bet ELSE 0 END,'free_spins_triggered',NOT is_free AND scatter_count>=3,'bonus_options',options,'free_spins_left',free_left,'bonus_total',bonus_total,'bonus_done',bonus_done,'slot_czk',p_slot);
END;
$function$;

REVOKE ALL ON FUNCTION public.slot_spin(numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.slot_pick_bonus(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.slot_spin(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.slot_pick_bonus(numeric) TO authenticated;
REVOKE ALL ON FUNCTION public.slot_normalize_bonus_options() FROM PUBLIC, anon, authenticated;

-- Normalize already pending sessions through the trigger.
UPDATE public.slot_bonus_sessions
SET options=options, updated_at=now()
WHERE pending_pick=true;