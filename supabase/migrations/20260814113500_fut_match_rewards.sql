-- FUT match completion reward integration.
-- Rewards are committed atomically with match completion and are paid only once.

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

    IF m.user_score > m.opponent_score THEN
        result_code := 'WIN';
        coins_reward := 250;
        xp_reward := 100;
    ELSIF m.user_score = m.opponent_score THEN
        result_code := 'DRAW';
        coins_reward := 150;
        xp_reward := 70;
    ELSE
        result_code := 'LOSS';
        coins_reward := 100;
        xp_reward := 40;
    END IF;

    -- Match completion and economy update happen in the same transaction.
    -- A completed match cannot be completed twice because of the status guard above.
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
      'reward_applied', true
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fc_match_complete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_match_complete(uuid) TO authenticated;
