-- ============ ROULETTE ============
CREATE TABLE public.roulette_rounds (
  round_no bigint PRIMARY KEY,
  result integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.roulette_rounds TO authenticated;
GRANT ALL ON public.roulette_rounds TO service_role;
ALTER TABLE public.roulette_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roulette_rounds_read" ON public.roulette_rounds FOR SELECT TO authenticated USING (true);

CREATE TABLE public.roulette_bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_no bigint NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  bet_type text NOT NULL,
  bet_value text,
  amount numeric NOT NULL CHECK (amount > 0),
  payout numeric,
  settled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX roulette_bets_round_idx ON public.roulette_bets(round_no);
GRANT SELECT ON public.roulette_bets TO authenticated;
GRANT ALL ON public.roulette_bets TO service_role;
ALTER TABLE public.roulette_bets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "roulette_bets_read" ON public.roulette_bets FOR SELECT TO authenticated USING (true);

CREATE OR REPLACE FUNCTION public.roulette_result(_round_no bigint)
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT (('x' || substr(md5('chmelovci-roulette-' || _round_no::text), 1, 8))::bit(32)::bigint & 2147483647) % 37;
$$;

CREATE OR REPLACE FUNCTION public.roulette_place_bet(_round_no bigint, _bet_type text, _bet_value text, _amount numeric)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  nick text;
  bal numeric;
  cur bigint := floor(extract(epoch from now()) / 15)::bigint;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _round_no <> cur THEN RAISE EXCEPTION 'round_closed'; END IF;
  IF _bet_type NOT IN ('red','black','green','even','odd','low','high','dozen','number') THEN
    RAISE EXCEPTION 'invalid_bet_type';
  END IF;
  IF _amount IS NULL OR _amount < 1 THEN RAISE EXCEPTION 'invalid_amount'; END IF;

  SELECT nickname, balance INTO nick, bal FROM public.profiles WHERE id = uid FOR UPDATE;
  IF nick IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  IF bal < _amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  UPDATE public.profiles SET balance = balance - _amount WHERE id = uid;
  INSERT INTO public.roulette_bets(round_no, user_id, nickname, bet_type, bet_value, amount)
  VALUES (_round_no, uid, nick, _bet_type, NULLIF(TRIM(COALESCE(_bet_value,'')),''), _amount);

  RETURN jsonb_build_object('ok', true, 'balance', bal - _amount);
END;
$$;
REVOKE ALL ON FUNCTION public.roulette_place_bet(bigint, text, text, numeric) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.roulette_place_bet(bigint, text, text, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION public.roulette_settle(_round_no bigint)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  res integer;
  b record;
  win boolean;
  mult numeric;
  cur bigint := floor(extract(epoch from now()) / 15)::bigint;
  reds integer[] := ARRAY[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  paid numeric := 0;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _round_no >= cur THEN RAISE EXCEPTION 'round_not_finished'; END IF;

  res := public.roulette_result(_round_no);
  INSERT INTO public.roulette_rounds(round_no, result) VALUES (_round_no, res)
    ON CONFLICT (round_no) DO NOTHING;

  FOR b IN SELECT * FROM public.roulette_bets WHERE round_no = _round_no AND settled = false FOR UPDATE LOOP
    win := false; mult := 0;
    IF b.bet_type = 'red' THEN win := res = ANY(reds); mult := 2;
    ELSIF b.bet_type = 'black' THEN win := res <> 0 AND NOT (res = ANY(reds)); mult := 2;
    ELSIF b.bet_type = 'green' THEN win := res = 0; mult := 36;
    ELSIF b.bet_type = 'even' THEN win := res <> 0 AND res % 2 = 0; mult := 2;
    ELSIF b.bet_type = 'odd' THEN win := res % 2 = 1; mult := 2;
    ELSIF b.bet_type = 'low' THEN win := res BETWEEN 1 AND 18; mult := 2;
    ELSIF b.bet_type = 'high' THEN win := res BETWEEN 19 AND 36; mult := 2;
    ELSIF b.bet_type = 'dozen' THEN
      mult := 3;
      win := res <> 0 AND ((b.bet_value = '1' AND res <= 12) OR (b.bet_value = '2' AND res BETWEEN 13 AND 24) OR (b.bet_value = '3' AND res >= 25));
    ELSIF b.bet_type = 'number' THEN win := b.bet_value = res::text; mult := 36;
    END IF;

    UPDATE public.roulette_bets
      SET settled = true, payout = CASE WHEN win THEN b.amount * mult ELSE 0 END
      WHERE id = b.id;

    IF win THEN
      UPDATE public.profiles SET balance = balance + b.amount * mult WHERE id = b.user_id;
      paid := paid + b.amount * mult;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('result', res, 'paid', paid);
END;
$$;
REVOKE ALL ON FUNCTION public.roulette_settle(bigint) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.roulette_settle(bigint) TO authenticated;

-- ============ POKER ============
CREATE TABLE public.poker_tournaments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  buy_in numeric NOT NULL CHECK (buy_in >= 0),
  starting_chips integer NOT NULL DEFAULT 1000 CHECK (starting_chips > 0),
  max_players integer NOT NULL DEFAULT 6 CHECK (max_players BETWEEN 2 AND 9),
  status text NOT NULL DEFAULT 'lobby',
  hand jsonb,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.poker_tournaments TO authenticated;
GRANT ALL ON public.poker_tournaments TO service_role;
ALTER TABLE public.poker_tournaments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.poker_seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id uuid NOT NULL REFERENCES public.poker_tournaments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  seat_no integer NOT NULL,
  chips integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id),
  UNIQUE (tournament_id, seat_no)
);
GRANT SELECT ON public.poker_seats TO authenticated;
GRANT ALL ON public.poker_seats TO service_role;
ALTER TABLE public.poker_seats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "poker_tournaments_read" ON public.poker_tournaments FOR SELECT TO authenticated USING (true);
CREATE POLICY "poker_tournaments_update_seated" ON public.poker_tournaments FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.poker_seats s WHERE s.tournament_id = id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.poker_seats s WHERE s.tournament_id = id AND s.user_id = auth.uid()));
CREATE POLICY "poker_seats_read" ON public.poker_seats FOR SELECT TO authenticated USING (true);

