-- ============================================================
-- SPORTCHMELÁCI ULTIMATE TEAM
-- PHASE 2A REPAIR
-- Squad Players Foundation
--
-- IMPORTANT:
-- Existing public.fc_squads is intentionally NOT modified.
-- It currently uses user_id as its primary key.
-- ============================================================


-- ============================================================
-- 1. CREATE SQUAD PLAYERS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fc_squad_players (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Current squad identity.
    -- fc_squads currently has one squad per user,
    -- with user_id as its primary key.
    squad_user_id uuid NOT NULL,

    -- Concrete owned card from the user's collection.
    user_card_id uuid NOT NULL,

    -- UI / formation slot.
    -- Examples:
    -- GK
    -- LB
    -- LCB
    -- RCB
    -- RB
    -- LCM
    -- CM
    -- RCM
    -- LW
    -- ST
    -- RW
    slot_key text NOT NULL,

    -- Actual position assigned in the squad.
    position text NOT NULL,

    -- Squad section.
    squad_role text NOT NULL DEFAULT 'STARTER',

    -- Captain flag.
    is_captain boolean NOT NULL DEFAULT false,

    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fc_squad_players_role_check
        CHECK (
            squad_role IN (
                'STARTER',
                'BENCH',
                'RESERVE'
            )
        ),

    CONSTRAINT fc_squad_players_slot_check
        CHECK (
            length(trim(slot_key)) > 0
            AND length(trim(slot_key)) <= 32
        ),

    CONSTRAINT fc_squad_players_position_check
        CHECK (
            length(trim(position)) > 0
            AND length(trim(position)) <= 16
        ),

    CONSTRAINT fc_squad_players_squad_fk
        FOREIGN KEY (squad_user_id)
        REFERENCES public.fc_squads(user_id)
        ON DELETE CASCADE,

    CONSTRAINT fc_squad_players_card_fk
        FOREIGN KEY (user_card_id)
        REFERENCES public.fc_user_cards(id)
        ON DELETE RESTRICT,

    -- A slot can only contain one card.
    CONSTRAINT fc_squad_players_unique_slot
        UNIQUE (squad_user_id, slot_key),

    -- The same owned card cannot appear twice
    -- in the same squad.
    CONSTRAINT fc_squad_players_unique_card
        UNIQUE (squad_user_id, user_card_id)
);


-- ============================================================
-- 2. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS
    fc_squad_players_squad_user_idx
ON public.fc_squad_players (squad_user_id);


CREATE INDEX IF NOT EXISTS
    fc_squad_players_user_card_idx
ON public.fc_squad_players (user_card_id);


CREATE INDEX IF NOT EXISTS
    fc_squad_players_role_idx
ON public.fc_squad_players (
    squad_user_id,
    squad_role
);


-- ============================================================
-- 3. UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION public.fc_squad_players_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS
    fc_squad_players_updated_at
ON public.fc_squad_players;


CREATE TRIGGER
    fc_squad_players_updated_at
BEFORE UPDATE ON public.fc_squad_players
FOR EACH ROW
EXECUTE FUNCTION public.fc_squad_players_set_updated_at();


-- ============================================================
-- 4. OWNERSHIP PROTECTION
--
-- A player can only be inserted into a squad if the
-- corresponding user_card belongs to the same user.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fc_squad_players_validate_ownership()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    squad_owner uuid;
    card_owner uuid;
BEGIN

    SELECT user_id
    INTO squad_owner
    FROM public.fc_squads
    WHERE user_id = NEW.squad_user_id;

    IF squad_owner IS NULL THEN
        RAISE EXCEPTION 'squad_not_found';
    END IF;


    SELECT user_id
    INTO card_owner
    FROM public.fc_user_cards
    WHERE id = NEW.user_card_id;

    IF card_owner IS NULL THEN
        RAISE EXCEPTION 'user_card_not_found';
    END IF;


    IF squad_owner <> card_owner THEN
        RAISE EXCEPTION 'card_not_owned_by_squad_owner';
    END IF;


    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS
    fc_squad_players_ownership
ON public.fc_squad_players;


CREATE TRIGGER
    fc_squad_players_ownership
BEFORE INSERT OR UPDATE
ON public.fc_squad_players
FOR EACH ROW
EXECUTE FUNCTION public.fc_squad_players_validate_ownership();


-- ============================================================
-- 5. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.fc_squad_players
ENABLE ROW LEVEL SECURITY;


DROP POLICY IF EXISTS
    fc_squad_players_select_own
ON public.fc_squad_players;


CREATE POLICY
    fc_squad_players_select_own
ON public.fc_squad_players
FOR SELECT
TO authenticated
USING (
    squad_user_id = auth.uid()
);


DROP POLICY IF EXISTS
    fc_squad_players_insert_own
ON public.fc_squad_players;


CREATE POLICY
    fc_squad_players_insert_own
ON public.fc_squad_players
FOR INSERT
TO authenticated
WITH CHECK (
    squad_user_id = auth.uid()
);


DROP POLICY IF EXISTS
    fc_squad_players_update_own
ON public.fc_squad_players;


CREATE POLICY
    fc_squad_players_update_own
ON public.fc_squad_players
FOR UPDATE
TO authenticated
USING (
    squad_user_id = auth.uid()
)
WITH CHECK (
    squad_user_id = auth.uid()
);


DROP POLICY IF EXISTS
    fc_squad_players_delete_own
ON public.fc_squad_players;


CREATE POLICY
    fc_squad_players_delete_own
ON public.fc_squad_players
FOR DELETE
TO authenticated
USING (
    squad_user_id = auth.uid()
);


-- ============================================================
-- 6. PRIVILEGES
-- ============================================================

REVOKE ALL
ON public.fc_squad_players
FROM anon;


GRANT SELECT, INSERT, UPDATE, DELETE
ON public.fc_squad_players
TO authenticated;


-- ============================================================
-- 7. VERIFICATION COMMENT
--
-- At this point:
--
-- fc_squads
--     existing table
--     untouched
--
-- fc_squad_players
--     new authoritative player assignments
--
-- Existing:
--     formation
--     slots
--     team_ovr
--     chemistry
--
-- remain fully intact.
-- ============================================================


-- ============================================================
-- END PHASE 2A REPAIR
-- ============================================================
