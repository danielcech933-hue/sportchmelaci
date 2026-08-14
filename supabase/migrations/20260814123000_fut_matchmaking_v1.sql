-- FUT Matchmaking v1
-- Opponent strength is derived server-side from the player's authoritative squad.
-- Client-supplied opponent name/OVR are retained in the function signature for
-- backwards compatibility but are intentionally ignored.

ALTER TABLE public.fc_matches
  ADD COLUMN IF NOT EXISTS opponent_chemistry integer NOT NULL DEFAULT 18
    CHECK (opponent_chemistry BETWEEN 0 AND 33),
  ADD COLUMN IF NOT EXISTS opponent_tier text NOT NULL DEFAULT 'RIVAL'
    CHECK (opponent_tier IN ('UNDERDOG','RIVAL','ELITE')),
  ADD COLUMN IF NOT EXISTS opponent_style text NOT NULL DEFAULT 'BALANCED'
    CHECK (opponent_style IN ('BALANCED','ATTACKING','DEFENSIVE'));

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
        SELECT 1
        FROM public.fc_matches
        WHERE user_id = uid
          AND status IN ('READY','IN_PROGRESS')
    ) THEN
        RAISE EXCEPTION 'active_match_exists';
    END IF;

    metrics := public.fc_squad_metrics(squad_id);
    team_ovr := greatest(1, least(99, coalesce((metrics->>'team_ovr')::integer, 0)));
    team_chem := greatest(0, least(33, coalesce((metrics->>'chemistry')::integer, 0)));

    -- Matchmaking tiers are intentionally close to the player's squad strength:
    -- 25% underdog, 50% rival, 25% elite. The exact offset is capped to keep
    -- low-rated squads from receiving impossible opponents.
    roll := random();
    IF roll < 0.25 THEN
        opponent_tier_value := 'UNDERDOG';
        delta := -8 - floor(random() * 5)::integer; -- -8..-12
    ELSIF roll < 0.75 THEN
        opponent_tier_value := 'RIVAL';
        delta := -3 + floor(random() * 7)::integer; -- -3..+3
    ELSE
        opponent_tier_value := 'ELITE';
        delta := 4 + floor(random() * 5)::integer; -- +4..+8
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
        user_id,
        squad_id,
        squad_version,
        opponent_name,
        opponent_ovr,
        opponent_chemistry,
        opponent_tier,
        opponent_style,
        status
    ) VALUES (
        uid,
        squad_id,
        squad_version,
        opponent_name_value,
        opponent_ovr_value,
        opponent_chem_value,
        opponent_tier_value,
        opponent_style_value,
        'READY'
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
        'created_at', new_match.created_at
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fc_match_create(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_match_create(text, integer) TO authenticated;
