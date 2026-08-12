-- CHMELOVCI CUP — harden the bonus contract.
-- The client sends only the selected multiplier; therefore each pending
-- bonus session must expose unique multipliers. This migration also repairs
-- sessions created by older versions that could contain duplicate multipliers.

CREATE OR REPLACE FUNCTION public.slot_normalize_bonus_options()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  item jsonb;
  normalized jsonb := '[]'::jsonb;
  fallback jsonb := jsonb_build_array(
    jsonb_build_object('spins',10,'mult',2),
    jsonb_build_object('spins',15,'mult',3),
    jsonb_build_object('spins',25,'mult',4),
    jsonb_build_object('spins',35,'mult',5),
    jsonb_build_object('spins',50,'mult',8)
  );
  candidate jsonb;
BEGIN
  IF NEW.pending_pick AND jsonb_typeof(NEW.options) = 'array' THEN
    -- Keep the first occurrence of every multiplier.
    FOR item IN SELECT value FROM jsonb_array_elements(NEW.options) LOOP
      IF jsonb_typeof(item) = 'object'
         AND (item ? 'spins')
         AND (item ? 'mult')
         AND NOT EXISTS (
           SELECT 1
           FROM jsonb_array_elements(normalized) existing
           WHERE existing->>'mult' = item->>'mult'
         ) THEN
        normalized := normalized || jsonb_build_array(item);
      END IF;
    END LOOP;

    -- Always leave the UI with three genuinely different choices.
    FOR candidate IN SELECT value FROM jsonb_array_elements(fallback) LOOP
      EXIT WHEN jsonb_array_length(normalized) >= 3;
      IF NOT EXISTS (
        SELECT 1
        FROM jsonb_array_elements(normalized) existing
        WHERE existing->>'mult' = candidate->>'mult'
      ) THEN
        normalized := normalized || jsonb_build_array(candidate);
      END IF;
    END LOOP;

    NEW.options := normalized;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_slot_bonus_unique_options ON public.slot_bonus_sessions;
CREATE TRIGGER trg_slot_bonus_unique_options
BEFORE INSERT OR UPDATE OF options, pending_pick
ON public.slot_bonus_sessions
FOR EACH ROW
EXECUTE FUNCTION public.slot_normalize_bonus_options();

-- Existing pending sessions are normalized as well.
UPDATE public.slot_bonus_sessions
SET options = options,
    updated_at = now()
WHERE pending_pick = true;

-- Make the legacy multiplier-only picker fail safely if an old malformed
-- session still contains the same multiplier more than once. It must never
-- silently pick a different number of free spins than the user selected.
CREATE OR REPLACE FUNCTION public.slot_pick_bonus(_multiplier numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  uid uuid := auth.uid();
  sess public.slot_bonus_sessions%ROWTYPE;
  opt jsonb;
  valid boolean := false;
  spins integer := 0;
  matches integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO sess
  FROM public.slot_bonus_sessions
  WHERE user_id = uid
  FOR UPDATE;

  IF NOT FOUND OR NOT sess.pending_pick THEN
    RAISE EXCEPTION 'no_bonus_pick';
  END IF;

  FOR opt IN SELECT value FROM jsonb_array_elements(sess.options) LOOP
    IF (opt->>'mult')::numeric = _multiplier THEN
      matches := matches + 1;
      spins := (opt->>'spins')::integer;
      valid := true;
    END IF;
  END LOOP;

  IF matches <> 1 OR NOT valid OR spins < 1 OR spins > 50 THEN
    RAISE EXCEPTION 'invalid_bonus_pick';
  END IF;

  UPDATE public.slot_bonus_sessions
  SET multiplier = _multiplier,
      spins_remaining = spins,
      pending_pick = false,
      updated_at = now()
  WHERE user_id = uid;

  RETURN jsonb_build_object(
    'ok', true,
    'spins', spins,
    'multiplier', _multiplier
  );
END;
$$;

REVOKE ALL ON FUNCTION public.slot_normalize_bonus_options() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.slot_pick_bonus(numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.slot_pick_bonus(numeric) TO authenticated;
