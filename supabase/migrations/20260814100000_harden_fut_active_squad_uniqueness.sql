-- FUT active squad hardening.
-- A user must have exactly one authoritative active squad.
-- Repair legacy duplicates first, then enforce the invariant at DB level.

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
    ) AS rn
  FROM public.fc_squads
  WHERE is_active = true
)
UPDATE public.fc_squads s
SET is_active = false,
    updated_at = now()
FROM ranked r
WHERE s.id = r.id
  AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS fc_squads_one_active_per_user
  ON public.fc_squads (user_id)
  WHERE is_active = true;

CREATE OR REPLACE FUNCTION public.fc_squad_get_active()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  squad_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT id
    INTO squad_id
    FROM public.fc_squads
   WHERE user_id = uid
     AND is_active = true
   ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
   LIMIT 1;

  IF squad_id IS NULL THEN
    RETURN NULL;
  END IF;

  RETURN public.fc_squad_get(squad_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fc_squad_get_active() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_squad_get_active() TO authenticated;
