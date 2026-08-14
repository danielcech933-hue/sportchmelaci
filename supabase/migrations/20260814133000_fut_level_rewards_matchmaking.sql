-- FUT level-aware matchmaking + rewards.
-- Uses the existing safe progression record and existing FUT club economy.
-- Does not create a second wallet or progression model.

CREATE OR REPLACE FUNCTION public.fc_match_create(
    _opponent_name text DEFAULT 'Chmelová AI',
    _opponent_ovr integer DEFAULT 75
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
    squad_id uuid;
    squad_version integer;
    readiness jsonb;
    metrics jsonb;
    team_ovr integer;
    team_chem integer;
    fut_level integer := 1;
    opponent_ovr_value integer;
    opponent_chem_value integer;
    opponent_tier_value text;
    opponent_style_value text;
    opponent_name_value text;
    new_match public.fc_matches;
    roll numeric;
    delta integer;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT id, version
      INTO squad_id, squad_version
      FROM public.fc_squads
     WHERE user_id = uid
       AND is_active = true
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
     LIMIT 1;

    IF squad_id IS NULL THEN
        RAISE EXCEPTION 'squad_not_found';
    END IF;

    readiness := public.fc_squad_match_readiness(squad_id);
    IF coalesce((readiness->>'ready')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'squad_not_ready';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.fc_matches
         WHERE user_id = uid
           AND status IN ('READY','IN_PROGRESS')
    ) THEN
        RAISE EXCEPTION 'active_match_exists';
    END IF;

    INSERT INTO public.fc_fut_progression (user_id)
    VALUES (uid)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT level INTO fut_level
      FROM public.fc_fut_progression
     WHERE user_id = uid;

    metrics := public.fc_squad_metrics(squad_id);
    team_ovr := greatest(1, least(99, coalesce((metrics->>'team_ovr')::integer, 0)));
    team_chem := greatest(0, least(33, coalesce((metrics->>'chemistry')::integer, 0)));

    -- Elite matchmaking unlocks at FUT level 3.
    -- Higher levels increase the elite queue share while keeping rivals the default.
    roll := random();
    IF fut_level < 3 THEN
        IF roll < 0.30 THEN
            opponent_tier_value := 'UNDERDOG';
            delta := -8 - floor(random() * 5)::integer;
        ELSE
            opponent_tier_value := 'RIVAL';
            delta := -3 + floor(random() * 7)::integer;
        END IF;
    ELSIF fut_level < 6 THEN
        IF roll < 0.20 THEN
            opponent_tier_value := 'UNDERDOG';
            delta := -8 - floor(random() * 5)::integer;
        ELSIF roll < 0.80 THEN
            opponent_tier_value := 'RIVAL';
            delta := -3 + floor(random() * 7)::integer;
        ELSE
            opponent_tier_value := 'ELITE';
            delta := 4 + floor(random() * 5)::integer;
        END IF;
    ELSE
        IF roll < 0.15 THEN
            opponent_tier_value := 'UNDERDOG';
            delta := -8 - floor(random() * 5)::integer;
        ELSIF roll < 0.70 THEN
            opponent_tier_value := 'RIVAL';
            delta := -3 + floor(random() * 7)::integer;
        ELSE
            opponent_tier_value := 'ELITE';
            delta := 4 + floor(random() * 5)::integer;
        END IF;
    END IF;

    opponent_ovr_value := greatest(50, least(95, team_ovr + delta));
    opponent_chem_value := greatest(
        0,
        least(33, team_chem + CASE opponent_tier_value
            WHEN 'UNDERDOG' THEN -4
            WHEN 'RIVAL' THEN floor(random() * 5)::integer - 2
            ELSE 3
        END)
    );

    IF roll < 0.18 THEN
        opponent_style_value := 'ATTACKING';
    ELSIF roll > 0.82 THEN
        opponent_style_value := 'DEFENSIVE';
    ELSE
        opponent_style_value := 'BALANCED';
    END IF;

    opponent_name_value := CASE opponent_tier_value
        WHEN 'UNDERDOG' THEN 'Chmelová Academy'
        WHEN 'ELITE' THEN 'Chmelová Elite XI'
        ELSE 'Chmelová United'
    END;

    INSERT INTO public.fc_matches (
        user_id, squad_id, squad_version,
        opponent_name, opponent_ovr, opponent_chemistry,
        opponent_tier, opponent_style, status
    ) VALUES (
        uid, squad_id, squad_version,
        opponent_name_value, opponent_ovr_value, opponent_chem_value,
        opponent_tier_value, opponent_style_value, 'READY'
    )
    RETURNING * INTO new_match;

    RETURN jsonb_build_object(
        'id', new_match.id,
        'status', new_match.status,
        'squad_id', new_match.squad_id,
        'squad_version', new_match.squad_version,
        'opponent_name', new_match.opponent_name,
        'opponent_ovr', new_match.opponent_ovr,
        'opponent_chemistry', new_match.opponent_chemistry,
        'opponent_tier', new_match.opponent_tier,
        'opponent_style', new_match.opponent_style,
        'user_score', new_match.user_score,
        'opponent_score', new_match.opponent_score,
        'reward_coins', new_match.reward_coins,
        'reward_xp', new_match.reward_xp,
        'fut_level', fut_level,
        'elite_unlocked', fut_level >= 3,
        'created_at', new_match.created_at
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.fc_match_complete(
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
    fut_level integer := 1;
    base_coins integer;
    base_xp integer;
    tier_bonus_coins integer := 0;
    tier_bonus_xp integer := 0;
    level_bonus_coins integer := 0;
    coins_reward integer;
    xp_reward integer;
    result_code text;
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
    IF m.user_score = 0 AND m.opponent_score = 0 THEN
        RAISE EXCEPTION 'match_not_simulated';
    END IF;

    INSERT INTO public.fc_fut_progression (user_id)
    VALUES (uid)
    ON CONFLICT (user_id) DO NOTHING;

    SELECT level INTO fut_level
      FROM public.fc_fut_progression
     WHERE user_id = uid;

    IF m.user_score > m.opponent_score THEN
        result_code := 'WIN';
        base_coins := 250;
        base_xp := 100;
    ELSIF m.user_score = m.opponent_score THEN
        result_code := 'DRAW';
        base_coins := 150;
        base_xp := 70;
    ELSE
        result_code := 'LOSS';
        base_coins := 100;
        base_xp := 40;
    END IF;

    CASE coalesce(m.opponent_tier, 'RIVAL')
        WHEN 'UNDERDOG' THEN
            tier_bonus_coins := 0;
            tier_bonus_xp := 0;
        WHEN 'ELITE' THEN
            tier_bonus_coins := 75;
            tier_bonus_xp := 25;
        ELSE
            tier_bonus_coins := 25;
            tier_bonus_xp := 10;
    END CASE;

    level_bonus_coins := least(50, greatest(0, fut_level - 1) * 5);
    coins_reward := base_coins + tier_bonus_coins + level_bonus_coins;
    xp_reward := base_xp + tier_bonus_xp;

    UPDATE public.fc_clubs
       SET coins = coins + coins_reward,
           xp = xp + xp_reward,
           updated_at = now()
     WHERE user_id = uid;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'club_not_found';
    END IF;

    UPDATE public.fc_matches
       SET status = 'COMPLETED',
           reward_coins = coins_reward,
           reward_xp = xp_reward,
           completed_at = now(),
           updated_at = now()
     WHERE id = m.id;

    RETURN public.fc_match_get(m.id) || jsonb_build_object(
      'result', result_code,
      'reward_applied', true,
      'reward_tier', coalesce(m.opponent_tier, 'RIVAL'),
      'fut_level', fut_level,
      'level_bonus_coins', level_bonus_coins
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fc_match_create(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_match_create(text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.fc_match_complete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_match_complete(uuid) TO authenticated;
