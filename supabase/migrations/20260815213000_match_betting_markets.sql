-- Match betting: locked simulated sportsbook odds, multi-market tickets,
-- and settlement only after admin confirmation.

DROP TRIGGER IF EXISTS match_settle_trigger ON public.matches;
DROP TRIGGER IF EXISTS matches_settle ON public.matches;
DROP TRIGGER IF EXISTS match_settle_on_confirm ON public.matches;

CREATE TABLE IF NOT EXISTS public.wallet_betting_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  kind text NOT NULL CHECK (kind IN ('bet_payout','bet_refund')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS wallet_betting_ledger_once ON public.wallet_betting_ledger(user_id, match_id, kind);
CREATE INDEX IF NOT EXISTS wallet_betting_ledger_user_created ON public.wallet_betting_ledger(user_id, created_at DESC);
ALTER TABLE public.wallet_betting_ledger ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.wallet_betting_credit(
  _user_id uuid,
  _amount numeric,
  _reason text DEFAULT 'bet_settlement',
  _match_id uuid DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_balance numeric; v_kind text;
BEGIN
  IF _user_id IS NULL OR _amount IS NULL OR _amount <= 0 OR _amount > 100000 THEN RAISE EXCEPTION 'invalid_wallet_credit'; END IF;
  v_kind := CASE WHEN _reason = 'bet_refund' THEN 'bet_refund' ELSE 'bet_payout' END;
  IF _match_id IS NOT NULL THEN
    INSERT INTO public.wallet_betting_ledger(user_id,match_id,amount,kind)
    VALUES(_user_id,_match_id,round(_amount,2),v_kind)
    ON CONFLICT(user_id,match_id,kind) DO NOTHING;
    IF NOT FOUND THEN
      SELECT balance INTO v_balance FROM public.profiles WHERE id=_user_id;
      IF v_balance IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
      RETURN v_balance;
    END IF;
  END IF;
  SELECT balance INTO v_balance FROM public.profiles WHERE id=_user_id FOR UPDATE;
  IF v_balance IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  v_balance := round(v_balance + _amount,2);
  UPDATE public.profiles SET balance=v_balance,updated_at=now() WHERE id=_user_id;
  RETURN v_balance;
END; $$;
REVOKE ALL ON FUNCTION public.wallet_betting_credit(uuid,numeric,text,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.confirm_match(_match_id uuid,_confirm boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE uid uuid:=auth.uid(); m record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_role(uid,'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  SELECT id,ended_at,confirmed_at INTO m FROM public.matches WHERE id=_match_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF _confirm AND m.ended_at IS NULL THEN RAISE EXCEPTION 'match_not_finished'; END IF;
  PERFORM set_config('app.bypass_match_guard','on',true);
  IF _confirm THEN
    UPDATE public.matches SET confirmed_at=COALESCE(confirmed_at,now()),confirmed_by=uid WHERE id=_match_id;
  ELSE
    IF m.confirmed_at IS NOT NULL THEN RAISE EXCEPTION 'confirmed_match_cannot_be_unconfirmed'; END IF;
    UPDATE public.matches SET confirmed_at=NULL,confirmed_by=NULL WHERE id=_match_id;
  END IF;
  PERFORM set_config('app.bypass_match_guard','off',true);
END; $$;

CREATE OR REPLACE FUNCTION public.place_market_bet(
  _match_id uuid,
  _market_id text,
  _option_id text,
  _pick text,
  _amount numeric,
  _locked_odds numeric,
  _note text
)
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
  SELECT id,ended_at,confirmed_at,bets INTO m FROM public.matches WHERE id=_match_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF m.ended_at IS NOT NULL THEN RAISE EXCEPTION 'match_ended'; END IF;
  IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(m.bets,'[]'::jsonb)) b WHERE b->>'userId'=uid::text) THEN RAISE EXCEPTION 'already_bet'; END IF;
  PERFORM set_config('app.bypass_match_guard','on',true);
  new_bet:=jsonb_build_object(
    'id',bet_id::text,'userId',uid::text,'bettor',nick,'pick',_pick,
    'amount',round(_amount,2),'marketId',trim(_market_id),'optionId',trim(_option_id),
    'lockedOdds',round(_locked_odds,2),'note',NULLIF(trim(_note),''),'status','open','payout',0,
    'createdAt',(extract(epoch from now())*1000)::bigint
  );
  UPDATE public.matches SET bets=COALESCE(bets,'[]'::jsonb)||jsonb_build_array(new_bet) WHERE id=_match_id;
  UPDATE public.profiles SET balance=round(balance-_amount,2),updated_at=now() WHERE id=uid;
  PERFORM public.write_audit('bet.placed','bet',bet_id,_match_id,jsonb_build_object('market_id',_market_id,'option_id',_option_id,'odds',round(_locked_odds,2),'amount',_amount));
  PERFORM set_config('app.bypass_match_guard','off',true);
  RETURN jsonb_build_object('bet_id',bet_id,'balance',round(bal-_amount,2),'locked_odds',round(_locked_odds,2));
EXCEPTION WHEN others THEN PERFORM set_config('app.bypass_match_guard','off',true); RAISE;
END; $$;
REVOKE ALL ON FUNCTION public.place_market_bet(uuid,text,text,text,numeric,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.place_market_bet(uuid,text,text,text,numeric,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.place_bet(_match_id uuid,_pick text,_amount numeric,_note text)
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$
SELECT public.place_market_bet(_match_id,'winner',CASE WHEN _pick='a' THEN 'win-a' ELSE 'win-b' END,_pick,_amount,1.95,_note);
$$;
REVOKE ALL ON FUNCTION public.place_bet(uuid,text,numeric,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid,text,numeric,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.settle_match(_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE
  m record; b jsonb; updated_bets jsonb:='[]'::jsonb; actual_winner text;
  payout numeric; won boolean; push boolean; market_id text; option_id text;
  amt numeric; odds numeric; uid uuid; total_open integer:=0;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id=_match_id FOR UPDATE;
  IF m.id IS NULL OR m.ended_at IS NULL OR m.confirmed_at IS NULL THEN RETURN; END IF;
  IF COALESCE(jsonb_array_length(m.bets),0)=0 THEN RETURN; END IF;
  IF m.score_a>m.score_b THEN actual_winner:='a';
  ELSIF m.score_b>m.score_a THEN actual_winner:='b';
  ELSE
    DECLARE sa int:=0; sb int:=0;
    BEGIN
      SELECT count(*) INTO sa FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'a')::int>(s->>'b')::int;
      SELECT count(*) INTO sb FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'b')::int>(s->>'a')::int;
      IF sa>sb THEN actual_winner:='a'; ELSIF sb>sa THEN actual_winner:='b'; ELSE actual_winner:='draw'; END IF;
    END;
  END IF;

  FOR b IN SELECT value FROM jsonb_array_elements(m.bets) LOOP
    IF COALESCE(b->>'status','open')<>'open' THEN updated_bets:=updated_bets||jsonb_build_array(b); CONTINUE; END IF;
    total_open:=total_open+1;
    market_id:=COALESCE(b->>'marketId','winner');
    option_id:=COALESCE(b->>'optionId',CASE WHEN b->>'pick'='a' THEN 'win-a' ELSE 'win-b' END);
    amt:=COALESCE((b->>'amount')::numeric,0); odds:=COALESCE((b->>'lockedOdds')::numeric,1.95); uid:=NULLIF(b->>'userId','')::uuid;
    won:=false; push:=false;

    IF market_id IN('winner','h2h') THEN
      IF option_id='win-a' THEN won:=actual_winner='a'; ELSIF option_id='win-b' THEN won:=actual_winner='b'; ELSIF option_id='draw' THEN won:=actual_winner='draw'; END IF;
    ELSIF market_id='totals' THEN
      DECLARE t numeric:=m.score_a+m.score_b; line numeric;
      BEGIN
        line:=CASE WHEN option_id IN('o15','u15') THEN 1.5 WHEN option_id IN('o25','u25') THEN 2.5 WHEN option_id IN('o35','u35') THEN 3.5 WHEN option_id IN('o45','u45') THEN 4.5 WHEN option_id IN('o55','u55') THEN 5.5 WHEN option_id IN('o65','u65') THEN 6.5 WHEN option_id IN('pts-o155.5','pts-u155.5') THEN 155.5 WHEN option_id IN('pts-o175.5','pts-u175.5') THEN 175.5 ELSE NULL END;
        IF option_id LIKE 'o%' OR option_id LIKE 'pts-o%' THEN won:=line IS NOT NULL AND t>line; ELSE won:=line IS NOT NULL AND t<line; END IF;
        push:=line IS NOT NULL AND t=line;
      END;
    ELSIF market_id='btts' THEN
      IF option_id='btts-yes' THEN won:=m.score_a>0 AND m.score_b>0; ELSIF option_id='btts-no' THEN won:=NOT(m.score_a>0 AND m.score_b>0); END IF;
    ELSIF market_id='cs' THEN
      won:=option_id='cs-'||m.score_a::text||'-'||m.score_b::text;
    ELSIF market_id IN('handicap','spread','puckline') THEN
      DECLARE adj numeric; diff numeric:=m.score_a-m.score_b;
      BEGIN
        adj:=CASE WHEN option_id~'^spread-a-' THEN regexp_replace(option_id,'^spread-a-','')::numeric WHEN option_id~'^spread-b-' THEN regexp_replace(option_id,'^spread-b-','')::numeric*-1 WHEN option_id~'^pl-a-' THEN regexp_replace(option_id,'^pl-a-','')::numeric WHEN option_id~'^pl-b-' THEN regexp_replace(option_id,'^pl-b-','')::numeric*-1 WHEN option_id~'^hc-a-' THEN regexp_replace(option_id,'^hc-a-','')::numeric WHEN option_id~'^hc-b-' THEN regexp_replace(option_id,'^hc-b-','')::numeric*-1 ELSE NULL END;
        IF adj IS NOT NULL THEN
          IF option_id~'(^spread-a-|^pl-a-|^hc-a-)' THEN won:=diff+adj>0; push:=diff+adj=0; ELSE won:=diff+adj<0; push:=diff+adj=0; END IF;
        END IF;
      END;
    ELSIF market_id='exact-sets' THEN
      DECLARE sa int:=0; sb int:=0;
      BEGIN
        SELECT count(*) INTO sa FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'a')::int>(s->>'b')::int;
        SELECT count(*) INTO sb FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'b')::int>(s->>'a')::int;
        won:=option_id='s-'||sa::text||'-'||sb::text;
      END;
    ELSIF market_id='set-handicap' THEN
      DECLARE sa int:=0; sb int:=0; adj numeric;
      BEGIN
        SELECT count(*) INTO sa FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'a')::int>(s->>'b')::int;
        SELECT count(*) INTO sb FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'b')::int>(s->>'a')::int;
        adj:=CASE WHEN option_id~'^gh-a-' THEN regexp_replace(option_id,'^gh-a-','')::numeric WHEN option_id~'^gh-b-' THEN regexp_replace(option_id,'^gh-b-','')::numeric*-1 ELSE NULL END;
        IF adj IS NOT NULL THEN IF option_id~'^gh-a-' THEN won:=(sa-sb)+adj>0; ELSE won:=(sa-sb)+adj<0; END IF; push:=(sa-sb)+adj=0; END IF;
      END;
    ELSE
      push:=true;
    END IF;

    IF push THEN
      payout:=round(amt,2);
      IF uid IS NOT NULL THEN PERFORM public.wallet_betting_credit(uid,payout,'bet_refund',_match_id); END IF;
      b:=b||jsonb_build_object('status','refunded','payout',payout);
    ELSIF won THEN
      payout:=round(amt*odds,2);
      IF uid IS NOT NULL THEN PERFORM public.wallet_betting_credit(uid,payout,'bet_payout',_match_id); END IF;
      b:=b||jsonb_build_object('status','won','payout',payout);
    ELSE
      b:=b||jsonb_build_object('status','lost','payout',0);
    END IF;
    updated_bets:=updated_bets||jsonb_build_array(b);
  END LOOP;
  IF total_open>0 THEN UPDATE public.matches SET bets=updated_bets WHERE id=_match_id; END IF;
END; $$;
REVOKE ALL ON FUNCTION public.settle_match(uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.trg_match_settle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  IF NEW.confirmed_at IS NOT NULL AND OLD.confirmed_at IS NULL AND NEW.ended_at IS NOT NULL THEN PERFORM public.settle_match(NEW.id); END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS match_settle_trigger ON public.matches;
DROP TRIGGER IF EXISTS matches_settle ON public.matches;
DROP TRIGGER IF EXISTS match_settle_after_confirm ON public.matches;
CREATE TRIGGER match_settle_after_confirm AFTER UPDATE OF confirmed_at ON public.matches FOR EACH ROW WHEN(NEW.confirmed_at IS NOT NULL AND OLD.confirmed_at IS NULL AND NEW.ended_at IS NOT NULL) EXECUTE FUNCTION public.trg_match_settle();

CREATE OR REPLACE FUNCTION public.get_my_betting_ledger()
RETURNS TABLE(id uuid,match_id uuid,amount numeric,kind text,created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$
SELECT l.id,l.match_id,l.amount,l.kind,l.created_at FROM public.wallet_betting_ledger l WHERE l.user_id=auth.uid() ORDER BY l.created_at DESC;
$$;
REVOKE ALL ON FUNCTION public.get_my_betting_ledger() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.get_my_betting_ledger() TO authenticated;
