-- 1) Role-based entitlements replacing nickname gates
INSERT INTO public.user_roles(user_id, role)
SELECT p.id, r.role
FROM public.profiles p
CROSS JOIN (VALUES ('case_opener'::public.app_role), ('high_roller'::public.app_role)) AS r(role)
WHERE lower(btrim(p.nickname)) IN ('danko','chlaďar','chladar','midas','m1das')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles(user_id, role)
SELECT p.id, 'restricted'::public.app_role
FROM public.profiles p
WHERE lower(btrim(p.nickname)) = 'boro nezastavitelny'
ON CONFLICT (user_id, role) DO NOTHING;

-- 2) Server-authoritative odds model (port of the client odds/markets model)
CREATE OR REPLACE FUNCTION public.match_side_stats(_name text, _sport text, _exclude uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH hist AS (
    SELECT m.sport,
           lower(btrim(m.team_a)) AS ta,
           lower(btrim(m.team_b)) AS tb,
           CASE
             WHEN m.score_a <> m.score_b THEN CASE WHEN m.score_a > m.score_b THEN 'a' ELSE 'b' END
             ELSE (
               SELECT CASE WHEN q.sa > q.sb THEN 'a' WHEN q.sb > q.sa THEN 'b' ELSE NULL END
               FROM (
                 SELECT count(*) FILTER (WHERE (s->>'a')::int > (s->>'b')::int) AS sa,
                        count(*) FILTER (WHERE (s->>'b')::int > (s->>'a')::int) AS sb
                 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(m.sets)='array' THEN m.sets ELSE '[]'::jsonb END) s
               ) q
             )
           END AS w
    FROM public.matches m
    WHERE m.ended_at IS NOT NULL AND m.id <> _exclude
  ), rel AS (
    SELECT sport,
           (ta = lower(btrim(_name))) AS is_a,
           w
    FROM hist
    WHERE w IS NOT NULL AND lower(btrim(_name)) <> '' AND lower(btrim(_name)) NOT IN ('tbd','bye')
      AND (ta = lower(btrim(_name)) OR tb = lower(btrim(_name)))
  )
  SELECT jsonb_build_object(
    'games', count(*),
    'wins', count(*) FILTER (WHERE (is_a AND w='a') OR (NOT is_a AND w='b')),
    'sport_games', count(*) FILTER (WHERE sport = _sport),
    'sport_wins', count(*) FILTER (WHERE sport = _sport AND ((is_a AND w='a') OR (NOT is_a AND w='b')))
  )
  FROM rel;
$function$;

