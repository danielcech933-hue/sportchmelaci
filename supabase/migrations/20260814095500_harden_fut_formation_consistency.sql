-- FUT formation consistency guard.
-- The current SquadBuilder renders a canonical 4-3-3 slot map. Do not allow
-- the authoritative squad row to claim a different formation until a matching
-- slot schema is implemented end-to-end.

CREATE OR REPLACE FUNCTION public.fc_squad_formation_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF trim(coalesce(NEW.formation, '')) <> '4-3-3' THEN
    RAISE EXCEPTION 'unsupported_formation';
  END IF;
  NEW.formation := '4-3-3';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS fc_squad_formation_consistency ON public.fc_squads;
CREATE TRIGGER fc_squad_formation_consistency
BEFORE INSERT OR UPDATE OF formation ON public.fc_squads
FOR EACH ROW
EXECUTE FUNCTION public.fc_squad_formation_guard();

-- Reconcile any legacy rows so the authoritative DB state matches the
-- canonical frontend slot map.
UPDATE public.fc_squads
SET formation = '4-3-3'
WHERE formation IS DISTINCT FROM '4-3-3';

REVOKE ALL ON FUNCTION public.fc_squad_formation_guard() FROM PUBLIC, anon, authenticated;
