-- FUT Match Engine v2
-- Server-authoritative simulation using squad OVR, chemistry, formation and captain.

CREATE OR REPLACE FUNCTION public.fc_match_simulate(
    _match_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
    m public.fc_matches;
    metrics jsonb;
    team_ovr integer;
    chemistry integer;
    captain_bonus integer := 0;
    attack_rating numeric := 0;
    defense_rating numeric := 0;
    midfield_rating numeric := 0;
    normalized_team numeric;
    normalized_opp numeric;
    attack_chance numeric;
    defense_chance numeric;
    seed_val double precision;
    user_goals integer;
    opp_goals integer;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT * INTO m
      FROM public.fc_matches
     WHERE id = _match_id
       AND user_id = uid
     FOR UPDATE;

    IF m.id IS NULL THEN
        RAISE EXCEPTION 'match_not_found';
    END IF;

    IF m.status <> 'IN_PROGRESS' THEN
        RAISE EXCEPTION 'match_not_in_progress';
    END IF;

    metrics := public.fc_squad_metrics(m.squad_id);
    team_ovr := COALESCE((metrics->>'team_ovr')::integer, 0);
    chemistry := COALESCE((metrics->>'chemistry')::integer, 0);

    IF COALESCE((metrics->>'starting_xi')::integer, 0) <> 11 THEN
        RAISE EXCEPTION 'squad_not_ready';
    END IF;

    SELECT
      COALESCE(avg(CASE WHEN sp.slot_key IN ('LW','ST','RW') THEN c.rating END), 0),
      COALESCE(avg(CASE WHEN sp.slot_key IN ('CM1','CM2','CAM') THEN c.rating END), 0),
      COALESCE(avg(CASE WHEN sp.slot_key IN ('GK','LB','CB1','CB2','RB') THEN c.rating END), 0)
    INTO attack_rating, midfield_rating, defense_rating
    FROM public.fc_squad_players sp
    JOIN public.fc_user_cards uc ON uc.id = sp.user_card_id
    JOIN public.fc_cards c ON c.id = uc.card_id
    WHERE sp.squad_id = m.squad_id
      AND sp.squad_role = 'STARTER';

    SELECT CASE WHEN EXISTS (
      SELECT 1
      FROM public.fc_squad_players sp
      WHERE sp.squad_id = m.squad_id
        AND sp.squad_role = 'STARTER'
        AND sp.is_captain = true
    ) THEN 2 ELSE 0 END
    INTO captain_bonus;

    -- Chemistry and captain slightly modify the effective side strength.
    normalized_team := LEAST(99, GREATEST(1, team_ovr + chemistry * 0.20 + captain_bonus));
    normalized_opp := m.opponent_ovr;

    -- 4-3-3 tactical profile: attack and midfield weigh more than defense.
    attack_chance := LEAST(0.92, GREATEST(0.08,
      0.18 + (attack_rating - normalized_opp) / 125.0 + (midfield_rating - normalized_opp) / 250.0
    ));
    defense_chance := LEAST(0.88, GREATEST(0.12,
      0.16 + (defense_rating - normalized_opp) / 145.0 + chemistry / 500.0
    ));

    -- Stable pseudo-randomness derived from the match id.
    seed_val := ('x' || substr(md5(m.id::text), 1, 12))::bit(48)::bigint / 281474976710656.0;

    user_goals := LEAST(8, GREATEST(0,
      floor(attack_chance * 3.2 + seed_val * 2.0)::integer
    ));

    opp_goals := LEAST(8, GREATEST(0,
      floor((1.10 - defense_chance) * 4.0 + (1.0 - seed_val) * 1.8 + GREATEST(0, normalized_opp - normalized_team) / 35.0)::integer
    ));

    -- A strong side should not be forced into a loss by the deterministic seed alone.
    IF normalized_team >= normalized_opp + 12 AND user_goals <= opp_goals THEN
      user_goals := LEAST(8, opp_goals + 1);
    END IF;

    UPDATE public.fc_matches
       SET user_score = user_goals,
           opponent_score = opp_goals,
           updated_at = now()
     WHERE id = m.id;

    RETURN public.fc_match_get(m.id) || jsonb_build_object(
      'team_ovr', team_ovr,
      'chemistry', chemistry,
      'captain_bonus', captain_bonus,
      'attack_rating', round(attack_rating)::integer,
      'midfield_rating', round(midfield_rating)::integer,
      'defense_rating', round(defense_rating)::integer,
      'simulation_engine', 'v2'
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fc_match_simulate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_match_simulate(uuid) TO authenticated;

-- Keep score mutation server-only. The UI now calls fc_match_simulate instead.
REVOKE ALL ON FUNCTION public.fc_match_set_score(uuid, integer, integer) FROM PUBLIC, anon;
