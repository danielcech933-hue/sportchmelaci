-- FUT captain management.
-- Allows the client to change captain without rewriting the whole roster.
-- The selected card must already be a STARTER in the caller's squad.

CREATE OR REPLACE FUNCTION public.fc_squad_set_captain(
    _squad_id uuid,
    _user_card_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM public.fc_squads s
         WHERE s.id = _squad_id
           AND s.user_id = uid
           AND s.is_active = true
    ) THEN
        RAISE EXCEPTION 'squad_not_found';
    END IF;

    IF NOT EXISTS (
        SELECT 1
          FROM public.fc_squad_players sp
         WHERE sp.squad_id = _squad_id
           AND sp.user_card_id = _user_card_id
           AND sp.squad_role = 'STARTER'
    ) THEN
        RAISE EXCEPTION 'captain_must_be_starter';
    END IF;

    UPDATE public.fc_squad_players
       SET is_captain = false
     WHERE squad_id = _squad_id;

    UPDATE public.fc_squad_players
       SET is_captain = true
     WHERE squad_id = _squad_id
       AND user_card_id = _user_card_id
       AND squad_role = 'STARTER';

    UPDATE public.fc_squads
       SET version = version + 1,
           updated_at = now()
     WHERE id = _squad_id
       AND user_id = uid;

    RETURN public.fc_squad_get(_squad_id);
END;
$$;

REVOKE ALL ON FUNCTION public.fc_squad_set_captain(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_squad_set_captain(uuid, uuid) TO authenticated;
