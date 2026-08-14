-- FUT MATCH server simulation: client no longer chooses the result directly.
-- The match seed is generated server-side at creation; simulation derives a deterministic score from squad/opponent strength.

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
    readiness jsonb;
    squad_metrics jsonb;
    team_ovr integer;
    seed bigint;
    user_score integer;
    opponent_score integer;
    total_goals integer;
    user_share numeric;
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

    readiness := public.fc_squad_match_readiness(m.squad_id);
    IF coalesce((readiness->>'ready')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'squad_changed_during_match';
    END IF;

    squad_metrics := public.fc_squad_metrics(m.squad_id);
    team_ovr := greatest(1, least(99, coalesce((squad_metrics->>'team_ovr')::integer, 1)));

    -- Deterministic per-match seed derived from match/user context.
    seed := abs(hashtextextended(m.id::text || ':' || uid::text, 0));

    -- Slightly stronger teams get a higher expected goal share, but the outcome is still bounded.
    user_share := greatest(0.25, least(0.75,
      0.50 + ((team_ovr - m.opponent_ovr)::numeric / 100.0)
    ));

    total_goals := 1 + (seed % 5)::integer;
    user_score := round(total_goals * user_share)::integer;
    user_score := greatest(0, least(total_goals, user_score));
    opponent_score := total_goals - user_score;

    -- Keep the simulation non-terminal: an equal score is allowed.
    UPDATE public.fc_matches
       SET user_score = user_score,
           opponent_score = opponent_score,
           updated_at = now()
     WHERE id = m.id;

    RETURN public.fc_match_get(m.id);
END;
$$;

REVOKE ALL ON FUNCTION public.fc_match_simulate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_match_simulate(uuid) TO authenticated;

-- Prevent the old direct client score RPC from being used for new matches.
REVOKE ALL ON FUNCTION public.fc_match_set_score(uuid, integer, integer) FROM PUBLIC, anon, authenticated;
