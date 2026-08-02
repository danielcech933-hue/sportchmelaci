-- ============ 1. PROFILE COLUMNS ============
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS elo integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS arcade_points integer NOT NULL DEFAULT 500;

-- allow users to update own profile but not balance/elo/arcade_points
DROP POLICY IF EXISTS "users update own profile" ON public.profiles;
CREATE POLICY "users update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND balance = (SELECT p.balance FROM public.profiles p WHERE p.id = auth.uid())
    AND elo = (SELECT p.elo FROM public.profiles p WHERE p.id = auth.uid())
    AND arcade_points = (SELECT p.arcade_points FROM public.profiles p WHERE p.id = auth.uid())
  );

-- ============ 2. ARCADE TABLES ============
CREATE TABLE IF NOT EXISTS public.arcade_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  slot text NOT NULL,
  rarity text NOT NULL,
  icon text NOT NULL DEFAULT '🎁',
  value_points integer NOT NULL DEFAULT 50,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.arcade_items TO authenticated;
GRANT ALL ON public.arcade_items TO service_role;
ALTER TABLE public.arcade_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arcade items readable" ON public.arcade_items FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.arcade_inventory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.arcade_items(id) ON DELETE CASCADE,
  equipped boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.arcade_inventory TO authenticated;
GRANT ALL ON public.arcade_inventory TO service_role;
ALTER TABLE public.arcade_inventory ENABLE ROW LEVEL SECURITY;
CREATE POLICY "inventory readable by authenticated" ON public.arcade_inventory FOR SELECT TO authenticated USING (true);
CREATE INDEX IF NOT EXISTS arcade_inventory_user_idx ON public.arcade_inventory(user_id);
CREATE TRIGGER arcade_inventory_updated_at BEFORE UPDATE ON public.arcade_inventory
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.arcade_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_a uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_b uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  score_a integer NOT NULL DEFAULT 0,
  score_b integer NOT NULL DEFAULT 0,
  winner_id uuid,
  crate_opened boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.arcade_matches TO authenticated;
