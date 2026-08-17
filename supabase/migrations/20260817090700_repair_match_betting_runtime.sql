-- Repair production match betting runtime: the app calls place_market_bet,
-- but the function was missing from the live database.
-- This migration mirrors the live repair applied to the connected database.

CREATE TABLE IF NOT EXISTS public.wallet_betting_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  kind text NOT NULL CHECK (kind IN ('bet_payout','bet_refund')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_betting_ledger_once ON public.wallet_betting_ledger(user_id,match_id,kind);
ALTER TABLE public.wallet_betting_ledger ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.wallet_betting_credit(_user_id uuid,_amount numeric,_reason text DEFAULT 'bet_settlement',_match_id uuid DEFAULT NULL)
RETURNS numeric LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_balance numeric; v_kind text;
BEGIN
  IF _user_id IS NULL OR _amount IS NULL OR _amount<=0 OR _amount>100000 THEN RAISE EXCEPTION 'invalid_wallet_credit'; END IF;
  v_kind:=CASE WHEN _reason='bet_refund' THEN 'bet_refund' ELSE 'bet_payout' END;
  IF _match_id IS NOT NULL THEN
    INSERT INTO public.wallet_betting_ledger(user_id,match_id,amount,kind)
    VALUES(_user_id,_match_id,round(_amount,2),v_kind)
    ON CONFLICT(user_id,match_id,kind) DO NOTHING;
    IF NOT FOUND THEN
      SELECT balance INTO v_balance FROM public.profiles WHERE id=_user_id;
      RETURN COALESCE(v_balance,0);
    END IF;
  END IF;
  SELECT balance INTO v_balance FROM public.profiles WHERE id=_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  v_balance:=round(v_balance+_amount,2);
  UPDATE public.profiles SET balance=v_balance,updated_at=now() WHERE id=_user_id;
  RETURN v_balance;
END; $$;
REVOKE ALL ON FUNCTION public.wallet_betting_credit(uuid,numeric,text,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.place_market_bet(_match_id uuid,_market_id text,_option_id text,_pick text,_amount numeric,_locked_odds numeric,_note text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); nick text; bal numeric; m record; new_bet jsonb; bet_id uuid:=gen_random_uuid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _market_id IS NULL OR length(trim(_market_id))=0 THEN RAISE EXCEPTION 'invalid_market'; END IF;
  IF _option_id IS NULL OR length(trim(_option_id))=0 THEN RAISE EXCEPTION 'invalid_option'; END IF;
  IF _pick NOT IN ('a','b','draw') THEN RAISE EXCEPTION 'invalid_pick'; END IF;
  IF _amount IS NULL OR _amount<1 OR _amount>250 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF _locked_odds IS NULL OR _locked_odds<1.05 OR _locked_odds>50 THEN RAISE EXCEPTION 'invalid_odds'; END IF;
  SELECT nickname,balance INTO nick,bal FROM public.profiles WHERE id=uid FOR UPDATE;
  IF nick IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  IF bal<_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
  SELECT id,ended_at,bets INTO m FROM public.matches WHERE id=_match_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF m.ended_at IS NOT NULL THEN RAISE EXCEPTION 'match_ended'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(m.bets,'[]'::jsonb)) b WHERE b->>'userId'=uid::text) THEN RAISE EXCEPTION 'already_bet'; END IF;
  PERFORM set_config('app.bypass_match_guard','on',true);
  new_bet:=jsonb_build_object('id',bet_id::text,'userId',uid::text,'bettor',nick,'pick',_pick,'amount',round(_amount,2),'marketId',trim(_market_id),'optionId',trim(_option_id),'lockedOdds',round(_locked_odds,2),'note',NULLIF(trim(_note),''),'status','open','payout',0,'createdAt',(extract(epoch from now())*1000)::bigint);
  UPDATE public.matches SET bets=COALESCE(bets,'[]'::jsonb)||jsonb_build_array(new_bet) WHERE id=_match_id;
  UPDATE public.profiles SET balance=round(balance-_amount,2),updated_at=now() WHERE id=uid;
  PERFORM set_config('app.bypass_match_guard','off',true);
  RETURN jsonb_build_object('bet_id',bet_id,'balance',round(bal-_amount,2),'locked_odds',round(_locked_odds,2));
