-- FUT progression foundation: persistent record, level and match rewards.

ALTER TABLE public.fc_clubs
  ADD COLUMN IF NOT EXISTS fut_matches_played integer NOT NULL DEFAULT 0 CHECK (fut_matches_played >= 0),
  ADD COLUMN IF NOT EXISTS fut_wins integer NOT NULL DEFAULT 0 CHECK (fut_wins >= 0),
  ADD COLUMN IF NOT EXISTS fut_draws integer NOT NULL DEFAULT 0 CHECK (fut_draws >= 0),
  ADD COLUMN IF NOT EXISTS fut_losses integer NOT NULL DEFAULT 0 CHECK (fut_losses >= 0),
  ADD COLUMN IF NOT EXISTS fut_level integer NOT NULL DEFAULT 1 CHECK (fut_level >= 1),
  ADD COLUMN IF NOT EXISTS fut_level_xp integer NOT NULL DEFAULT 0 CHECK (fut_level_xp >= 0);

CREATE OR REPLACE FUNCTION public.fc_club_fut_progression(_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  c public.fc_clubs;
  required_xp integer;
BEGIN
  IF uid IS NULL OR uid <> _user_id THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO c FROM public.fc_clubs WHERE user_id = uid FOR UPDATE;
  IF c.user_id IS NULL THEN
    RAISE EXCEPTION 'club_not_found';
  END IF;

  required_xp := 250 + ((c.fut_level - 1) * 50);

  RETURN jsonb_build_object(
    'level', c.fut_level,
    'xp', c.fut_level_xp,
    'required_xp', required_xp,
    'matches_played', c.fut_matches_played,
    'wins', c.fut_wins,
    'draws', c.fut_draws,
    'losses', c.fut_losses,
    'win_rate', CASE WHEN c.fut_matches_played = 0 THEN 0 ELSE round(c.fut_wins::numeric * 100 / c.fut_matches_played, 1) END
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
    c public.fc_clubs;
    coins_reward integer;
    xp_reward integer;
    result_text text;
    new_level integer;
    new_xp integer;
    required_xp integer;
BEGIN
    IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

    SELECT * INTO m
      FROM public.fc_matches
     WHERE id = _match_id AND user_id = uid
     FOR UPDATE;
    IF m.id IS NULL THEN RAISE EXCEPTION 'match_not_found'; END IF;
    IF m.status <> 'IN_PROGRESS' THEN RAISE EXCEPTION 'match_not_in_progress'; END IF;
    IF m.user_score = 0 AND m.opponent_score = 0 THEN RAISE EXCEPTION 'match_not_simulated'; END IF;

    result_text := CASE
      WHEN m.user_score > m.opponent_score THEN 'WIN'
      WHEN m.user_score = m.opponent_score THEN 'DRAW'
      ELSE 'LOSS'
    END;
    coins_reward := CASE result_text WHEN 'WIN' THEN 250 WHEN 'DRAW' THEN 150 ELSE 100 END;
    xp_reward := CASE result_text WHEN 'WIN' THEN 100 WHEN 'DRAW' THEN 70 ELSE 40 END;

    SELECT * INTO c FROM public.fc_clubs WHERE user_id = uid FOR UPDATE;
    IF c.user_id IS NULL THEN RAISE EXCEPTION 'club_not_found'; END IF;

    new_level := c.fut_level;
    new_xp := c.fut_level_xp + xp_reward;
    required_xp := 250 + ((new_level - 1) * 50);
    WHILE new_xp >= required_xp LOOP
      new_xp := new_xp - required_xp;
      new_level := new_level + 1;
      required_xp := 250 + ((new_level - 1) * 50);
    END LOOP;

    UPDATE public.fc_clubs
       SET coins = coins + coins_reward,
           xp = xp + xp_reward,
           fut_matches_played = fut_matches_played + 1,
           fut_wins = fut_wins + CASE WHEN result_text = 'WIN' THEN 1 ELSE 0 END,
           fut_draws = fut_draws + CASE WHEN result_text = 'DRAW' THEN 1 ELSE 0 END,
           fut_losses = fut_losses + CASE WHEN result_text = 'LOSS' THEN 1 ELSE 0 END,
           fut_level = new_level,
           fut_level_xp = new_xp,
           updated_at = now()
     WHERE user_id = uid;

    UPDATE public.fc_matches
       SET status = 'COMPLETED',
           reward_coins = coins_reward,
           reward_xp = xp_reward,
           completed_at = now(),
           updated_at = now()
     WHERE id = m.id;

    RETURN to_jsonb((SELECT m2 FROM public.fc_matches m2 WHERE m2.id = m.id)) || jsonb_build_object(
      'result', result_text,
      'progression', jsonb_build_object(
        'level', new_level,
        'xp', new_xp,
        'required_xp', required_xp,
        'matches_played', c.fut_matches_played + 1,
        'wins', c.fut_wins + CASE WHEN result_text = 'WIN' THEN 1 ELSE 0 END,
        'draws', c.fut_draws + CASE WHEN result_text = 'DRAW' THEN 1 ELSE 0 END,
        'losses', c.fut_losses + CASE WHEN result_text = 'LOSS' THEN 1 ELSE 0 END
      )
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fc_club_fut_progression(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_club_fut_progression(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.fc_match_complete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_match_complete(uuid) TO authenticated;