GRANT ALL ON public.arcade_matches TO service_role;
ALTER TABLE public.arcade_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "arcade matches readable" ON public.arcade_matches FOR SELECT TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS public.arcade_listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inventory_id uuid NOT NULL REFERENCES public.arcade_inventory(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.arcade_items(id) ON DELETE CASCADE,
  price integer NOT NULL,
  status text NOT NULL DEFAULT 'active',
  buyer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.arcade_listings TO authenticated;
GRANT ALL ON public.arcade_listings TO service_role;
ALTER TABLE public.arcade_listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listings readable by authenticated" ON public.arcade_listings FOR SELECT TO authenticated USING (true);
CREATE TRIGGER arcade_listings_updated_at BEFORE UPDATE ON public.arcade_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 3. ITEM CATALOG ============
INSERT INTO public.arcade_items (key, name, slot, rarity, icon, value_points) VALUES
  ('cap_hops','Chmelová kšiltovka','head','common','🧢',40),
  ('band_sweat','Potítko Retro','head','common','🎽',35),
  ('shirt_neon','Neonový dres','body','common','👕',45),
  ('shorts_classic','Klasické trenky','legs','common','🩳',30),
  ('shoes_turbo','Turbo kopačky','feet','rare','👟',90),
  ('gloves_grip','Grip rukavice','hands','rare','🧤',85),
  ('goggles_cyber','Cyber brýle','head','rare','🥽',110),
  ('cape_champion','Plášť šampiona','back','epic','🦸',220),
  ('crown_league','Ligová korunka','head','epic','👑',260),
  ('aura_plasma','Plazmová aura','aura','epic','🔮',240),
  ('trophy_golden','Zlatá trofej','aura','legendary','🏆',600),
  ('dragon_hops','Chmelový drak','back','legendary','🐉',650)
ON CONFLICT (key) DO NOTHING;

-- ============ 4. WIN NOTIFICATIONS ============
CREATE OR REPLACE FUNCTION public.notify_win(_user_id uuid, _kind text, _title text, _body text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _user_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications(user_id, kind, title, body)
  VALUES (_user_id, _kind, _title, _body);
END;
$$;

-- ============ 5. ELO SYNC ON MATCH FINISH ============
CREATE OR REPLACE FUNCTION public.sync_match_elo(_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m record;
  winner text;
  sets_a int;
  sets_b int;
  ids_a uuid[];
  ids_b uuid[];
  avg_a numeric;
  avg_b numeric;
  exp_a numeric;
  delta int;
  u uuid;
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id;
  IF m.id IS NULL OR m.ended_at IS NULL OR m.confirmed_at IS NULL THEN RETURN; END IF;

  IF m.score_a > m.score_b THEN winner := 'a';
  ELSIF m.score_b > m.score_a THEN winner := 'b';
  ELSE
    SELECT COUNT(*) INTO sets_a FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'a')::int > (s->>'b')::int;
    SELECT COUNT(*) INTO sets_b FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'b')::int > (s->>'a')::int;
    IF sets_a > sets_b THEN winner := 'a';
    ELSIF sets_b > sets_a THEN winner := 'b';
    ELSE RETURN; END IF;
  END IF;

  SELECT COALESCE(array_agg(p.id), ARRAY[]::uuid[]) INTO ids_a FROM public.profiles p
    WHERE lower(p.nickname) = ANY (SELECT lower(trim(x)) FROM regexp_split_to_table(m.team_a, '[,&/+]') x);
  SELECT COALESCE(array_agg(p.id), ARRAY[]::uuid[]) INTO ids_b FROM public.profiles p
    WHERE lower(p.nickname) = ANY (SELECT lower(trim(x)) FROM regexp_split_to_table(m.team_b, '[,&/+]') x);

  IF array_length(ids_a,1) IS NULL OR array_length(ids_b,1) IS NULL THEN RETURN; END IF;

  SELECT AVG(elo) INTO avg_a FROM public.profiles WHERE id = ANY(ids_a);
  SELECT AVG(elo) INTO avg_b FROM public.profiles WHERE id = ANY(ids_b);
  exp_a := 1.0 / (1.0 + power(10.0, (avg_b - avg_a) / 400.0));

  IF winner = 'a' THEN delta := GREATEST(5, ROUND(32 * (1 - exp_a))::int);
  ELSE delta := GREATEST(5, ROUND(32 * exp_a)::int);
  END IF;

  IF winner = 'a' THEN
    UPDATE public.profiles SET elo = elo + delta WHERE id = ANY(ids_a);
    UPDATE public.profiles SET elo = GREATEST(100, elo - delta) WHERE id = ANY(ids_b);
    FOREACH u IN ARRAY ids_a LOOP
      PERFORM public.notify_win(u, 'match_win',
        '🏆 Výhra: ' || m.team_a || ' vs ' || m.team_b,
        to_char(COALESCE(m.ended_at, now()) AT TIME ZONE 'Europe/Prague', 'DD.MM.YYYY HH24:MI') ||
        ' • ' || m.score_a || ':' || m.score_b || ' • +' || delta || ' ELO');
    END LOOP;
  ELSE
    UPDATE public.profiles SET elo = elo + delta WHERE id = ANY(ids_b);
    UPDATE public.profiles SET elo = GREATEST(100, elo - delta) WHERE id = ANY(ids_a);
    FOREACH u IN ARRAY ids_b LOOP
      PERFORM public.notify_win(u, 'match_win',
        '🏆 Výhra: ' || m.team_b || ' vs ' || m.team_a,
        to_char(COALESCE(m.ended_at, now()) AT TIME ZONE 'Europe/Prague', 'DD.MM.YYYY HH24:MI') ||
        ' • ' || m.score_b || ':' || m.score_a || ' • +' || delta || ' ELO');
    END LOOP;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_match_elo()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.confirmed_at IS NOT NULL
     AND (OLD.ended_at IS NULL OR OLD.confirmed_at IS NULL) THEN
    PERFORM public.sync_match_elo(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS match_elo_sync ON public.matches;
CREATE TRIGGER match_elo_sync AFTER UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_match_elo();

-- ensure existing behaviour triggers still bound
DROP TRIGGER IF EXISTS matches_guard_update ON public.matches;
CREATE TRIGGER matches_guard_update BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.guard_matches_update();
DROP TRIGGER IF EXISTS matches_audit ON public.matches;
CREATE TRIGGER matches_audit AFTER INSERT OR UPDATE OR DELETE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_matches_audit();
DROP TRIGGER IF EXISTS matches_settle ON public.matches;
CREATE TRIGGER matches_settle AFTER UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_match_settle();
DROP TRIGGER IF EXISTS matches_bracket_advance ON public.matches;
CREATE TRIGGER matches_bracket_advance AFTER UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_bracket_advance();
DROP TRIGGER IF EXISTS matches_delete_refund ON public.matches;
CREATE TRIGGER matches_delete_refund BEFORE DELETE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.trg_match_delete_refund();
DROP TRIGGER IF EXISTS chat_force_nickname_trg ON public.chat_messages;
CREATE TRIGGER chat_force_nickname_trg BEFORE INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.chat_force_nickname();
DROP TRIGGER IF EXISTS tournament_teams_unique_players_trg ON public.tournament_teams;
CREATE TRIGGER tournament_teams_unique_players_trg BEFORE INSERT OR UPDATE ON public.tournament_teams
  FOR EACH ROW EXECUTE FUNCTION public.tournament_teams_unique_players();

-- ============ 6. BET WIN NOTIFICATIONS in settle_match ============
CREATE OR REPLACE FUNCTION public.settle_match(_match_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  m record;
  sets_a int;
  sets_b int;
  winner text;
  total_pool numeric := 0;
  winning_stake numeric := 0;
  b jsonb;
  updated_bets jsonb := '[]'::jsonb;
  payout numeric;
  status text;
  new_b jsonb;
BEGIN
  PERFORM set_config('app.bypass_match_guard', 'on', true);

  SELECT id, sport, team_a, team_b, score_a, score_b, sets, bets, ended_at INTO m
    FROM public.matches WHERE id = _match_id FOR UPDATE;
  IF m.id IS NULL OR m.ended_at IS NULL THEN RETURN; END IF;
  IF COALESCE(jsonb_array_length(m.bets), 0) = 0 THEN RETURN; END IF;

  IF EXISTS (SELECT 1 FROM jsonb_array_elements(m.bets) x WHERE x->>'status' IS NOT NULL AND x->>'status' <> 'open') THEN
    RETURN;
  END IF;

  IF m.score_a > m.score_b THEN winner := 'a';
  ELSIF m.score_b > m.score_a THEN winner := 'b';
  ELSE
    SELECT COUNT(*) INTO sets_a FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'a')::int > (s->>'b')::int;
    SELECT COUNT(*) INTO sets_b FROM jsonb_array_elements(COALESCE(m.sets,'[]'::jsonb)) s WHERE (s->>'b')::int > (s->>'a')::int;
    IF sets_a > sets_b THEN winner := 'a';
    ELSIF sets_b > sets_a THEN winner := 'b';
    ELSE winner := NULL; END IF;
  END IF;

  IF winner IS NULL THEN
    FOR b IN SELECT value FROM jsonb_array_elements(m.bets) LOOP
      UPDATE public.profiles SET balance = balance + COALESCE((b->>'amount')::numeric,0)
        WHERE id::text = b->>'userId';
      new_b := b || jsonb_build_object('status','refunded','payout', COALESCE((b->>'amount')::numeric,0));
      updated_bets := updated_bets || jsonb_build_array(new_b);
    END LOOP;
    UPDATE public.matches SET bets = updated_bets WHERE id = _match_id;
    PERFORM public.write_audit('match.settled_refund', 'match', _match_id, _match_id, jsonb_build_object('reason','tie'));
    RETURN;
  END IF;

  SELECT COALESCE(SUM((x->>'amount')::numeric),0) INTO total_pool FROM jsonb_array_elements(m.bets) x;
  SELECT COALESCE(SUM((x->>'amount')::numeric),0) INTO winning_stake
    FROM jsonb_array_elements(m.bets) x WHERE x->>'pick' = winner;

  FOR b IN SELECT value FROM jsonb_array_elements(m.bets) LOOP
    IF b->>'pick' = winner AND winning_stake > 0 THEN
      payout := ROUND(COALESCE((b->>'amount')::numeric,0) * total_pool / winning_stake, 2);
      status := 'won';
      UPDATE public.profiles SET balance = balance + payout WHERE id::text = b->>'userId';
      PERFORM public.notify_win((b->>'userId')::uuid, 'bet_win',
        '💰 Vyhraná sázka: ' || m.team_a || ' vs ' || m.team_b,
        to_char(now() AT TIME ZONE 'Europe/Prague', 'DD.MM.YYYY HH24:MI') ||
        ' • výhra $' || payout::text);
    ELSE
      payout := 0;
      status := 'lost';
    END IF;
    new_b := b || jsonb_build_object('status', status, 'payout', payout);
    updated_bets := updated_bets || jsonb_build_array(new_b);
  END LOOP;

  UPDATE public.matches SET bets = updated_bets WHERE id = _match_id;
  PERFORM public.write_audit('match.settled', 'match', _match_id, _match_id,
    jsonb_build_object('winner', winner, 'pool', total_pool, 'winning_stake', winning_stake));
END;
$$;

-- ============ 7. ARCADE RPCs ============
CREATE OR REPLACE FUNCTION public.arcade_report_match(_opponent uuid, _score_a integer, _score_b integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  win uuid;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _score_a < 0 OR _score_b < 0 OR _score_a > 999 OR _score_b > 999 THEN RAISE EXCEPTION 'invalid_score'; END IF;
  IF _score_a > _score_b THEN win := uid;
  ELSIF _score_b > _score_a THEN win := _opponent;
  ELSE win := NULL; END IF;

  INSERT INTO public.arcade_matches(player_a, player_b, score_a, score_b, winner_id)
    VALUES (uid, _opponent, _score_a, _score_b, win) RETURNING id INTO new_id;

  IF win = uid THEN
    UPDATE public.profiles SET arcade_points = arcade_points + 25 WHERE id = uid;
    PERFORM public.notify_win(uid, 'arcade_win', '🕹️ Arcade výhra',
      to_char(now() AT TIME ZONE 'Europe/Prague', 'DD.MM.YYYY HH24:MI') ||
      ' • ' || _score_a || ':' || _score_b || ' • +25 arcade bodů');
  END IF;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.arcade_open_crate(_match_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  m record;
  roll numeric;
  rar text;
  it record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO m FROM public.arcade_matches WHERE id = _match_id FOR UPDATE;
  IF m.id IS NULL THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF m.winner_id IS DISTINCT FROM uid THEN RAISE EXCEPTION 'not_winner'; END IF;
  IF m.crate_opened THEN RAISE EXCEPTION 'crate_already_opened'; END IF;

  roll := random();
  IF roll < 0.60 THEN rar := 'common';
  ELSIF roll < 0.85 THEN rar := 'rare';
  ELSIF roll < 0.97 THEN rar := 'epic';
  ELSE rar := 'legendary'; END IF;

  SELECT * INTO it FROM public.arcade_items WHERE rarity = rar ORDER BY random() LIMIT 1;
  IF it.id IS NULL THEN SELECT * INTO it FROM public.arcade_items ORDER BY random() LIMIT 1; END IF;

  UPDATE public.arcade_matches SET crate_opened = true WHERE id = _match_id;
  INSERT INTO public.arcade_inventory(user_id, item_id) VALUES (uid, it.id);

  RETURN jsonb_build_object('item_id', it.id, 'key', it.key, 'name', it.name,
    'rarity', it.rarity, 'icon', it.icon, 'slot', it.slot, 'value_points', it.value_points);
END;
$$;

CREATE OR REPLACE FUNCTION public.arcade_equip(_inventory_id uuid, _equip boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  inv record;
  sl text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO inv FROM public.arcade_inventory WHERE id = _inventory_id AND user_id = uid;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'not_owner'; END IF;
  SELECT slot INTO sl FROM public.arcade_items WHERE id = inv.item_id;

  IF _equip THEN
    UPDATE public.arcade_inventory ai SET equipped = false
      WHERE ai.user_id = uid AND ai.equipped
        AND EXISTS (SELECT 1 FROM public.arcade_items i WHERE i.id = ai.item_id AND i.slot = sl);
    UPDATE public.arcade_inventory SET equipped = true WHERE id = _inventory_id;
  ELSE
    UPDATE public.arcade_inventory SET equipped = false WHERE id = _inventory_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.arcade_list_item(_inventory_id uuid, _price integer)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  inv record;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _price < 1 OR _price > 100000 THEN RAISE EXCEPTION 'invalid_price'; END IF;
  SELECT * INTO inv FROM public.arcade_inventory WHERE id = _inventory_id AND user_id = uid;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'not_owner'; END IF;
  IF EXISTS (SELECT 1 FROM public.arcade_listings WHERE inventory_id = _inventory_id AND status = 'active') THEN
    RAISE EXCEPTION 'already_listed';
  END IF;
  UPDATE public.arcade_inventory SET equipped = false WHERE id = _inventory_id;
  INSERT INTO public.arcade_listings(seller_id, inventory_id, item_id, price)
    VALUES (uid, _inventory_id, inv.item_id, _price) RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.arcade_cancel_listing(_listing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.arcade_listings SET status = 'cancelled'
    WHERE id = _listing_id AND seller_id = uid AND status = 'active';
  IF NOT FOUND THEN RAISE EXCEPTION 'listing_not_found'; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.arcade_buy_listing(_listing_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  l record;
  pts integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO l FROM public.arcade_listings WHERE id = _listing_id FOR UPDATE;
  IF l.id IS NULL OR l.status <> 'active' THEN RAISE EXCEPTION 'listing_not_found'; END IF;
  IF l.seller_id = uid THEN RAISE EXCEPTION 'own_listing'; END IF;

  SELECT arcade_points INTO pts FROM public.profiles WHERE id = uid FOR UPDATE;
  IF pts IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
  IF pts < l.price THEN RAISE EXCEPTION 'insufficient_points'; END IF;

  UPDATE public.profiles SET arcade_points = arcade_points - l.price WHERE id = uid;
  UPDATE public.profiles SET arcade_points = arcade_points + l.price WHERE id = l.seller_id;
  UPDATE public.arcade_inventory SET user_id = uid, equipped = false WHERE id = l.inventory_id;
  UPDATE public.arcade_listings SET status = 'sold', buyer_id = uid WHERE id = _listing_id;

  RETURN jsonb_build_object('arcade_points', pts - l.price);
END;
$$;

REVOKE ALL ON FUNCTION public.notify_win(uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.sync_match_elo(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.arcade_report_match(uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.arcade_open_crate(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.arcade_equip(uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.arcade_list_item(uuid, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.arcade_cancel_listing(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.arcade_buy_listing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arcade_report_match(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arcade_open_crate(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arcade_equip(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arcade_list_item(uuid, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arcade_cancel_listing(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.arcade_buy_listing(uuid) TO authenticated;