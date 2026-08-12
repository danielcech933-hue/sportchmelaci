-- ============================================================
-- SPORTCHMELÁCI ULTIMATE TEAM
-- PHASE 2A — SQUAD FOUNDATION
--
-- Purpose:
--   Create the production database foundation for Ultimate Team
--   squads without touching the existing Phase 1 card system.
--
-- IMPORTANT:
--   - Existing cards are NOT modified.
--   - Existing owned cards are NOT modified.
--   - Card Spin is NOT modified.
--   - No derived Team OVR / Chemistry is stored yet.
--   - Squad calculations will be added in the next phase.
-- ============================================================


-- ============================================================
-- 1. SQUADS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fc_squads (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    user_id uuid NOT NULL
        REFERENCES auth.users(id)
        ON DELETE CASCADE,

    name text NOT NULL DEFAULT 'Main Squad',

    formation text NOT NULL DEFAULT '4-3-3',

    is_active boolean NOT NULL DEFAULT false,

    -- Used later for optimistic locking / multiplayer snapshots.
    version integer NOT NULL DEFAULT 1,

    created_at timestamptz NOT NULL DEFAULT now(),

    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fc_squads_name_length
        CHECK (char_length(trim(name)) BETWEEN 1 AND 40),

    CONSTRAINT fc_squads_formation_length
        CHECK (char_length(trim(formation)) BETWEEN 3 AND 32),

    CONSTRAINT fc_squads_version_positive
        CHECK (version > 0)
);


-- ============================================================
-- 2. SQUAD PLAYERS
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fc_squad_players (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    squad_id uuid NOT NULL
        REFERENCES public.fc_squads(id)
        ON DELETE CASCADE,

    -- IMPORTANT:
    -- This references the user's ACTUAL owned card instance,
    -- not the public card catalog.
    user_card_id uuid NOT NULL
        REFERENCES public.fc_user_cards(id)
        ON DELETE RESTRICT,

    -- Formation slot identifier.
    --
    -- Examples:
    -- GK
    -- LB
    -- LCB
    -- RCB
    -- RB
    -- LCM
    -- RCM
    -- CAM
    -- LW
    -- ST
    -- RW
    --
    -- The exact slot map will be controlled by the frontend
    -- and server validation layer later.
    slot_key text NOT NULL,

    -- Current tactical position.
    --
    -- This may differ from the card's primary position because
    -- alternative positions will be supported.
    position text NOT NULL,

    -- STARTER = starting XI
    -- BENCH   = substitutes
    -- RESERVE = reserves
    squad_role text NOT NULL DEFAULT 'STARTER',

    is_captain boolean NOT NULL DEFAULT false,

    created_at timestamptz NOT NULL DEFAULT now(),

    updated_at timestamptz NOT NULL DEFAULT now(),

    CONSTRAINT fc_squad_players_slot_length
        CHECK (char_length(trim(slot_key)) BETWEEN 1 AND 32),

    CONSTRAINT fc_squad_players_position_length
        CHECK (char_length(trim(position)) BETWEEN 1 AND 10),

    CONSTRAINT fc_squad_players_role
        CHECK (squad_role IN ('STARTER', 'BENCH', 'RESERVE'))
);


-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS fc_squads_user_idx
    ON public.fc_squads(user_id);

CREATE INDEX IF NOT EXISTS fc_squads_user_active_idx
    ON public.fc_squads(user_id, is_active);

CREATE INDEX IF NOT EXISTS fc_squad_players_squad_idx
    ON public.fc_squad_players(squad_id);

CREATE INDEX IF NOT EXISTS fc_squad_players_card_idx
    ON public.fc_squad_players(user_card_id);

CREATE INDEX IF NOT EXISTS fc_squad_players_squad_role_idx
    ON public.fc_squad_players(squad_id, squad_role);


-- ============================================================
-- 4. DATA INTEGRITY
-- ============================================================

-- A slot can only contain one card in a squad.
CREATE UNIQUE INDEX IF NOT EXISTS fc_squad_players_slot_unique
    ON public.fc_squad_players(squad_id, slot_key);


