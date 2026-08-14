-- FUT progression -> Card Spin loop.
-- Each newly reached FUT level grants exactly 1 spin token.
-- The grant is part of the authoritative match-completion transaction.

CREATE OR REPLACE FUNCTION public.fc_fut_progression_apply_match()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  p public.fc_fut_progression;
  result_xp integer;
  next_level integer;
  next_xp integer;
  levels_gained integer;
BEGIN
  IF TG_OP <> 'UPDATE' OR OLD.status = 'COMPLETED' OR NEW.status <> 'COMPLETED' THEN
    RETURN NEW;
  END IF;

  result_xp := GREATEST(0, NEW.reward_xp);

  INSERT INTO public.fc_fut_progression (user_id)
  VALUES (NEW.user_id)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT *
    INTO p
    FROM public.fc_fut_progression
   WHERE user_id = NEW.user_id
   FOR UPDATE;

  next_level := p.level;
  next_xp := p.level_xp + result_xp;

  WHILE next_xp >= public.fc_fut_progression_required_xp(next_level) LOOP
    next_xp := next_xp - public.fc_fut_progression_required_xp(next_level);
    next_level := next_level + 1;
  END LOOP;

  levels_gained := GREATEST(0, next_level - p.level);

  UPDATE public.fc_fut_progression
     SET matches_played = p.matches_played + 1,
         wins = p.wins + CASE WHEN NEW.user_score > NEW.opponent_score THEN 1 ELSE 0 END,
         draws = p.draws + CASE WHEN NEW.user_score = NEW.opponent_score THEN 1 ELSE 0 END,
         losses = p.losses + CASE WHEN NEW.user_score < NEW.opponent_score THEN 1 ELSE 0 END,
         level = next_level,
         level_xp = next_xp,
         updated_at = now()
   WHERE user_id = NEW.user_id;

  -- Every newly reached level feeds the existing Card Spin economy.
  -- This is intentionally small and capped to the number of levels actually crossed.
  IF levels_gained > 0 THEN
    UPDATE public.fc_clubs
       SET spin_tokens = spin_tokens + levels_gained,
           updated_at = now()
     WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.fc_fut_progression_apply_match() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.fc_fut_progression_get()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  p public.fc_fut_progression;
  next_level integer;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  INSERT INTO public.fc_fut_progression (user_id)
  VALUES (uid)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO p
    FROM public.fc_fut_progression
   WHERE user_id = uid;

  next_level := p.level + 1;

  RETURN jsonb_build_object(
    'level', p.level,
    'xp', p.level_xp,
    'required_xp', public.fc_fut_progression_required_xp(p.level),
    'matches_played', p.matches_played,
    'wins', p.wins,
    'draws', p.draws,
    'losses', p.losses,
    'win_rate', CASE
      WHEN p.matches_played = 0 THEN 0
      ELSE round((p.wins::numeric * 100) / p.matches_played, 1)
    END,
    'next_level_reward', jsonb_build_object(
      'type', 'SPIN_TOKEN',
      'amount', 1,
      'unlocks_elite_opponents_at', 3,
      'next_level', next_level
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fc_fut_progression_get() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_fut_progression_get() TO authenticated;
