GRANT SELECT, INSERT, UPDATE, DELETE ON public.tournament_teams TO authenticated;
GRANT ALL ON public.tournament_teams TO service_role;

CREATE OR REPLACE FUNCTION public.tournament_teams_unique_players()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  dup text;
BEGIN
  IF NEW.players IS NULL THEN
    NEW.players := ARRAY[]::text[];
  END IF;

  SELECT lower(p) INTO dup
  FROM unnest(NEW.players) p
  GROUP BY lower(p)
  HAVING count(*) > 1
  LIMIT 1;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'duplicate_player:%', dup;
  END IF;

  SELECT p INTO dup
  FROM public.tournament_teams t, unnest(t.players) p
  WHERE t.tournament_id = NEW.tournament_id
    AND t.id <> NEW.id
    AND lower(p) IN (SELECT lower(x) FROM unnest(NEW.players) x)
  LIMIT 1;
  IF dup IS NOT NULL THEN
    RAISE EXCEPTION 'player_in_other_team:%', dup;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_tournament_teams_unique_players ON public.tournament_teams;
CREATE TRIGGER trg_tournament_teams_unique_players
BEFORE INSERT OR UPDATE ON public.tournament_teams
FOR EACH ROW EXECUTE FUNCTION public.tournament_teams_unique_players();