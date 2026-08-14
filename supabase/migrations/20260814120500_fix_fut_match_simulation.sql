-- Fix variable/column ambiguity in FUT match server simulation.
-- Replaces the simulation function with explicitly named local variables.

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
    v_seed bigint;
    v_user_score integer;
    v_opponent_score integer;
    v_total_goals integer;
    v_user_share numeric;
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

    v_seed := hashtextextended(m.id::text || ':' || uid::text, 0);
    v_seed := mod(abs(v_seed), 2147483647);

    v_user_share := greatest(0.25, least(0.75,
      0.50 + ((team_ovr - m.opponent_ovr)::numeric / 100.0)
    ));

    v_total_goals := 1 + mod(v_seed, 5)::integer;
    v_user_score := round(v_total_goals * v_user_share)::integer;
    v_user_score := greatest(0, least(v_total_goals, v_user_score));
    v_opponent_score := v_total_goals - v_user_score;

    UPDATE public.fc_matches
       SET user_score = v_user_score,
           opponent_score = v_opponent_score,
           updated_at = now()
     WHERE id = m.id;

    RETURN public.fc_match_get(m.id);
END;
$$;

REVOKE ALL ON FUNCTION public.fc_match_simulate(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_match_simulate(uuid) TO authenticated;