REVOKE ALL ON FUNCTION public.match_side_stats(text, text, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.match_market_odds(_match_id uuid, _market_id text, _option_id text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m public.matches;
  sa jsonb; sb jsonb;
  strA numeric; strB numeric;
  ovA numeric; inA numeric; wA numeric;
  ovB numeric; inB numeric; wB numeric;
  modelA numeric; samples int; conf numeric;
  pool numeric := 0; amtA numeric := 0; amtB numeric := 0; mw numeric := 0; marketA numeric := 0.5;
  probA numeric; probB numeric; edge numeric;
  margin numeric; draw numeric; winmass numeric;
  ids text[] := '{}'; ps numeric[] := '{}'; sides text[] := '{}';
  total numeric := 0; i int; idx int := 0; odds numeric; bestof int;
  mkt text := btrim(lower(coalesce(_market_id,'')));
  opt text := btrim(coalesce(_option_id,''));
BEGIN
  SELECT * INTO m FROM public.matches WHERE id = _match_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;

  sa := public.match_side_stats(m.team_a, m.sport, m.id);
  sb := public.match_side_stats(m.team_b, m.sport, m.id);

  ovA := ((sa->>'wins')::numeric + 1) / ((sa->>'games')::numeric + 2);
  inA := ((sa->>'sport_wins')::numeric + 1) / ((sa->>'sport_games')::numeric + 2);
  wA  := CASE WHEN (sa->>'sport_games')::int >= 2 THEN 0.6 ELSE 0.25 END;
  strA := ovA * (1 - wA) + inA * wA;

  ovB := ((sb->>'wins')::numeric + 1) / ((sb->>'games')::numeric + 2);
  inB := ((sb->>'sport_wins')::numeric + 1) / ((sb->>'sport_games')::numeric + 2);
  wB  := CASE WHEN (sb->>'sport_games')::int >= 2 THEN 0.6 ELSE 0.25 END;
  strB := ovB * (1 - wB) + inB * wB;

  modelA := strA / (strA + strB);
  samples := LEAST((sa->>'games')::int, (sb->>'games')::int);
  conf := LEAST(1, samples / 6.0);
  modelA := 0.5 + (modelA - 0.5) * (0.35 + 0.65 * conf);

  SELECT COALESCE(sum(CASE WHEN b->>'pick'='a' THEN (b->>'amount')::numeric ELSE 0 END),0),
         COALESCE(sum(CASE WHEN b->>'pick'='b' THEN (b->>'amount')::numeric ELSE 0 END),0)
    INTO amtA, amtB
  FROM jsonb_array_elements(CASE WHEN jsonb_typeof(m.bets)='array' THEN m.bets ELSE '[]'::jsonb END) b;
  pool := amtA + amtB;
  IF pool > 0 THEN
    mw := LEAST(0.5, pool / 600.0);
    marketA := amtA / pool;
  END IF;

  probA := modelA * (1 - mw) + marketA * mw;
  probA := LEAST(0.9, GREATEST(0.1, probA));
  probB := 1 - probA;
  edge := abs(probA - 0.5);

  margin := CASE
    WHEN m.sport IN ('football','eafc','rocketleague','basketball','nba2k','nhl') THEN 0.06
    WHEN m.sport IN ('tennis','topspin','volleyball','nohejball','padel','pingpong') THEN 0.05
    ELSE 0.07 END;

  IF mkt = 'winner' THEN
    IF m.sport IN ('football','eafc','rocketleague','foosball') THEN
      draw := LEAST(0.30, GREATEST(0.18, 0.24 + (1 - abs(probA - probB)) * 0.02));
      winmass := 1 - draw;
      ids := ARRAY['win-a','draw','win-b'];
      ps := ARRAY[probA * winmass, draw, probB * winmass];
      sides := ARRAY['a','draw','b'];
    ELSE
      ids := ARRAY['win-a','win-b'];
      ps := ARRAY[probA, probB];
      sides := ARRAY['a','b'];
    END IF;
  ELSIF mkt = 'totals' THEN
    IF m.sport IN ('football','eafc','rocketleague','foosball') THEN
      ids := ARRAY['o15','u15','o25','u25','o35','u35'];
      ps := ARRAY[0.70,0.30,0.54,0.46,0.36,0.64];
    ELSIF m.sport = 'nhl' THEN
      ids := ARRAY['o45','u45','o55','u55'];
      ps := ARRAY[0.52,0.48,0.43,0.57];
    ELSIF m.sport IN ('basketball','nba2k') THEN
      ids := ARRAY['pts-o155.5','pts-u155.5','pts-o175.5','pts-u175.5'];
      ps := ARRAY[0.52,0.48,0.40,0.60];
    ELSE
      RAISE EXCEPTION 'unknown_market';
    END IF;
    sides := ARRAY[NULL,NULL,NULL,NULL,NULL,NULL]::text[];
  ELSIF mkt = 'btts' THEN
    ids := ARRAY['btts-yes','btts-no'];
    ps := ARRAY[LEAST(0.96, GREATEST(0.02, 0.52 + edge * 0.12)), LEAST(0.96, GREATEST(0.02, 0.48 - edge * 0.12))];
    sides := ARRAY['a','b'];
  ELSIF mkt = 'cs' THEN
    ids := ARRAY['cs-1-0','cs-2-0','cs-2-1','cs-0-0','cs-0-1','cs-0-2','cs-1-2'];
    ps := ARRAY[0.11,0.08,0.10,0.07,0.11,0.08,0.10];
    sides := ARRAY['a','a','a','draw','b','b','b'];
  ELSIF mkt = 'handicap' THEN
    IF m.sport IN ('basketball','nba2k') THEN
      ids := ARRAY['hc-a--5.5','hc-a-+5.5','hc-b--5.5','hc-b-+5.5'];
      ps := ARRAY[
        LEAST(0.96, GREATEST(0.02, 0.44 + edge * 0.30)),
        LEAST(0.96, GREATEST(0.02, 0.56 - edge * 0.20)),
        LEAST(0.96, GREATEST(0.02, 0.44 - edge * 0.30)),
        LEAST(0.96, GREATEST(0.02, 0.56 + edge * 0.20))];
    ELSE
      ids := ARRAY['spread-a--1.5','spread-a-+1.5','spread-b--1.5','spread-b-+1.5'];
      ps := ARRAY[
        LEAST(0.96, GREATEST(0.02, 0.30 + edge * 0.30)),
        LEAST(0.96, GREATEST(0.02, 0.65 - edge * 0.10)),
        LEAST(0.96, GREATEST(0.02, 0.30 - edge * 0.30)),
        LEAST(0.96, GREATEST(0.02, 0.65 + edge * 0.10))];
    END IF;
    sides := ARRAY['a','a','b','b'];
  ELSIF mkt = 'puckline' THEN
    ids := ARRAY['pl-a-1.5','pl-a-+1.5','pl-b-1.5','pl-b-+1.5'];
    ps := ARRAY[
      LEAST(0.96, GREATEST(0.02, 0.34 + edge * 0.25)),
      LEAST(0.96, GREATEST(0.02, 0.66 - edge * 0.10)),
      LEAST(0.96, GREATEST(0.02, 0.34 - edge * 0.25)),
      LEAST(0.96, GREATEST(0.02, 0.66 + edge * 0.10))];
    sides := ARRAY['a','a','b','b'];
  ELSIF mkt = 'exact-sets' THEN
    bestof := CASE WHEN m.sport IN ('volleyball','nohejball','darts') THEN 3 ELSE 2 END;
    IF bestof = 2 THEN
      ids := ARRAY['s-2-0','s-2-1','s-1-2','s-0-2'];
      ps := ARRAY[
        LEAST(0.96, GREATEST(0.02, 0.34 + edge * 0.28)), 0.22, 0.22,
        LEAST(0.96, GREATEST(0.02, 0.34 - edge * 0.28))];
      sides := ARRAY['a','a','b','b'];
    ELSE
      ids := ARRAY['s-3-0','s-3-1','s-3-2','s-2-3','s-1-3','s-0-3'];
      ps := ARRAY[
        LEAST(0.96, GREATEST(0.02, 0.20 + edge * 0.16)), 0.20, 0.14, 0.14, 0.16,
        LEAST(0.96, GREATEST(0.02, 0.16 - edge * 0.16))];
      sides := ARRAY['a','a','a','b','b','b'];
    END IF;
  ELSIF mkt = 'set-handicap' THEN
    ids := ARRAY['gh-a--1.5','gh-a-+1.5','gh-b--1.5','gh-b-+1.5'];
    ps := ARRAY[
      LEAST(0.96, GREATEST(0.02, 0.38 + edge * 0.22)),
      LEAST(0.96, GREATEST(0.02, 0.62 - edge * 0.12)),
      LEAST(0.96, GREATEST(0.02, 0.38 - edge * 0.22)),
      LEAST(0.96, GREATEST(0.02, 0.62 + edge * 0.12))];
    sides := ARRAY['a','a','b','b'];
  ELSE
    RAISE EXCEPTION 'unknown_market';
  END IF;

  FOR i IN 1..array_length(ids,1) LOOP
    IF ids[i] = opt THEN idx := i; END IF;
    total := total + GREATEST(0.001, ps[i]);
  END LOOP;
  IF idx = 0 THEN RAISE EXCEPTION 'unknown_option'; END IF;

  odds := round(1 / LEAST(0.98, GREATEST(0.02, (ps[idx] / total) * (1 + margin))), 2);
  odds := LEAST(50, GREATEST(1.05, odds));

  RETURN jsonb_build_object('odds', odds, 'side', sides[idx]);
END;
$function$;

REVOKE ALL ON FUNCTION public.match_market_odds(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.match_market_odds(uuid, text, text) TO authenticated;

-- 3) place_market_bet: odds are server-authoritative
CREATE OR REPLACE FUNCTION public.place_market_bet(_match_id uuid, _market_id text, _option_id text, _pick text, _amount numeric, _locked_odds numeric, _note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE uid uuid:=auth.uid(); nick text; bal numeric; m record; new_bet jsonb; bet_id uuid:=gen_random_uuid(); q jsonb; srv_odds numeric; srv_side text;
BEGIN
 IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
 IF _market_id IS NULL OR length(trim(_market_id))=0 THEN RAISE EXCEPTION 'invalid_market'; END IF;
 IF _option_id IS NULL OR length(trim(_option_id))=0 THEN RAISE EXCEPTION 'invalid_option'; END IF;
 IF _pick NOT IN ('a','b','draw') THEN RAISE EXCEPTION 'invalid_pick'; END IF;
 IF _amount IS NULL OR _amount<1 OR _amount>10000 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
 SELECT nickname,balance INTO nick,bal FROM public.profiles WHERE id=uid FOR UPDATE;
 IF nick IS NULL THEN RAISE EXCEPTION 'no_profile'; END IF;
 IF bal<_amount THEN RAISE EXCEPTION 'insufficient_balance'; END IF;
 SELECT id,ended_at,bets INTO m FROM public.matches WHERE id=_match_id FOR UPDATE;
 IF m.id IS NULL THEN RAISE EXCEPTION 'match_not_found'; END IF;
 IF m.ended_at IS NOT NULL THEN RAISE EXCEPTION 'match_ended'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(COALESCE(m.bets,'[]'::jsonb)) b WHERE b->>'userId'=uid::text) THEN RAISE EXCEPTION 'already_bet'; END IF;

 -- Server computes the price; the client-supplied _locked_odds is ignored.
 q := public.match_market_odds(_match_id, trim(_market_id), trim(_option_id));
 srv_odds := (q->>'odds')::numeric;
 srv_side := q->>'side';
 IF srv_odds IS NULL OR srv_odds<1.05 OR srv_odds>50 THEN RAISE EXCEPTION 'invalid_odds'; END IF;
 IF srv_side IS NOT NULL AND srv_side <> _pick THEN RAISE EXCEPTION 'invalid_pick'; END IF;

 PERFORM set_config('app.bypass_match_guard','on',true);
 new_bet:=jsonb_build_object('id',bet_id::text,'userId',uid::text,'bettor',nick,'pick',_pick,'amount',round(_amount,2),'marketId',trim(_market_id),'optionId',trim(_option_id),'lockedOdds',round(srv_odds,2),'note',NULLIF(trim(_note),''),'status','open','payout',0,'createdAt',(extract(epoch from now())*1000)::bigint);
 UPDATE public.matches SET bets=COALESCE(bets,'[]'::jsonb)||jsonb_build_array(new_bet) WHERE id=_match_id;
 UPDATE public.profiles SET balance=round(balance-_amount,2) WHERE id=uid;
 PERFORM set_config('app.bypass_match_guard','off',true);
 RETURN jsonb_build_object('bet_id',bet_id,'balance',round(bal-_amount,2),'locked_odds',round(srv_odds,2));
EXCEPTION WHEN others THEN PERFORM set_config('app.bypass_match_guard','off',true); RAISE;
END;
$function$;

-- 4) save_match_score: confirmed matches are admin-only, plus score/set validation
CREATE OR REPLACE FUNCTION public.save_match_score(_match_id uuid, _score_a integer, _score_b integer, _sets jsonb DEFAULT '[]'::jsonb, _ended_at timestamp with time zone DEFAULT NULL::timestamp with time zone)
RETURNS matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_match public.matches;
  v_uid uuid := auth.uid();
  v_admin boolean;
  v_score_a integer := GREATEST(0, COALESCE(_score_a,0));
  v_score_b integer := GREATEST(0, COALESCE(_score_b,0));
  v_sets jsonb := COALESCE(_sets,'[]'::jsonb);
  s jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF _score_a < 0 OR _score_b < 0 THEN RAISE EXCEPTION 'score cannot be negative'; END IF;
  IF v_score_a > 999 OR v_score_b > 999 THEN RAISE EXCEPTION 'score out of range'; END IF;
  IF jsonb_typeof(v_sets) <> 'array' THEN RAISE EXCEPTION 'invalid sets payload'; END IF;
  IF jsonb_array_length(v_sets) > 15 THEN RAISE EXCEPTION 'too many sets'; END IF;
  FOR s IN SELECT value FROM jsonb_array_elements(v_sets) LOOP
    IF jsonb_typeof(s) <> 'object' OR NOT (s ? 'a') OR NOT (s ? 'b') THEN RAISE EXCEPTION 'invalid set entry'; END IF;
    IF jsonb_typeof(s->'a') <> 'number' OR jsonb_typeof(s->'b') <> 'number' THEN RAISE EXCEPTION 'invalid set entry'; END IF;
    IF (s->>'a')::numeric < 0 OR (s->>'b')::numeric < 0 OR (s->>'a')::numeric > 999 OR (s->>'b')::numeric > 999 THEN RAISE EXCEPTION 'set score out of range'; END IF;
  END LOOP;

  v_admin := public.has_role(v_uid, 'admin'::public.app_role);

  SELECT * INTO v_match FROM public.matches WHERE id=_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match not found'; END IF;
  IF v_match.owner_id <> v_uid AND NOT v_admin THEN RAISE EXCEPTION 'only the match owner may update the score'; END IF;
  IF v_match.confirmed_at IS NOT NULL AND NOT v_admin THEN RAISE EXCEPTION 'confirmed match can only be changed by an admin'; END IF;

  IF v_match.match_format='2v2' AND jsonb_array_length(v_sets)>0 THEN
    SELECT COUNT(*) FILTER (WHERE (s2->>'a')::int > (s2->>'b')::int),
           COUNT(*) FILTER (WHERE (s2->>'b')::int > (s2->>'a')::int)
      INTO v_score_a, v_score_b
    FROM jsonb_array_elements(v_sets) s2;
  END IF;

  PERFORM set_config('app.bypass_match_guard','on',true);
  UPDATE public.matches
     SET score_a=v_score_a,
         score_b=v_score_b,
         sets=v_sets,
         ended_at=_ended_at
   WHERE id=_match_id
   RETURNING * INTO v_match;
  PERFORM set_config('app.bypass_match_guard','off',true);
  RETURN v_match;
EXCEPTION WHEN others THEN
  PERFORM set_config('app.bypass_match_guard','off',true);
  RAISE;
END;
$function$;

-- 5) legacy fc_save_squad: recompute metrics server-side
CREATE OR REPLACE FUNCTION public.fc_save_squad(_formation text, _slots jsonb, _team_ovr integer, _chemistry integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _s jsonb := COALESCE(_slots,'{}'::jsonb);
  _ovr int := 0;
  _chem int := 0;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF jsonb_typeof(_s) <> 'object' THEN RAISE EXCEPTION 'invalid_slots'; END IF;

  SELECT COALESCE(round(avg(c.rating))::int,0) INTO _ovr
  FROM jsonb_each_text(_s) e
  JOIN public.fc_user_cards uc ON uc.id::text = e.value AND uc.user_id = _uid
  JOIN public.fc_cards c ON c.id = uc.card_id;

  SELECT LEAST(33, COALESCE(sum(link_score),0))::int INTO _chem
  FROM (
    SELECT CASE WHEN count(DISTINCT c.club)=1 THEN 3 WHEN count(DISTINCT c.club)<=2 THEN 1 ELSE 0 END AS link_score
    FROM jsonb_each_text(_s) e
    JOIN public.fc_user_cards uc ON uc.id::text = e.value AND uc.user_id = _uid
    JOIN public.fc_cards c ON c.id = uc.card_id
    GROUP BY c.league
  ) q;

  INSERT INTO fc_squads(user_id, formation, slots, team_ovr, chemistry)
  VALUES (_uid, coalesce(_formation,'4-3-3'), _s, _ovr, _chem)
  ON CONFLICT (user_id) DO UPDATE SET formation = excluded.formation, slots = excluded.slots,
    team_ovr = excluded.team_ovr, chemistry = excluded.chemistry, updated_at = now();
END;
$function$;

-- 6) Arcade: no reward from an unconfirmed self-report
ALTER TABLE public.arcade_matches
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz,
  ADD COLUMN IF NOT EXISTS confirmed_by uuid,
  ADD COLUMN IF NOT EXISTS points_awarded boolean NOT NULL DEFAULT false;

