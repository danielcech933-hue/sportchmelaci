-- Casino integrity guards
-- Production behavior applied during QA pass; keep this migration as the canonical source.

CREATE TABLE IF NOT EXISTS public.roulette_settlement_ledger (
  round_no bigint PRIMARY KEY,
  result integer NOT NULL,
  paid numeric NOT NULL DEFAULT 0,
  settled_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.roulette_settle(_round_no bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE res integer; b record; win boolean; mult numeric; cur bigint:=floor(extract(epoch from now())/15)::bigint; reds integer[]:=ARRAY[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]; paid numeric:=0; nums int[]; prior public.roulette_settlement_ledger%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _round_no>=cur THEN RAISE EXCEPTION 'round_not_finished'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('roulette-settle:'||_round_no::text,903));
  SELECT * INTO prior FROM public.roulette_settlement_ledger WHERE round_no=_round_no;
  IF FOUND THEN RETURN jsonb_build_object('result',prior.result,'paid',prior.paid,'already_settled',true); END IF;
  res:=public.roulette_result(_round_no);
  INSERT INTO public.roulette_rounds(round_no,result) VALUES(_round_no,res) ON CONFLICT(round_no) DO NOTHING;
  FOR b IN SELECT * FROM public.roulette_bets WHERE round_no=_round_no AND settled=false FOR UPDATE LOOP
    win:=false; mult:=0;
    IF b.bet_type='red' THEN win:=res=ANY(reds); mult:=2;
    ELSIF b.bet_type='black' THEN win:=res<>0 AND NOT(res=ANY(reds)); mult:=2;
    ELSIF b.bet_type='green' THEN win:=res=0; mult:=36;
    ELSIF b.bet_type='even' THEN win:=res<>0 AND res%2=0; mult:=2;
    ELSIF b.bet_type='odd' THEN win:=res%2=1; mult:=2;
    ELSIF b.bet_type='low' THEN win:=res BETWEEN 1 AND 18; mult:=2;
    ELSIF b.bet_type='high' THEN win:=res BETWEEN 19 AND 36; mult:=2;
    ELSIF b.bet_type='dozen' THEN mult:=3; win:=res<>0 AND ((b.bet_value='1' AND res<=12) OR (b.bet_value='2' AND res BETWEEN 13 AND 24) OR (b.bet_value='3' AND res>=25));
    ELSIF b.bet_type='number' THEN win:=b.bet_value=res::text; mult:=36;
    ELSIF b.bet_type='corner' THEN nums:=ARRAY(SELECT trim(x)::int FROM unnest(string_to_array(replace(b.bet_value,' ',''),',')) x); win:=res=ANY(nums); mult:=9;
    END IF;
    UPDATE public.roulette_bets SET settled=true,payout=CASE WHEN win THEN b.amount*mult ELSE 0 END WHERE id=b.id;
    IF win THEN UPDATE public.profiles SET balance=balance+b.amount*mult,updated_at=now() WHERE id=b.user_id; paid:=paid+b.amount*mult; END IF;
  END LOOP;
  INSERT INTO public.roulette_settlement_ledger(round_no,result,paid) VALUES(_round_no,res,paid);
  RETURN jsonb_build_object('result',res,'paid',paid,'already_settled',false);
END;
$function$;

CREATE OR REPLACE FUNCTION public.roulette_place_bet(_round_no bigint,_bet_type text,_bet_value text,_amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE uid uuid:=auth.uid(); nick text; bal numeric; cur bigint:=floor(extract(epoch from now())/15)::bigint; nums int[]; vals text[];
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _round_no<>cur THEN RAISE EXCEPTION 'round_closed'; END IF;
  IF _bet_type NOT IN ('red','black','green','even','odd','low','high','dozen','number','corner') THEN RAISE EXCEPTION 'invalid_bet_type'; END IF;
  IF _amount IS NULL OR _amount<1 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||':'||_round_no::text,902));
  IF _bet_type='number' AND (_bet_value !~ '^(0|[1-9]|[1-2][0-9]|3[0-6])$') THEN RAISE EXCEPTION 'invalid_bet_value'; END IF;
  IF _bet_type='corner' THEN
    vals:=regexp_split_to_array(regexp_replace(coalesce(_bet_value,''),'\\s+','','g'),',');
    IF array_length(vals,1)<>4 THEN RAISE EXCEPTION 'invalid_corner'; END IF;
    BEGIN nums:=ARRAY(SELECT DISTINCT trim(x)::int FROM unnest(vals) x); EXCEPTION WHEN others THEN RAISE EXCEPTION 'invalid_corner'; END;
    IF array_length(nums,1)<>4 OR EXISTS(SELECT 1 FROM unnest(nums) n WHERE n<1 OR n>36) THEN RAISE EXCEPTION 'invalid_corner'; END IF;
    IF NOT EXISTS(SELECT 1 FROM unnest(nums) a JOIN unnest(nums) b ON b=a+1 JOIN unnest(nums) c ON c=a+3 JOIN unnest(nums) d ON d=b+3) THEN RAISE EXCEPTION 'invalid_corner'; END IF;
  END IF;
  SELECT nickname,balance INTO nick,bal FROM public.profiles WHERE id=uid FOR UPDATE;
  IF nick IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  IF bal<_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  UPDATE public.profiles SET balance=balance-_amount,updated_at=now() WHERE id=uid;
  INSERT INTO public.roulette_bets(round_no,user_id,nickname,bet_type,bet_value,amount) VALUES(_round_no,uid,nick,_bet_type,NULLIF(TRIM(COALESCE(_bet_value,'')),''),_amount);
  RETURN jsonb_build_object('ok',true,'balance',bal-_amount);
END;
$function$;
