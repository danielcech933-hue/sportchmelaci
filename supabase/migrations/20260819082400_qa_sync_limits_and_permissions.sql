-- QA sync migration: keep source-controlled DB policy aligned with the production project.
-- Safe to re-apply because all statements are CREATE OR REPLACE / GRANT / REVOKE.

CREATE OR REPLACE FUNCTION public.place_market_bet(_match_id uuid, _market_id text, _option_id text, _pick text, _amount numeric, _locked_odds numeric, _note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
 uid uuid:=auth.uid(); nick text; bal numeric; m record; new_bet jsonb; bet_id uuid:=gen_random_uuid();
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF _market_id IS NULL OR length(trim(_market_id))=0 THEN RAISE EXCEPTION 'invalid_market'; END IF;
 IF _option_id IS NULL OR length(trim(_option_id))=0 THEN RAISE EXCEPTION 'invalid_option'; END IF;
 IF _pick NOT IN ('a','b','draw') THEN RAISE EXCEPTION 'invalid_pick'; END IF;
 IF _amount IS NULL OR _amount<1 OR _amount>10000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
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
 UPDATE public.profiles SET balance=round(balance-_amount,2) WHERE id=uid;
 PERFORM set_config('app.bypass_match_guard','off',true);
 RETURN jsonb_build_object('bet_id',bet_id,'balance',round(bal-_amount,2),'locked_odds',round(_locked_odds,2));
EXCEPTION WHEN others THEN PERFORM set_config('app.bypass_match_guard','off',true); RAISE;
END;
$function$;

-- The production Epic Slot engine already contains the privileged-player policy.
-- This assertion keeps that policy explicit and fails loudly during migration if drift reappears.
DO $$
DECLARE def text;
BEGIN
 SELECT pg_get_functiondef(p.oid) INTO def
 FROM pg_proc p
 JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='public'
   AND p.proname='slot_epic_spin'
   AND pg_get_function_identity_arguments(p.oid)='_game_id text, _bet numeric';
 IF def IS NULL THEN RAISE EXCEPTION 'slot_epic_spin_missing'; END IF;
 IF position('''mesi''' IN lower(def)) = 0 THEN
   RAISE EXCEPTION 'slot_epic_spin_privileged_policy_drift';
 END IF;
END $$;

REVOKE ALL ON FUNCTION public.place_market_bet(uuid,text,text,text,numeric,numeric,text) FROM anon;
GRANT EXECUTE ON FUNCTION public.place_market_bet(uuid,text,text,text,numeric,numeric,text) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.slot_epic_spin(text,numeric) FROM anon;
GRANT EXECUTE ON FUNCTION public.slot_epic_spin(text,numeric) TO authenticated, service_role;