-- The same owned card instance cannot appear twice
-- in the SAME squad.
--
-- The same card MAY appear in different saved squads.
-- This is intentional and allows users to have:
--
-- Main Squad
-- OVR 82 Squad
-- Weekend Squad
--
-- without duplicating the actual card.
CREATE UNIQUE INDEX IF NOT EXISTS fc_squad_players_card_unique
    ON public.fc_squad_players(squad_id, user_card_id);


-- Only one captain per squad.
CREATE UNIQUE INDEX IF NOT EXISTS fc_squad_players_one_captain
    ON public.fc_squad_players(squad_id)
    WHERE is_captain = true;


-- Only one active squad per user.
CREATE UNIQUE INDEX IF NOT EXISTS fc_squads_one_active_per_user
    ON public.fc_squads(user_id)
    WHERE is_active = true;


-- ============================================================
-- 5. UPDATED_AT TRIGGERS
-- ============================================================

DROP TRIGGER IF EXISTS fc_squads_updated
    ON public.fc_squads;

CREATE TRIGGER fc_squads_updated
    BEFORE UPDATE ON public.fc_squads
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();


DROP TRIGGER IF EXISTS fc_squad_players_updated
    ON public.fc_squad_players;

CREATE TRIGGER fc_squad_players_updated
    BEFORE UPDATE ON public.fc_squad_players
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();


-- ============================================================
-- 6. SQUAD PLAYER OWNERSHIP VALIDATION
-- ============================================================
--
-- This is extremely important.
--
-- A malicious client must NOT be able to do:
--
-- INSERT INTO fc_squad_players
-- ...
-- user_card_id = SOME_OTHER_USER_CARD
--
-- Even though the squad belongs to the current user.
--
-- The trigger guarantees that:
--
-- fc_squads.user_id
--       =
-- fc_user_cards.user_id
--
-- for every squad player.
-- ============================================================

CREATE OR REPLACE FUNCTION public.fc_validate_squad_player()
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
    WHERE id = NEW.squad_id;

    IF squad_owner IS NULL THEN
        RAISE EXCEPTION 'squad_not_found';
    END IF;


    SELECT user_id
    INTO card_owner
    FROM public.fc_user_cards
    WHERE id = NEW.user_card_id;

    IF card_owner IS NULL THEN
        RAISE EXCEPTION 'owned_card_not_found';
    END IF;


    IF squad_owner IS DISTINCT FROM card_owner THEN
        RAISE EXCEPTION 'card_not_owned_by_squad_owner';
    END IF;


    RETURN NEW;
END;
$$;


DROP TRIGGER IF EXISTS fc_validate_squad_player_trigger
    ON public.fc_squad_players;

CREATE TRIGGER fc_validate_squad_player_trigger
    BEFORE INSERT OR UPDATE
    ON public.fc_squad_players
    FOR EACH ROW
    EXECUTE FUNCTION public.fc_validate_squad_player();


REVOKE ALL
    ON FUNCTION public.fc_validate_squad_player()
    FROM PUBLIC, anon, authenticated;


-- ============================================================
-- 7. SQUAD RLS
-- ============================================================

ALTER TABLE public.fc_squads
    ENABLE ROW LEVEL SECURITY;


ALTER TABLE public.fc_squad_players
    ENABLE ROW LEVEL SECURITY;


-- ============================================================
-- 8. SQUAD POLICIES
-- ============================================================

DROP POLICY IF EXISTS "fc_squads_select_own"
    ON public.fc_squads;

CREATE POLICY "fc_squads_select_own"
    ON public.fc_squads
    FOR SELECT
    TO authenticated
    USING (
        (select auth.uid()) = user_id
    );


DROP POLICY IF EXISTS "fc_squads_insert_own"
    ON public.fc_squads;

CREATE POLICY "fc_squads_insert_own"
    ON public.fc_squads
    FOR INSERT
    TO authenticated
    WITH CHECK (
        (select auth.uid()) = user_id
    );


