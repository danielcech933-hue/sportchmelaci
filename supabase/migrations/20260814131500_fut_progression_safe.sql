-- FUT progression without touching the existing club schema.
-- The progression record is derived from completed authoritative matches.

CREATE TABLE IF NOT EXISTS public.fc_fut_progression (
    user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    matches_played integer NOT NULL DEFAULT 0 CHECK (matches_played >= 0),
    wins integer NOT NULL DEFAULT 0 CHECK (wins >= 0),
    draws integer NOT NULL DEFAULT 0 CHECK (draws >= 0),
    losses integer NOT NULL DEFAULT 0 CHECK (losses >= 0),
    level integer NOT NULL DEFAULT 1 CHECK (level >= 1),
    level_xp integer NOT NULL DEFAULT 0 CHECK (level_xp >= 0),
    updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fc_fut_progression ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fc_fut_progression_select_own ON public.fc_fut_progression;
CREATE POLICY fc_fut_progression_select_own
  ON public.fc_fut_progression
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS fc_fut_progression_insert_none ON public.fc_fut_progression;
CREATE POLICY fc_fut_progression_insert_none
  ON public.fc_fut_progression
  FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS fc_fut_progression_update_none ON public.fc_fut_progression;
CREATE POLICY fc_fut_progression_update_none
  ON public.fc_fut_progression
  FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS fc_fut_progression_delete_none ON public.fc_fut_progression;
CREATE POLICY fc_fut_progression_delete_none
  ON public.fc_fut_progression
  FOR DELETE
  TO authenticated
  USING (false);

CREATE OR REPLACE FUNCTION public.fc_fut_progression_required_xp(_level integer)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT 250 + ((_level - 1) * 50)
$$;

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

  UPDATE public.fc_fut_progression
     SET matches_played = p.matches_played + 1,
         wins = p.wins + CASE WHEN NEW.user_score > NEW.opponent_score THEN 1 ELSE 0 END,
         draws = p.draws + CASE WHEN NEW.user_score = NEW.opponent_score THEN 1 ELSE 0 END,
         losses = p.losses + CASE WHEN NEW.user_score < NEW.opponent_score THEN 1 ELSE 0 END,
         level = next_level,
         level_xp = next_xp,
         updated_at = now()
   WHERE user_id = NEW.user_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fc_fut_progression_on_match_completed ON public.fc_matches;
CREATE TRIGGER fc_fut_progression_on_match_completed
AFTER UPDATE OF status ON public.fc_matches
FOR EACH ROW
EXECUTE FUNCTION public.fc_fut_progression_apply_match();

CREATE OR REPLACE FUNCTION public.fc_fut_progression_get()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  p public.fc_fut_progression;
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
    END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.fc_fut_progression_required_xp(integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fc_fut_progression_get() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_fut_progression_get() TO authenticated;