CREATE TRIGGER poker_tournaments_updated_at BEFORE UPDATE ON public.poker_tournaments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.poker_create_tournament(_name text, _buy_in numeric, _starting_chips integer, _max_players integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); tid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF COALESCE(TRIM(_name),'') = '' THEN RAISE EXCEPTION 'invalid_name'; END IF;
  IF _max_players < 2 OR _max_players > 9 THEN RAISE EXCEPTION 'invalid_max_players'; END IF;
  INSERT INTO public.poker_tournaments(name, buy_in, starting_chips, max_players, created_by)
  VALUES (TRIM(_name), GREATEST(_buy_in, 0), GREATEST(_starting_chips, 1), _max_players, uid)
  RETURNING id INTO tid;
  RETURN tid;
END;
$$;
REVOKE ALL ON FUNCTION public.poker_create_tournament(text, numeric, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.poker_create_tournament(text, numeric, integer, integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.poker_join(_tournament_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  nick text; bal numeric; t record; taken integer; next_seat integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO t FROM public.poker_tournaments WHERE id = _tournament_id FOR UPDATE;
  IF t.id IS NULL THEN RAISE EXCEPTION 'tournament_not_found'; END IF;

  IF EXISTS (SELECT 1 FROM public.poker_seats WHERE tournament_id = _tournament_id AND user_id = uid) THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  SELECT count(*) INTO taken FROM public.poker_seats WHERE tournament_id = _tournament_id;
  IF taken >= t.max_players THEN RAISE EXCEPTION 'table_full'; END IF;

  SELECT nickname, balance INTO nick, bal FROM public.profiles WHERE id = uid FOR UPDATE;
  IF nick IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  IF bal < t.buy_in THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  SELECT COALESCE(MAX(seat_no), -1) + 1 INTO next_seat FROM public.poker_seats WHERE tournament_id = _tournament_id;

  UPDATE public.profiles SET balance = balance - t.buy_in WHERE id = uid;
  INSERT INTO public.poker_seats(tournament_id, user_id, nickname, seat_no, chips)
  VALUES (_tournament_id, uid, nick, next_seat, t.starting_chips);

  RETURN jsonb_build_object('ok', true, 'seat_no', next_seat, 'balance', bal - t.buy_in);
END;
$$;
REVOKE ALL ON FUNCTION public.poker_join(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.poker_join(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.poker_cash_out(_tournament_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid(); t record; s record; cash numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO t FROM public.poker_tournaments WHERE id = _tournament_id;
  IF t.id IS NULL THEN RAISE EXCEPTION 'tournament_not_found'; END IF;
  SELECT * INTO s FROM public.poker_seats WHERE tournament_id = _tournament_id AND user_id = uid FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'not_seated'; END IF;

  cash := CASE WHEN t.starting_chips > 0 THEN ROUND((s.chips::numeric / t.starting_chips) * t.buy_in, 2) ELSE 0 END;
  DELETE FROM public.poker_seats WHERE id = s.id;
  IF cash > 0 THEN UPDATE public.profiles SET balance = balance + cash WHERE id = uid; END IF;
  RETURN jsonb_build_object('ok', true, 'cashed', cash);
END;
$$;
REVOKE ALL ON FUNCTION public.poker_cash_out(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.poker_cash_out(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.poker_sync_chips(_tournament_id uuid, _stacks jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); k text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.poker_seats WHERE tournament_id = _tournament_id AND user_id = uid) THEN
    RAISE EXCEPTION 'not_seated';
  END IF;
  FOR k IN SELECT jsonb_object_keys(_stacks) LOOP
    UPDATE public.poker_seats
      SET chips = GREATEST(0, (_stacks->>k)::integer)
      WHERE tournament_id = _tournament_id AND user_id = k::uuid;
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.poker_sync_chips(uuid, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.poker_sync_chips(uuid, jsonb) TO authenticated;

-- ============ CASINO CHAT ============
CREATE TABLE public.casino_chat (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname text NOT NULL,
  content text,
  emoji text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX casino_chat_room_idx ON public.casino_chat(room, created_at DESC);
GRANT SELECT, INSERT, DELETE ON public.casino_chat TO authenticated;
GRANT ALL ON public.casino_chat TO service_role;
ALTER TABLE public.casino_chat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "casino_chat_read" ON public.casino_chat FOR SELECT TO authenticated USING (true);
CREATE POLICY "casino_chat_insert_own" ON public.casino_chat FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "casino_chat_delete_own_or_admin" ON public.casino_chat FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.casino_chat_force_nickname()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  SELECT nickname INTO NEW.nickname FROM public.profiles WHERE id = auth.uid();
  IF NEW.nickname IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  NEW.user_id := auth.uid();
  RETURN NEW;
END;
$$;
CREATE TRIGGER casino_chat_force_nickname BEFORE INSERT ON public.casino_chat
  FOR EACH ROW EXECUTE FUNCTION public.casino_chat_force_nickname();

-- ============ REALTIME ============
ALTER TABLE public.roulette_bets REPLICA IDENTITY FULL;
ALTER TABLE public.roulette_rounds REPLICA IDENTITY FULL;
ALTER TABLE public.poker_tournaments REPLICA IDENTITY FULL;
ALTER TABLE public.poker_seats REPLICA IDENTITY FULL;
ALTER TABLE public.casino_chat REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.roulette_bets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.roulette_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_tournaments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poker_seats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.casino_chat;