DROP POLICY IF EXISTS "fc_squads_update_own"
    ON public.fc_squads;

CREATE POLICY "fc_squads_update_own"
    ON public.fc_squads
    FOR UPDATE
    TO authenticated
    USING (
        (select auth.uid()) = user_id
    )
    WITH CHECK (
        (select auth.uid()) = user_id
    );


DROP POLICY IF EXISTS "fc_squads_delete_own"
    ON public.fc_squads;

CREATE POLICY "fc_squads_delete_own"
    ON public.fc_squads
    FOR DELETE
    TO authenticated
    USING (
        (select auth.uid()) = user_id
    );


-- ============================================================
-- 9. SQUAD PLAYER POLICIES
-- ============================================================

DROP POLICY IF EXISTS "fc_squad_players_select_own"
    ON public.fc_squad_players;

CREATE POLICY "fc_squad_players_select_own"
    ON public.fc_squad_players
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.fc_squads s
            WHERE s.id = squad_id
              AND s.user_id = (select auth.uid())
        )
    );


DROP POLICY IF EXISTS "fc_squad_players_insert_own"
    ON public.fc_squad_players;

CREATE POLICY "fc_squad_players_insert_own"
    ON public.fc_squad_players
    FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.fc_squads s
            WHERE s.id = squad_id
              AND s.user_id = (select auth.uid())
        )
        AND EXISTS (
            SELECT 1
            FROM public.fc_user_cards uc
            WHERE uc.id = user_card_id
              AND uc.user_id = (select auth.uid())
        )
    );


DROP POLICY IF EXISTS "fc_squad_players_update_own"
    ON public.fc_squad_players;

CREATE POLICY "fc_squad_players_update_own"
    ON public.fc_squad_players
    FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.fc_squads s
            WHERE s.id = squad_id
              AND s.user_id = (select auth.uid())
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1
            FROM public.fc_squads s
            WHERE s.id = squad_id
              AND s.user_id = (select auth.uid())
        )
        AND EXISTS (
            SELECT 1
            FROM public.fc_user_cards uc
            WHERE uc.id = user_card_id
              AND uc.user_id = (select auth.uid())
        )
    );


DROP POLICY IF EXISTS "fc_squad_players_delete_own"
    ON public.fc_squad_players;

CREATE POLICY "fc_squad_players_delete_own"
    ON public.fc_squad_players
    FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.fc_squads s
            WHERE s.id = squad_id
              AND s.user_id = (select auth.uid())
        )
    );


-- ============================================================
-- 10. GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.fc_squads
    TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE
    ON public.fc_squad_players
    TO authenticated;

GRANT ALL
    ON public.fc_squads
    TO service_role;

GRANT ALL
    ON public.fc_squad_players
    TO service_role;


-- ============================================================
-- 11. REALTIME PREPARATION
-- ============================================================
--
-- We do NOT enable realtime yet.
--
-- Multiplayer will use a dedicated match state system.
-- Squads themselves do not need realtime updates.
--
-- This avoids unnecessary realtime traffic.
-- ============================================================


-- ============================================================
-- 12. COMMENTS
-- ============================================================

COMMENT ON TABLE public.fc_squads IS
    'SportChmelaci Ultimate Team user squads.';

COMMENT ON TABLE public.fc_squad_players IS
    'Cards assigned to positions within an Ultimate Team squad.';

COMMENT ON COLUMN public.fc_squad_players.user_card_id IS
    'References the concrete owned card instance in fc_user_cards, not the catalog card.';

COMMENT ON COLUMN public.fc_squad_players.slot_key IS
    'Formation-specific tactical slot identifier.';

COMMENT ON COLUMN public.fc_squad_players.position IS
    'Position currently assigned to the owned card in this squad.';

COMMENT ON COLUMN public.fc_squad_players.squad_role IS
    'STARTER, BENCH or RESERVE.';

COMMENT ON COLUMN public.fc_squads.version IS
    'Optimistic locking version used later by authoritative squad save operations.';


-- ============================================================
-- END PHASE 2A
-- ============================================================
