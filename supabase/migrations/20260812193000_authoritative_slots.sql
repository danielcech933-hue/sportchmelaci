-- Phase 1 security: server-authoritative slot engine.
-- The browser no longer decides the reel result, payout, free-spin count or multiplier.

CREATE TABLE IF NOT EXISTS public.slot_bonus_sessions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  multiplier numeric(8,2),
  spins_remaining integer NOT NULL DEFAULT 0,
  total numeric(14,2) NOT NULL DEFAULT 0,
  pending_pick boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.slot_bonus_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.slot_bonus_sessions FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.slot_random_symbol()
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  r integer := floor(random() * 108)::integer + 1;
BEGIN
  IF r <= 16 THEN RETURN 'ten';
  ELSIF r <= 31 THEN RETURN 'j';
  ELSIF r <= 45 THEN RETURN 'q';
  ELSIF r <= 58 THEN RETURN 'k';
  ELSIF r <= 70 THEN RETURN 'a';
  ELSIF r <= 80 THEN RETURN 'whistle';
  ELSIF r <= 89 THEN RETURN 'boots';
  ELSIF r <= 95 THEN RETURN 'silver';
  ELSIF r <= 99 THEN RETURN 'gold';
  ELSIF r <= 104 THEN RETURN 'wild';
  ELSE RETURN 'scatter';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.slot_pay(_symbol text, _count integer)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF _count < 3 OR _count > 5 THEN RETURN 0; END IF;
  CASE _symbol
    WHEN 'ten' THEN RETURN ARRAY[0.4,1,2.5]::numeric[][_count-2];
    WHEN 'j' THEN RETURN ARRAY[0.5,1.2,3]::numeric[][_count-2];
    WHEN 'q' THEN RETURN ARRAY[0.6,1.5,4]::numeric[][_count-2];
    WHEN 'k' THEN RETURN ARRAY[0.8,2,5]::numeric[][_count-2];
    WHEN 'a' THEN RETURN ARRAY[1,2.5,6]::numeric[][_count-2];
    WHEN 'whistle' THEN RETURN ARRAY[1.5,4,10]::numeric[][_count-2];
    WHEN 'boots' THEN RETURN ARRAY[2,6,15]::numeric[][_count-2];
    WHEN 'silver' THEN RETURN ARRAY[5,15,40]::numeric[][_count-2];
    WHEN 'gold' THEN RETURN ARRAY[15,40,100]::numeric[][_count-2];
    ELSE RETURN 0;
  END CASE;
END;
$$;

