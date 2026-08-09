CREATE OR REPLACE FUNCTION public.fc_grant_pack(_pack_type text, _source text DEFAULT 'reward')
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid; _today integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _pack_type NOT IN ('gold','promo') THEN RAISE EXCEPTION 'bad_pack_type'; END IF;
  SELECT count(*) INTO _today FROM fc_packs WHERE user_id = _uid AND created_at > now() - interval '1 day';
  IF _today >= 30 THEN RAISE EXCEPTION 'pack_limit_reached'; END IF;
  INSERT INTO fc_packs(user_id, pack_type, source) VALUES (_uid, _pack_type, coalesce(_source,'reward')) RETURNING id INTO _id;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.fc_open_pack(_pack_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _pt text; _out jsonb := '[]'::jsonb; _i integer; _min integer; _card record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT pack_type INTO _pt FROM fc_packs WHERE id = _pack_id AND user_id = _uid AND opened = false FOR UPDATE;
  IF _pt IS NULL THEN RAISE EXCEPTION 'pack_not_found'; END IF;
  UPDATE fc_packs SET opened = true WHERE id = _pack_id;

  FOR _i IN 1..3 LOOP
    _min := CASE
      WHEN random() < (CASE WHEN _pt = 'promo' THEN 0.22 ELSE 0.08 END) THEN 92
      WHEN random() < (CASE WHEN _pt = 'promo' THEN 0.55 ELSE 0.3 END) THEN 88
      ELSE 75 END;
    SELECT * INTO _card FROM fc_cards WHERE rating >= _min ORDER BY random() LIMIT 1;
    IF _card.id IS NULL THEN SELECT * INTO _card FROM fc_cards ORDER BY random() LIMIT 1; END IF;
    INSERT INTO fc_user_cards(user_id, card_id) VALUES (_uid, _card.id);
    _out := _out || jsonb_build_array(to_jsonb(_card));
  END LOOP;
  RETURN _out;
END; $$;

CREATE OR REPLACE FUNCTION public.fc_save_squad(_formation text, _slots jsonb, _team_ovr integer, _chemistry integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  INSERT INTO fc_squads(user_id, formation, slots, team_ovr, chemistry)
  VALUES (_uid, coalesce(_formation,'4-3-3'), coalesce(_slots,'{}'::jsonb), coalesce(_team_ovr,0), coalesce(_chemistry,0))
  ON CONFLICT (user_id) DO UPDATE SET formation = excluded.formation, slots = excluded.slots,
    team_ovr = excluded.team_ovr, chemistry = excluded.chemistry, updated_at = now();
END; $$;

CREATE OR REPLACE FUNCTION public.fc_create_challenge(_opponent uuid, _mode text, _ovr_cap integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _id uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _opponent = _uid THEN RAISE EXCEPTION 'self_challenge'; END IF;
  INSERT INTO fc_challenges(host_id, opponent_id, mode, ovr_cap, status)
  VALUES (_uid, _opponent, coalesce(_mode,'gold'), _ovr_cap, CASE WHEN _opponent IS NULL THEN 'open' ELSE 'pending' END)
  RETURNING id INTO _id;
  RETURN _id;
END; $$;

CREATE OR REPLACE FUNCTION public.fc_respond_challenge(_challenge_id uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c record;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _c FROM fc_challenges WHERE id = _challenge_id FOR UPDATE;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  IF _c.status = 'open' AND _c.opponent_id IS NULL AND _accept THEN
    IF _c.host_id = _uid THEN RAISE EXCEPTION 'self_challenge'; END IF;
    UPDATE fc_challenges SET opponent_id = _uid, status = 'accepted' WHERE id = _challenge_id;
    RETURN;
  END IF;
  IF _c.opponent_id <> _uid AND _c.host_id <> _uid THEN RAISE EXCEPTION 'not_participant'; END IF;
  UPDATE fc_challenges SET status = CASE WHEN _accept THEN 'accepted' ELSE 'declined' END WHERE id = _challenge_id;
END; $$;

CREATE OR REPLACE FUNCTION public.fc_set_ready(_challenge_id uuid, _ready boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _c record; _ovr integer;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO _c FROM fc_challenges WHERE id = _challenge_id FOR UPDATE;
  IF _c.id IS NULL THEN RAISE EXCEPTION 'challenge_not_found'; END IF;
  IF _c.host_id <> _uid AND _c.opponent_id <> _uid THEN RAISE EXCEPTION 'not_participant'; END IF;
  IF _ready THEN
    SELECT team_ovr INTO _ovr FROM fc_squads WHERE user_id = _uid;
    IF _ovr IS NULL OR _ovr = 0 THEN RAISE EXCEPTION 'no_squad'; END IF;
    IF _c.ovr_cap IS NOT NULL AND _ovr > _c.ovr_cap THEN RAISE EXCEPTION 'ovr_cap_exceeded'; END IF;
  END IF;
  IF _c.host_id = _uid THEN
    UPDATE fc_challenges SET host_ready = _ready WHERE id = _challenge_id;
  ELSE
    UPDATE fc_challenges SET opponent_ready = _ready WHERE id = _challenge_id;
  END IF;
  UPDATE fc_challenges SET status = 'ready' WHERE id = _challenge_id AND host_ready AND opponent_ready;
END; $$;

REVOKE ALL ON FUNCTION public.fc_grant_pack(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fc_open_pack(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fc_save_squad(text, jsonb, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fc_create_challenge(uuid, text, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fc_respond_challenge(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fc_set_ready(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_grant_pack(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fc_open_pack(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fc_save_squad(text, jsonb, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fc_create_challenge(uuid, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fc_respond_challenge(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fc_set_ready(uuid, boolean) TO authenticated;