UPDATE public.arcade_matches SET points_awarded = true WHERE points_awarded = false AND winner_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.arcade_report_match(_opponent uuid, _score_a integer, _score_b integer)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  win uuid;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _score_a < 0 OR _score_b < 0 OR _score_a > 999 OR _score_b > 999 THEN RAISE EXCEPTION 'invalid_score'; END IF;
  IF _opponent = uid THEN RAISE EXCEPTION 'invalid_opponent'; END IF;
  IF _opponent IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _opponent) THEN
    RAISE EXCEPTION 'invalid_opponent';
  END IF;
  IF _score_a > _score_b THEN win := uid;
  ELSIF _score_b > _score_a THEN win := _opponent;
  ELSE win := NULL; END IF;

  -- Reported results start unconfirmed; points are only paid out on opponent confirmation.
  INSERT INTO public.arcade_matches(player_a, player_b, score_a, score_b, winner_id, points_awarded)
    VALUES (uid, _opponent, _score_a, _score_b, win, false) RETURNING id INTO new_id;

  RETURN new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.arcade_confirm_match(_match_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE uid uuid := auth.uid(); r public.arcade_matches;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO r FROM public.arcade_matches WHERE id = _match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'match_not_found'; END IF;
  IF r.player_b IS NULL OR r.player_b <> uid THEN RAISE EXCEPTION 'only_opponent_can_confirm'; END IF;
  IF r.confirmed_at IS NOT NULL THEN
    RETURN jsonb_build_object('match_id', r.id, 'already_confirmed', true);
  END IF;

  UPDATE public.arcade_matches
     SET confirmed_at = now(), confirmed_by = uid, points_awarded = (winner_id IS NOT NULL)
   WHERE id = r.id;

  IF r.winner_id IS NOT NULL THEN
    UPDATE public.profiles SET arcade_points = arcade_points + 25 WHERE id = r.winner_id;
    PERFORM public.notify_win(r.winner_id, 'arcade_win', '🕹️ Arcade výhra',
      to_char(now() AT TIME ZONE 'Europe/Prague', 'DD.MM.YYYY HH24:MI') ||
      ' • ' || r.score_a || ':' || r.score_b || ' • +25 arcade bodů');
  END IF;

  RETURN jsonb_build_object('match_id', r.id, 'already_confirmed', false, 'winner_id', r.winner_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.arcade_confirm_match(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.arcade_confirm_match(uuid) TO authenticated;

-- 7) Trigger-only helpers: fixed search_path, not callable from the API
ALTER FUNCTION public.slot_normalize_bonus_options() SET search_path TO 'public';
ALTER FUNCTION public.guard_direct_message_update() SET search_path TO 'public';
REVOKE ALL ON FUNCTION public.validate_match_lineups() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.slot_normalize_bonus_options() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_direct_message_update() FROM PUBLIC, anon, authenticated;