EXCEPTION WHEN others THEN PERFORM set_config('app.bypass_match_guard','off',true); RAISE;
END; $$;
GRANT EXECUTE ON FUNCTION public.place_market_bet(uuid,text,text,text,numeric,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.place_bet(_match_id uuid,_pick text,_amount numeric,_note text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
SELECT public.place_market_bet(_match_id,'winner',CASE WHEN _pick='a' THEN 'win-a' WHEN _pick='b' THEN 'win-b' ELSE 'draw' END,_pick,_amount,1.95,_note);
$$;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid,text,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_match(_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE m record; b jsonb; out_bets jsonb:='[]'::jsonb; actual text; market text; opt text; amt numeric; odds numeric; uid uuid; won boolean; push boolean; payout numeric; sa int:=0; sb int:=0; line numeric; total numeric; diff numeric;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id=_match_id FOR UPDATE;
  IF m.id IS NULL OR m.ended_at IS NULL OR m.confirmed_at IS NULL OR COALESCE(jsonb_array_length(m.bets),0)=0 THEN RETURN; END IF;
  IF m.score_a>m.score_b THEN actual:='a'; ELSIF m.score_b>m.score_a THEN actual:='b'; ELSE SELECT count(*) INTO sa FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'a')::int>(s->>'b')::int; SELECT count(*) INTO sb FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'b')::int>(s->>'a')::int; actual:=CASE WHEN sa>sb THEN 'a' WHEN sb>sa THEN 'b' ELSE 'draw' END; END IF;
  FOR b IN SELECT value FROM jsonb_array_elements(COALESCE(m.bets,'[]'::jsonb)) LOOP
    IF COALESCE(b->>'status','open')<>'open' THEN out_bets:=out_bets||jsonb_build_array(b); CONTINUE; END IF;
    market:=COALESCE(b->>'marketId','winner'); opt:=COALESCE(b->>'optionId',''); amt:=COALESCE((b->>'amount')::numeric,0); odds:=COALESCE((b->>'lockedOdds')::numeric,1.95); uid:=NULLIF(b->>'userId','')::uuid; won:=false; push:=false; total:=COALESCE(m.score_a,0)+COALESCE(m.score_b,0); diff:=COALESCE(m.score_a,0)-COALESCE(m.score_b,0);
    IF market IN ('winner','h2h') THEN won:=CASE WHEN opt='win-a' THEN actual='a' WHEN opt='win-b' THEN actual='b' WHEN opt='draw' THEN actual='draw' ELSE false END;
    ELSIF market='totals' THEN line:=CASE WHEN opt IN('o15','u15') THEN 1.5 WHEN opt IN('o25','u25') THEN 2.5 WHEN opt IN('o35','u35') THEN 3.5 WHEN opt IN('o45','u45') THEN 4.5 WHEN opt IN('o55','u55') THEN 5.5 WHEN opt IN('pts-o155.5','pts-u155.5') THEN 155.5 WHEN opt IN('pts-o175.5','pts-u175.5') THEN 175.5 ELSE NULL END; IF line IS NOT NULL THEN won:=CASE WHEN left(opt,1)='o' OR opt LIKE 'pts-o%' THEN total>line ELSE total<line END; push:=total=line; END IF;
    ELSIF market='btts' THEN won:=CASE WHEN opt='btts-yes' THEN m.score_a>0 AND m.score_b>0 WHEN opt='btts-no' THEN NOT(m.score_a>0 AND m.score_b>0) ELSE false END;
    ELSIF market='cs' THEN won:=opt='cs-'||m.score_a::text||'-'||m.score_b::text;
    ELSIF market IN('handicap','puckline') THEN line:=CASE WHEN opt LIKE 'spread-a-%' THEN regexp_replace(opt,'^spread-a-','')::numeric WHEN opt LIKE 'spread-b-%' THEN regexp_replace(opt,'^spread-b-','')::numeric*-1 WHEN opt LIKE 'pl-a-%' THEN regexp_replace(opt,'^pl-a-','')::numeric WHEN opt LIKE 'pl-b-%' THEN regexp_replace(opt,'^pl-b-','')::numeric*-1 ELSE NULL END; IF line IS NOT NULL THEN IF opt LIKE 'spread-a-%' OR opt LIKE 'pl-a-%' THEN won:=diff+line>0; ELSE won:=diff+line<0; END IF; push:=diff+line=0; END IF;
    ELSIF market='exact-sets' THEN won:=opt='s-'||sa::text||'-'||sb::text;
    ELSIF market='set-handicap' THEN line:=CASE WHEN opt LIKE 'gh-a-%' THEN regexp_replace(opt,'^gh-a-','')::numeric WHEN opt LIKE 'gh-b-%' THEN regexp_replace(opt,'^gh-b-','')::numeric*-1 ELSE NULL END; IF line IS NOT NULL THEN IF opt LIKE 'gh-a-%' THEN won:=(sa-sb)+line>0; ELSE won:=(sa-sb)+line<0; END IF; push:=(sa-sb)+line=0; END IF;
    END IF;
    IF push THEN payout:=round(amt,2); PERFORM public.wallet_betting_credit(uid,payout,'bet_refund',_match_id); b:=b||jsonb_build_object('status','refunded','payout',payout); ELSIF won THEN payout:=round(amt*odds,2); PERFORM public.wallet_betting_credit(uid,payout,'bet_payout',_match_id); b:=b||jsonb_build_object('status','won','payout',payout); ELSE b:=b||jsonb_build_object('status','lost','payout',0); END IF;
    out_bets:=out_bets||jsonb_build_array(b);
  END LOOP;
  UPDATE public.matches SET bets=out_bets WHERE id=_match_id;
END; $$;
REVOKE ALL ON FUNCTION public.settle_match(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.trg_match_settle() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN IF NEW.confirmed_at IS NOT NULL AND OLD.confirmed_at IS NULL AND NEW.ended_at IS NOT NULL THEN PERFORM public.settle_match(NEW.id); END IF; RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS match_settle_trigger ON public.matches;
DROP TRIGGER IF EXISTS matches_settle ON public.matches;
DROP TRIGGER IF EXISTS match_settle_after_confirm ON public.matches;
CREATE TRIGGER match_settle_after_confirm AFTER UPDATE OF confirmed_at ON public.matches FOR EACH ROW WHEN (NEW.confirmed_at IS NOT NULL AND OLD.confirmed_at IS NULL AND NEW.ended_at IS NOT NULL) EXECUTE FUNCTION public.trg_match_settle();