CREATE OR REPLACE FUNCTION public.slot_pick_bonus(_multiplier numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  sess public.slot_bonus_sessions%ROWTYPE;
  opt jsonb;
  valid boolean := false;
  spins integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _multiplier IS NULL OR _multiplier <= 0 THEN RAISE EXCEPTION 'invalid_bonus_pick'; END IF;

  SELECT * INTO sess FROM public.slot_bonus_sessions WHERE user_id = uid FOR UPDATE;
  IF NOT FOUND OR NOT sess.pending_pick THEN RAISE EXCEPTION 'no_bonus_pick'; END IF;

  FOR opt IN SELECT value FROM jsonb_array_elements(sess.options)
  LOOP
    IF (opt->>'mult')::numeric = _multiplier THEN
      valid := true;
      spins := (opt->>'spins')::integer;
      EXIT;
    END IF;
  END LOOP;

  IF NOT valid OR spins < 1 OR spins > 50 THEN RAISE EXCEPTION 'invalid_bonus_pick'; END IF;

  UPDATE public.slot_bonus_sessions
     SET multiplier = _multiplier,
         spins_remaining = spins,
         pending_pick = false,
         updated_at = now()
   WHERE user_id = uid;

  RETURN jsonb_build_object('ok', true, 'spins', spins, 'multiplier', _multiplier);
END;
$$;

CREATE OR REPLACE FUNCTION public.slot_spin(_bet numeric DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  bal numeric;
  slot_bal numeric;
  sess public.slot_bonus_sessions%ROWTYPE;
  is_free boolean := false;
  bonus_mult numeric := 1;
  next_slot numeric;
  sym text;
  base text;
  s text;
  cnt integer;
  line_amount numeric;
  total numeric := 0;
  scatter_count integer := 0;
  scatter_amount numeric := 0;
  scatter_cells jsonb := '[]'::jsonb;
  line_wins jsonb := '[]'::jsonb;
  grid jsonb := '[]'::jsonb;
  col jsonb;
  cells jsonb;
  row integer;
  reel integer;
  line_idx integer;
  first_reel integer;
  r0 integer;
  r1 integer;
  r2 integer;
  r3 integer;
  r4 integer;
  payout numeric;
  bonus_options jsonb := '[]'::jsonb;
  bonus_done boolean := false;
  free_left integer := 0;
  bonus_total numeric := 0;
  opts jsonb;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT balance, slot_czk INTO bal, slot_bal
    FROM public.profiles WHERE id = uid FOR UPDATE;
  IF bal IS NULL OR slot_bal IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;

  SELECT * INTO sess FROM public.slot_bonus_sessions WHERE user_id = uid FOR UPDATE;
  IF FOUND THEN
    IF sess.pending_pick THEN RAISE EXCEPTION 'bonus_pick_required'; END IF;
    IF sess.spins_remaining > 0 THEN
      is_free := true;
      bonus_mult := COALESCE(sess.multiplier,1);
    END IF;
  END IF;

  IF is_free THEN
    IF COALESCE(_bet,0) <> 0 THEN RAISE EXCEPTION 'invalid_free_spin_bet'; END IF;
  ELSE
    IF _bet IS NULL OR _bet NOT IN (5,10,20,50,100,200,500) THEN RAISE EXCEPTION 'invalid_slot_bet'; END IF;
    IF slot_bal < _bet THEN RAISE EXCEPTION 'insufficient_slot'; END IF;
    slot_bal := slot_bal - _bet;
  END IF;

  -- Generate 5 x 3 grid on the server.
  FOR reel IN 1..5 LOOP
    col := '[]'::jsonb;
    FOR row IN 1..3 LOOP
      sym := public.slot_random_symbol();
      col := col || to_jsonb(sym);
      IF sym = 'scatter' THEN
        scatter_count := scatter_count + 1;
        scatter_cells := scatter_cells || jsonb_build_array(jsonb_build_array(reel-1,row-1));
      END IF;
    END LOOP;
    grid := grid || jsonb_build_array(col);
  END LOOP;

  -- Five paylines: center, top, bottom, V, inverted V.
  FOR line_idx IN 1..5 LOOP
    r0 := CASE line_idx WHEN 1 THEN 2 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 1 ELSE 3 END;
    r1 := CASE line_idx WHEN 1 THEN 2 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 2 ELSE 2 END;
    r2 := CASE line_idx WHEN 1 THEN 2 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 3 ELSE 1 END;
    r3 := CASE line_idx WHEN 1 THEN 2 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 2 ELSE 2 END;
    r4 := CASE line_idx WHEN 1 THEN 2 WHEN 2 THEN 1 WHEN 3 THEN 3 WHEN 4 THEN 1 ELSE 3 END;

    base := NULL;
    FOR reel IN 1..5 LOOP
      row := CASE reel WHEN 1 THEN r0 WHEN 2 THEN r1 WHEN 3 THEN r2 WHEN 4 THEN r3 ELSE r4 END;
      s := grid->(reel-1)->>(row-1);
      IF s <> 'wild' THEN
        base := s;
        EXIT;
      END IF;
    END LOOP;

    IF base IS NULL OR base = 'scatter' THEN CONTINUE; END IF;

    cnt := 0;
    cells := '[]'::jsonb;
    FOR reel IN 1..5 LOOP
      row := CASE reel WHEN 1 THEN r0 WHEN 2 THEN r1 WHEN 3 THEN r2 WHEN 4 THEN r3 ELSE r4 END;
      s := grid->(reel-1)->>(row-1);
      IF s = base OR s = 'wild' THEN
        cnt := cnt + 1;
        cells := cells || jsonb_build_array(jsonb_build_array(reel-1,row-1));
      ELSE
        EXIT;
      END IF;
    END LOOP;

    IF cnt >= 3 THEN
      payout := public.slot_pay(base,cnt);
      line_amount := round(payout * _bet * bonus_mult, 2);
      IF line_amount > 0 THEN
        total := total + line_amount;
        line_wins := line_wins || jsonb_build_array(jsonb_build_object(
          'line', line_idx-1,
          'symbol', base,
          'count', cnt,
          'amount', line_amount,
          'cells', cells
        ));
      END IF;
    END IF;
  END LOOP;

  IF scatter_count >= 3 THEN
    payout := CASE LEAST(scatter_count,5)
      WHEN 3 THEN 5
      WHEN 4 THEN 20
      ELSE 100
    END;
    scatter_amount := round(payout * _bet * bonus_mult, 2);
    total := total + scatter_amount;
  END IF;

  total := round(total,2);
  next_slot := round(slot_bal + total,2);

  IF is_free THEN
    UPDATE public.slot_bonus_sessions
       SET spins_remaining = spins_remaining - 1,
           total = round(total + public.slot_bonus_sessions.total,2),
           updated_at = now()
     WHERE user_id = uid;

    SELECT spins_remaining, total INTO free_left, bonus_total
      FROM public.slot_bonus_sessions WHERE user_id = uid;
    IF free_left <= 0 THEN
      bonus_done := true;
      DELETE FROM public.slot_bonus_sessions WHERE user_id = uid;
      free_left := 0;
    END IF;
  ELSIF scatter_count >= 3 THEN
    -- Server chooses three bonus options; the browser only displays them.
    SELECT jsonb_agg(jsonb_build_object('spins',spins,'mult',mult) ORDER BY random())
      INTO bonus_options
      FROM (
        SELECT * FROM (VALUES
          (10,2::numeric),(15,3::numeric),(20,2::numeric),
          (25,4::numeric),(30,3::numeric),(50,8::numeric)
        ) AS v(spins,mult)
        ORDER BY random() LIMIT 3
      ) q;

    INSERT INTO public.slot_bonus_sessions(user_id,options,pending_pick,total,created_at,updated_at)
      VALUES(uid,COALESCE(bonus_options,'[]'::jsonb),true,0,now(),now())
      ON CONFLICT (user_id) DO UPDATE SET options=EXCLUDED.options,pending_pick=true,
        multiplier=NULL,spins_remaining=0,total=0,updated_at=now();
  END IF;

  UPDATE public.profiles SET slot_czk = next_slot WHERE id = uid;

  RETURN jsonb_build_object(
    'grid', grid,
    'line_wins', line_wins,
    'scatter_count', scatter_count,
    'scatter_amount', scatter_amount,
    'scatter_cells', CASE WHEN scatter_count >= 3 THEN scatter_cells ELSE '[]'::jsonb END,
    'total', total,
    'multiplier_of_bet', CASE WHEN _bet > 0 THEN round(total/_bet,2) ELSE 0 END,
    'free_spins_triggered', (scatter_count >= 3 AND NOT is_free),
    'bonus_options', CASE WHEN scatter_count >= 3 AND NOT is_free THEN bonus_options ELSE '[]'::jsonb END,
    'free_spins_left', free_left,
    'bonus_total', bonus_total,
    'bonus_done', bonus_done,
    'slot_czk', next_slot
  );
END;
$$;

REVOKE ALL ON FUNCTION public.slot_random_symbol() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.slot_pay(text,integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.slot_pick_bonus(numeric) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.slot_spin(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.slot_pick_bonus(numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.slot_spin(numeric) TO authenticated;

-- The old generic wallet RPC is now only for exchanges and the protected daily bonus.
CREATE OR REPLACE FUNCTION public.wallet_apply(
  _delta_dollars numeric DEFAULT 0,
  _delta_slot_czk numeric DEFAULT 0,
  _reason text DEFAULT 'wallet_adjustment'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  bal numeric;
  slot_bal numeric;
  expected numeric;
  next_balance numeric;
  next_slot numeric;
  last_bonus timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _reason NOT IN ('exchange_to_slot','exchange_to_dollars','daily_bonus') THEN RAISE EXCEPTION 'invalid_wallet_reason'; END IF;

  SELECT balance, slot_czk INTO bal, slot_bal FROM public.profiles WHERE id=uid FOR UPDATE;
  IF bal IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;

  IF _reason='exchange_to_slot' THEN
    IF _delta_dollars >= 0 OR _delta_slot_czk <= 0 OR mod(_delta_dollars,1)<>0
      OR _delta_slot_czk <> abs(_delta_dollars)*100 OR abs(_delta_dollars)>1000 THEN
      RAISE EXCEPTION 'invalid_exchange';
    END IF;
  ELSIF _reason='exchange_to_dollars' THEN
    IF _delta_dollars <= 0 OR _delta_slot_czk >= 0 OR mod(_delta_dollars,1)<>0
      OR abs(_delta_slot_czk) <> _delta_dollars*100 OR _delta_dollars>1000 THEN
      RAISE EXCEPTION 'invalid_exchange';
    END IF;
  ELSE
    IF _delta_slot_czk<>0 OR _delta_dollars NOT IN (5,10,20,50) THEN RAISE EXCEPTION 'invalid_daily_bonus'; END IF;
    SELECT last_claim_at INTO last_bonus FROM public.wallet_bonus_claims WHERE user_id=uid FOR UPDATE;
    IF last_bonus IS NOT NULL AND last_bonus > now()-interval '8 hours' THEN RAISE EXCEPTION 'daily_bonus_cooldown'; END IF;
    INSERT INTO public.wallet_bonus_claims(user_id,last_claim_at) VALUES(uid,now())
      ON CONFLICT(user_id) DO UPDATE SET last_claim_at=EXCLUDED.last_claim_at;
  END IF;

  next_balance:=round(bal+COALESCE(_delta_dollars,0),2);
  next_slot:=round(slot_bal+COALESCE(_delta_slot_czk,0),2);
  IF next_balance<0 THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  IF next_slot<0 THEN RAISE EXCEPTION 'insufficient_slot'; END IF;
  UPDATE public.profiles SET balance=next_balance,slot_czk=next_slot WHERE id=uid;
  RETURN jsonb_build_object('balance',next_balance,'slot_czk',next_slot);
END;
$$;

REVOKE ALL ON FUNCTION public.wallet_apply(numeric,numeric,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.wallet_apply(numeric,numeric,text) TO authenticated;
