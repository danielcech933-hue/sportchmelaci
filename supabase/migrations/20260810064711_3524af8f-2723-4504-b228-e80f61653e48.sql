CREATE OR REPLACE FUNCTION public.place_bet(_match_id uuid, _pick text, _amount numeric, _note text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  nick text;
  bal numeric;
  m record;
  new_bet jsonb;
  bet_id uuid := gen_random_uuid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _pick NOT IN ('a','b') THEN RAISE EXCEPTION 'invalid_pick'; END IF;
  IF _amount IS NULL OR _amount < 1 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  PERFORM set_config('app.bypass_match_guard', 'on', true);

  SELECT nickname, balance INTO nick, bal FROM public.profiles WHERE id = uid FOR UPDATE;
  IF nick IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  IF bal < _amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  SELECT id, ended_at, bets INTO m FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF m.ended_at IS NOT NULL THEN RAISE EXCEPTION 'match_ended'; END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(COALESCE(m.bets,'[]'::jsonb)) b
    WHERE b->>'userId' = uid::text
  ) THEN
    RAISE EXCEPTION 'already_bet';
  END IF;

  new_bet := jsonb_build_object(
    'id', bet_id::text,
    'userId', uid::text,
    'bettor', nick,
    'pick', _pick,
    'amount', _amount,
    'note', NULLIF(TRIM(_note), ''),
    'status', 'open',
    'createdAt', (extract(epoch from now()) * 1000)::bigint
  );

  UPDATE public.matches
    SET bets = COALESCE(bets,'[]'::jsonb) || jsonb_build_array(new_bet)
    WHERE id = _match_id;

  UPDATE public.profiles SET balance = balance - _amount WHERE id = uid;

  PERFORM public.write_audit('bet.placed', 'bet', bet_id, _match_id,
    jsonb_build_object('pick', _pick, 'amount', _amount, 'note', NULLIF(TRIM(_note),'')));

  RETURN jsonb_build_object('bet_id', bet_id, 'balance', bal - _amount);
END;
$function$;

REVOKE ALL ON FUNCTION public.place_bet(uuid, text, numeric, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.place_bet(uuid, text, numeric, text) TO authenticated;