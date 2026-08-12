-- ============ PHASE 1: Ultimate Team foundation ============

-- players catalog
CREATE TABLE IF NOT EXISTS public.fc_players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  name text NOT NULL,
  nation text NOT NULL,
  club text NOT NULL,
  league text NOT NULL,
  primary_position text NOT NULL,
  alt_positions text[] NOT NULL DEFAULT '{}',
  preferred_foot text NOT NULL DEFAULT 'Right',
  weak_foot integer NOT NULL DEFAULT 3,
  skills integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fc_players TO authenticated, anon;
GRANT ALL ON public.fc_players TO service_role;
ALTER TABLE public.fc_players ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fc_players readable" ON public.fc_players;
CREATE POLICY "fc_players readable" ON public.fc_players FOR SELECT USING (true);

-- extend cards
ALTER TABLE public.fc_cards
  ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES public.fc_players(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS rarity text NOT NULL DEFAULT 'RARE',
  ADD COLUMN IF NOT EXISTS campaign text,
  ADD COLUMN IF NOT EXISTS alt_positions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS playstyles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS playstyles_plus text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS roles text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS attrs jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS base_rating integer,
  ADD COLUMN IF NOT EXISTS quick_sell integer NOT NULL DEFAULT 100;

CREATE INDEX IF NOT EXISTS fc_cards_rarity_rating_idx ON public.fc_cards(rarity, rating);
CREATE INDEX IF NOT EXISTS fc_cards_position_idx ON public.fc_cards(position);

-- extend owned cards
ALTER TABLE public.fc_user_cards
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS favorite boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'pack';
CREATE INDEX IF NOT EXISTS fc_user_cards_user_idx ON public.fc_user_cards(user_id, created_at DESC);

-- clubs
CREATE TABLE IF NOT EXISTS public.fc_clubs (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  club_name text NOT NULL,
  badge text NOT NULL DEFAULT 'hop',
  kit text NOT NULL DEFAULT 'home',
  stadium text NOT NULL DEFAULT 'Chmelová Aréna',
  coins integer NOT NULL DEFAULT 5000,
  spin_tokens integer NOT NULL DEFAULT 3,
  event_tokens integer NOT NULL DEFAULT 0,
  xp integer NOT NULL DEFAULT 0,
  luck_meter integer NOT NULL DEFAULT 0,
  starter_granted boolean NOT NULL DEFAULT false,
  last_daily_spin_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fc_clubs TO authenticated;
GRANT ALL ON public.fc_clubs TO service_role;
ALTER TABLE public.fc_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own club read" ON public.fc_clubs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TRIGGER fc_clubs_updated BEFORE UPDATE ON public.fc_clubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- spin types + odds
CREATE TABLE IF NOT EXISTS public.fc_spin_types (
  key text PRIMARY KEY,
  label text NOT NULL,
  cost_coins integer NOT NULL DEFAULT 0,
  cost_tokens integer NOT NULL DEFAULT 0,
  cost_event_tokens integer NOT NULL DEFAULT 0,
  cooldown_hours integer,
  pity_threshold integer NOT NULL DEFAULT 10,
  enabled boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.fc_spin_types TO authenticated, anon;
GRANT ALL ON public.fc_spin_types TO service_role;
ALTER TABLE public.fc_spin_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spin types readable" ON public.fc_spin_types FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.fc_spin_probabilities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  spin_type text NOT NULL REFERENCES public.fc_spin_types(key) ON DELETE CASCADE,
  rarity text NOT NULL,
  weight integer NOT NULL,
  min_rating integer NOT NULL DEFAULT 60,
  max_rating integer NOT NULL DEFAULT 99,
  UNIQUE (spin_type, rarity)
);
GRANT SELECT ON public.fc_spin_probabilities TO authenticated, anon;
GRANT ALL ON public.fc_spin_probabilities TO service_role;
ALTER TABLE public.fc_spin_probabilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "spin odds readable" ON public.fc_spin_probabilities FOR SELECT USING (true);

-- ledgers
CREATE TABLE IF NOT EXISTS public.fc_coin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount integer NOT NULL,
  currency text NOT NULL DEFAULT 'coins',
  reason text NOT NULL,
  balance_after integer NOT NULL,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fc_coin_transactions TO authenticated;
GRANT ALL ON public.fc_coin_transactions TO service_role;
ALTER TABLE public.fc_coin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own coin log" ON public.fc_coin_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS fc_coin_tx_user_idx ON public.fc_coin_transactions(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.fc_spin_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  spin_type text NOT NULL,
  card_id uuid REFERENCES public.fc_cards(id),
  rarity text NOT NULL,
  duplicate boolean NOT NULL DEFAULT false,
  pity_used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.fc_spin_transactions TO authenticated;
GRANT ALL ON public.fc_spin_transactions TO service_role;
ALTER TABLE public.fc_spin_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own spin log" ON public.fc_spin_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS fc_spin_tx_user_idx ON public.fc_spin_transactions(user_id, created_at DESC);

-- seed spin types
INSERT INTO public.fc_spin_types(key,label,cost_coins,cost_tokens,cooldown_hours,pity_threshold,sort_order) VALUES
  ('daily','Denní Card Spin',0,0,24,8,1),
  ('basic','Základní Card Spin',750,0,NULL,10,2),
  ('premium','Premium Card Spin',2500,1,NULL,6,3),
  ('event','Event Card Spin',0,0,NULL,6,4),
  ('legend','Legend Card Spin',0,0,NULL,4,5)
ON CONFLICT (key) DO NOTHING;
UPDATE public.fc_spin_types SET enabled = false WHERE key IN ('event','legend');

INSERT INTO public.fc_spin_probabilities(spin_type,rarity,weight,min_rating,max_rating) VALUES
  ('daily','COMMON',52,60,72),('daily','RARE',30,72,80),('daily','SUPER_RARE',13,80,84),('daily','SPECIAL',4,84,88),('daily','HERO',1,86,90),
  ('basic','COMMON',40,60,72),('basic','RARE',33,72,80),('basic','SUPER_RARE',18,80,84),('basic','SPECIAL',6,84,88),('basic','HERO',2,86,91),('basic','ICON',1,90,95),
  ('premium','COMMON',14,66,74),('premium','RARE',30,74,81),('premium','SUPER_RARE',30,80,85),('premium','SPECIAL',16,84,89),('premium','HERO',7,86,92),('premium','ICON',2,90,95),('premium','LEGENDARY',1,93,99)
ON CONFLICT (spin_type,rarity) DO NOTHING;

-- ============ RPCs ============

CREATE OR REPLACE FUNCTION public.fc_club_get()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid();
  nick text;
  c record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT nickname INTO nick FROM public.profiles WHERE id = uid;
  IF nick IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;

  INSERT INTO public.fc_clubs(user_id, club_name) VALUES (uid, nick || ' FC')
    ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO c FROM public.fc_clubs WHERE user_id = uid FOR UPDATE;

  IF NOT c.starter_granted THEN
    INSERT INTO public.fc_user_cards(user_id, card_id, source)
    SELECT uid, x.id, 'starter' FROM (
      SELECT id FROM public.fc_cards WHERE rating BETWEEN 62 AND 78 AND position = 'GK' ORDER BY random() LIMIT 2
    ) x
    UNION ALL
    SELECT uid, y.id, 'starter' FROM (
      SELECT id FROM public.fc_cards WHERE rating BETWEEN 62 AND 79 AND position <> 'GK' ORDER BY random() LIMIT 14
    ) y;
    UPDATE public.fc_clubs SET starter_granted = true WHERE user_id = uid;
    c.starter_granted := true;
  END IF;

  RETURN jsonb_build_object(
    'user_id', uid, 'club_name', c.club_name, 'badge', c.badge, 'stadium', c.stadium,
    'coins', c.coins, 'spin_tokens', c.spin_tokens, 'event_tokens', c.event_tokens,
    'xp', c.xp, 'luck_meter', c.luck_meter, 'last_daily_spin_at', c.last_daily_spin_at
  );
END; $$;

CREATE OR REPLACE FUNCTION public.fc_club_rename(_name text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF length(coalesce(trim(_name),'')) < 3 THEN RAISE EXCEPTION 'invalid_name'; END IF;
  UPDATE public.fc_clubs SET club_name = substr(trim(_name),1,40) WHERE user_id = uid;
END; $$;

CREATE OR REPLACE FUNCTION public.fc_spin(_spin_type text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid();
  st record; c record; card record;
  total integer; roll integer; acc integer := 0; chosen text; r record;
  pity boolean := false;
  dup boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO st FROM public.fc_spin_types WHERE key = _spin_type AND enabled;
  IF st.key IS NULL THEN RAISE EXCEPTION 'spin_unavailable'; END IF;

  PERFORM public.fc_club_get();
  SELECT * INTO c FROM public.fc_clubs WHERE user_id = uid FOR UPDATE;

  IF st.cooldown_hours IS NOT NULL AND c.last_daily_spin_at IS NOT NULL
     AND c.last_daily_spin_at > now() - (st.cooldown_hours || ' hours')::interval THEN
    RAISE EXCEPTION 'cooldown_active';
  END IF;
  IF c.coins < st.cost_coins THEN RAISE EXCEPTION 'insufficient_coins'; END IF;
  IF c.spin_tokens < st.cost_tokens THEN RAISE EXCEPTION 'insufficient_tokens'; END IF;
  IF c.event_tokens < st.cost_event_tokens THEN RAISE EXCEPTION 'insufficient_event_tokens'; END IF;

  -- pity: guarantee at least SPECIAL
  IF c.luck_meter >= st.pity_threshold THEN pity := true; END IF;

  IF pity THEN
    SELECT rarity INTO chosen FROM public.fc_spin_probabilities
      WHERE spin_type = _spin_type AND rarity IN ('SPECIAL','HERO','ICON','LEGENDARY')
      ORDER BY random() LIMIT 1;
  END IF;

  IF chosen IS NULL THEN
    SELECT COALESCE(sum(weight),0) INTO total FROM public.fc_spin_probabilities WHERE spin_type = _spin_type;
    IF total = 0 THEN RAISE EXCEPTION 'spin_pool_empty'; END IF;
    roll := floor(random() * total)::int;
    FOR r IN SELECT rarity, weight FROM public.fc_spin_probabilities WHERE spin_type = _spin_type ORDER BY weight DESC, rarity LOOP
      acc := acc + r.weight;
      IF roll < acc THEN chosen := r.rarity; EXIT; END IF;
    END LOOP;
  END IF;

  SELECT fc.* INTO card FROM public.fc_cards fc
    JOIN public.fc_spin_probabilities p ON p.spin_type = _spin_type AND p.rarity = chosen
    WHERE fc.rarity = chosen AND fc.rating BETWEEN p.min_rating AND p.max_rating
    ORDER BY random() LIMIT 1;
  IF card.id IS NULL THEN
    SELECT * INTO card FROM public.fc_cards WHERE rarity = chosen ORDER BY random() LIMIT 1;
  END IF;
  IF card.id IS NULL THEN
    SELECT * INTO card FROM public.fc_cards ORDER BY random() LIMIT 1;
    chosen := card.rarity;
  END IF;

  SELECT EXISTS(SELECT 1 FROM public.fc_user_cards WHERE user_id = uid AND card_id = card.id) INTO dup;

  UPDATE public.fc_clubs SET
    coins = coins - st.cost_coins,
    spin_tokens = spin_tokens - st.cost_tokens,
    event_tokens = event_tokens - st.cost_event_tokens,
    xp = xp + 25,
    luck_meter = CASE WHEN pity OR chosen IN ('SPECIAL','HERO','ICON','LEGENDARY','EVENT','UNIQUE') THEN 0 ELSE luck_meter + 1 END,
    last_daily_spin_at = CASE WHEN st.cooldown_hours IS NOT NULL THEN now() ELSE last_daily_spin_at END
  WHERE user_id = uid
  RETURNING * INTO c;

  IF st.cost_coins > 0 THEN
    INSERT INTO public.fc_coin_transactions(user_id, amount, currency, reason, balance_after, meta)
    VALUES (uid, -st.cost_coins, 'coins', 'spin:' || _spin_type, c.coins, jsonb_build_object('card_id', card.id));
  END IF;
  IF st.cost_tokens > 0 THEN
    INSERT INTO public.fc_coin_transactions(user_id, amount, currency, reason, balance_after)
    VALUES (uid, -st.cost_tokens, 'spin_tokens', 'spin:' || _spin_type, c.spin_tokens);
  END IF;

  INSERT INTO public.fc_user_cards(user_id, card_id, source) VALUES (uid, card.id, 'spin:' || _spin_type);
  INSERT INTO public.fc_spin_transactions(user_id, spin_type, card_id, rarity, duplicate, pity_used)
    VALUES (uid, _spin_type, card.id, chosen, dup, pity);

  RETURN jsonb_build_object(
    'card', to_jsonb(card), 'rarity', chosen, 'duplicate', dup, 'pity', pity,
    'coins', c.coins, 'spin_tokens', c.spin_tokens, 'luck_meter', c.luck_meter,
    'last_daily_spin_at', c.last_daily_spin_at
  );
END; $$;

CREATE OR REPLACE FUNCTION public.fc_quick_sell(_user_card_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); uc record; val integer; bal integer;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO uc FROM public.fc_user_cards WHERE id = _user_card_id AND user_id = uid FOR UPDATE;
  IF uc.id IS NULL THEN RAISE EXCEPTION 'card_not_owned'; END IF;
  IF uc.locked THEN RAISE EXCEPTION 'card_locked'; END IF;
  IF EXISTS (SELECT 1 FROM public.fc_squads s WHERE s.user_id = uid AND s.slots::text LIKE '%' || uc.id::text || '%') THEN
    RAISE EXCEPTION 'card_in_squad';
  END IF;
  SELECT quick_sell INTO val FROM public.fc_cards WHERE id = uc.card_id;
  DELETE FROM public.fc_user_cards WHERE id = uc.id;
  UPDATE public.fc_clubs SET coins = coins + COALESCE(val,100) WHERE user_id = uid RETURNING coins INTO bal;
  INSERT INTO public.fc_coin_transactions(user_id, amount, currency, reason, balance_after, meta)
    VALUES (uid, COALESCE(val,100), 'coins', 'quick_sell', bal, jsonb_build_object('card_id', uc.card_id));
  RETURN jsonb_build_object('coins', bal, 'gained', COALESCE(val,100));
END; $$;

CREATE OR REPLACE FUNCTION public.fc_set_card_flags(_user_card_id uuid, _locked boolean, _favorite boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.fc_user_cards SET
    locked = COALESCE(_locked, locked),
    favorite = COALESCE(_favorite, favorite)
  WHERE id = _user_card_id AND user_id = uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'card_not_owned'; END IF;
END; $$;

REVOKE ALL ON FUNCTION public.fc_club_get() FROM anon, public;
REVOKE ALL ON FUNCTION public.fc_club_rename(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.fc_spin(text) FROM anon, public;
REVOKE ALL ON FUNCTION public.fc_quick_sell(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.fc_set_card_flags(uuid, boolean, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.fc_club_get() TO authenticated;
GRANT EXECUTE ON FUNCTION public.fc_club_rename(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fc_spin(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fc_quick_sell(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fc_set_card_flags(uuid, boolean, boolean) TO authenticated;

-- seeding helper: creates player + card with derived detailed attributes
CREATE OR REPLACE FUNCTION public.fc_seed_card(
  _key text, _name text, _nation text, _club text, _league text, _pos text,
  _rating integer, _rarity text, _pac integer, _sho integer, _pas integer,
  _dri integer, _def integer, _phy integer, _card_type text DEFAULT 'gold',
  _playstyles text[] DEFAULT '{}', _roles text[] DEFAULT '{}', _alt text[] DEFAULT '{}'
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE pid uuid; cid uuid; j jsonb;
  function_dummy integer;
BEGIN
  INSERT INTO public.fc_players(key,name,nation,club,league,primary_position,alt_positions)
  VALUES (_key,_name,_nation,_club,_league,_pos,_alt)
  ON CONFLICT (key) DO UPDATE SET name = excluded.name
  RETURNING id INTO pid;

  j := jsonb_build_object(
    'acceleration', LEAST(99,_pac+1), 'sprint_speed', GREATEST(40,_pac-1),
    'finishing', _sho, 'shot_power', LEAST(99,_sho+2), 'long_shots', GREATEST(30,_sho-3),
    'volleys', GREATEST(30,_sho-5), 'penalties', _sho,
    'vision', _pas, 'crossing', GREATEST(30,_pas-3), 'free_kick', GREATEST(30,_pas-6),
    'short_passing', LEAST(99,_pas+2), 'long_passing', GREATEST(30,_pas-2), 'curve', _pas,
    'agility', LEAST(99,_dri+1), 'balance', _dri, 'reactions', _rating,
    'ball_control', LEAST(99,_dri+1), 'dribbling', _dri, 'composure', _rating,
    'interceptions', _def, 'heading', GREATEST(30,(_phy+_def)/2), 'defensive_awareness', _def,
    'standing_tackle', LEAST(99,_def+1), 'sliding_tackle', GREATEST(30,_def-2),
    'jumping', _phy, 'stamina', LEAST(99,_phy+3), 'strength', _phy, 'aggression', GREATEST(30,_phy-4)
  );

  INSERT INTO public.fc_cards(
    key,name,rating,position,nation,club,league,card_type,pac,sho,pas,dri,def,phy,
    player_id,rarity,alt_positions,playstyles,roles,attrs,base_rating,quick_sell
  ) VALUES (
    _key || ':' || lower(_rarity), _name, _rating, _pos, _nation, _club, _league, _card_type,
    _pac,_sho,_pas,_dri,_def,_phy, pid, _rarity, _alt, _playstyles, _roles, j, _rating,
    GREATEST(100, (_rating - 55) * 60)
  )
  ON CONFLICT (key) DO UPDATE SET
    rating = excluded.rating, rarity = excluded.rarity, attrs = excluded.attrs,
    player_id = excluded.player_id, quick_sell = excluded.quick_sell,
    playstyles = excluded.playstyles, roles = excluded.roles, alt_positions = excluded.alt_positions
  RETURNING id INTO cid;
  RETURN cid;
END; $$;

REVOKE ALL ON FUNCTION public.fc_seed_card(text,text,text,text,text,text,integer,text,integer,integer,integer,integer,integer,integer,text,text[],text[],text[]) FROM anon, authenticated, public;

-- backfill legacy cards so they fit the new rarity model
UPDATE public.fc_cards SET rarity = CASE
    WHEN card_type = 'icon' THEN 'ICON'
    WHEN card_type = 'promo' THEN 'SPECIAL'
    WHEN card_type = 'totw' THEN 'SUPER_RARE'
    WHEN rating >= 84 THEN 'SUPER_RARE'
    WHEN rating >= 75 THEN 'RARE'
    ELSE 'COMMON' END,
  base_rating = COALESCE(base_rating, rating),
  quick_sell = GREATEST(100, (rating - 55) * 60)
WHERE player_id IS NULL;