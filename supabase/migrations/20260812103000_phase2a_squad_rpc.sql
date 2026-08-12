-- ============================================================
-- SPORTCHMELÁCI ULTIMATE TEAM
-- PHASE 2A.2 — SQUAD RPC / SERVER AUTHORITY
-- ============================================================

-- ============================================================
-- 1. CREATE SQUAD
-- ============================================================

CREATE OR REPLACE FUNCTION public.fc_squad_create(
    _name text DEFAULT 'Main Squad',
    _formation text DEFAULT '4-3-3'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
    new_squad public.fc_squads;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    IF length(trim(coalesce(_name, ''))) < 1
       OR length(trim(_name)) > 40 THEN
        RAISE EXCEPTION 'invalid_squad_name';
    END IF;

    IF length(trim(coalesce(_formation, ''))) < 3
       OR length(trim(_formation)) > 32 THEN
        RAISE EXCEPTION 'invalid_formation';
    END IF;

    INSERT INTO public.fc_squads (
        user_id,
        name,
        formation,
        is_active
    )
    VALUES (
        uid,
        trim(_name),
        trim(_formation),
        NOT EXISTS (
            SELECT 1
            FROM public.fc_squads
            WHERE user_id = uid
              AND is_active = true
        )
    )
    RETURNING *
    INTO new_squad;

    RETURN jsonb_build_object(
        'id', new_squad.id,
        'user_id', new_squad.user_id,
        'name', new_squad.name,
        'formation', new_squad.formation,
        'is_active', new_squad.is_active,
        'version', new_squad.version,
        'created_at', new_squad.created_at,
        'updated_at', new_squad.updated_at,
        'players', '[]'::jsonb
    );
END;
$$;


-- ============================================================
-- 2. GET SQUAD
-- ============================================================

CREATE OR REPLACE FUNCTION public.fc_squad_get(
    _squad_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
    squad public.fc_squads;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT *
    INTO squad
    FROM public.fc_squads
    WHERE id = _squad_id
      AND user_id = uid;

    IF squad.id IS NULL THEN
        RAISE EXCEPTION 'squad_not_found';
    END IF;

    RETURN jsonb_build_object(
        'id', squad.id,
        'user_id', squad.user_id,
        'name', squad.name,
        'formation', squad.formation,
        'is_active', squad.is_active,
        'version', squad.version,
        'created_at', squad.created_at,
        'updated_at', squad.updated_at,
        'players',
        COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'id', sp.id,
                        'user_card_id', sp.user_card_id,
                        'slot_key', sp.slot_key,
                        'position', sp.position,
                        'squad_role', sp.squad_role,
                        'is_captain', sp.is_captain,
                        'card', jsonb_build_object(
                            'id', c.id,
                            'player_id', c.player_id,
                            'name', p.name,
                            'rating', c.rating,
                            'position', c.position,
                            'rarity', c.rarity,
                            'campaign', c.campaign,
                            'alt_positions', c.alt_positions,
                            'playstyles', c.playstyles,
                            'playstyles_plus', c.playstyles_plus,
                            'roles', c.roles,
                            'attrs', c.attrs
                        )
                    )
                    ORDER BY
                        CASE sp.squad_role
                            WHEN 'STARTER' THEN 1
                            WHEN 'BENCH' THEN 2
                            WHEN 'RESERVE' THEN 3
                            ELSE 4
                        END,
                        sp.slot_key
                )
                FROM public.fc_squad_players sp
                JOIN public.fc_user_cards uc
                    ON uc.id = sp.user_card_id
                JOIN public.fc_cards c
                    ON c.id = uc.card_id
                LEFT JOIN public.fc_players p
                    ON p.id = c.player_id
                WHERE sp.squad_id = squad.id
            ),
            '[]'::jsonb
        )
    );
END;
$$;


-- ============================================================
-- 3. VALIDATE SQUAD
-- ============================================================

CREATE OR REPLACE FUNCTION public.fc_squad_validate(
    _squad_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();

    squad public.fc_squads;

    starter_count integer;
    bench_count integer;
    reserve_count integer;
    total_count integer;
    captain_count integer;

    invalid_positions integer;
    duplicate_cards integer;

    errors jsonb := '[]'::jsonb;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT *
    INTO squad
    FROM public.fc_squads
    WHERE id = _squad_id
      AND user_id = uid;

    IF squad.id IS NULL THEN
        RAISE EXCEPTION 'squad_not_found';
    END IF;


    SELECT count(*)
    INTO starter_count
    FROM public.fc_squad_players
    WHERE squad_id = _squad_id
      AND squad_role = 'STARTER';


    SELECT count(*)
    INTO bench_count
    FROM public.fc_squad_players
    WHERE squad_id = _squad_id
      AND squad_role = 'BENCH';


    SELECT count(*)
    INTO reserve_count
    FROM public.fc_squad_players
    WHERE squad_id = _squad_id
      AND squad_role = 'RESERVE';


    total_count := starter_count + bench_count + reserve_count;


    SELECT count(*)
    INTO captain_count
    FROM public.fc_squad_players
    WHERE squad_id = _squad_id
      AND is_captain = true;


    -- Starting XI must contain exactly 11 players.
    IF starter_count <> 11 THEN
        errors := errors || jsonb_build_array(
            jsonb_build_object(
                'code', 'INVALID_STARTING_XI',
                'message', 'Starting XI must contain exactly 11 players.',
                'current', starter_count,
                'required', 11
            )
        );
    END IF;


    -- Maximum 7 substitutes.
    IF bench_count > 7 THEN
        errors := errors || jsonb_build_array(
            jsonb_build_object(
                'code', 'TOO_MANY_BENCH',
                'message', 'Squad can contain a maximum of 7 bench players.',
                'current', bench_count,
                'maximum', 7
            )
        );
    END IF;


    -- Maximum 5 reserves.
    IF reserve_count > 5 THEN
        errors := errors || jsonb_build_array(
            jsonb_build_object(
                'code', 'TOO_MANY_RESERVES',
                'message', 'Squad can contain a maximum of 5 reserves.',
                'current', reserve_count,
                'maximum', 5
            )
        );
    END IF;


    -- Exactly one captain in a valid squad.
    IF captain_count <> 1 THEN
        errors := errors || jsonb_build_array(
            jsonb_build_object(
                'code', 'INVALID_CAPTAIN',
                'message', 'A valid squad must have exactly one captain.',
                'current', captain_count
            )
        );
    END IF;


    -- Validate every assigned position against
    -- the card primary position + alternative positions.
    SELECT count(*)
    INTO invalid_positions
    FROM public.fc_squad_players sp
    JOIN public.fc_user_cards uc
        ON uc.id = sp.user_card_id
    JOIN public.fc_cards c
        ON c.id = uc.card_id
    WHERE sp.squad_id = _squad_id
      AND NOT (
          upper(sp.position) = upper(c.position)
          OR upper(sp.position) = ANY(
              SELECT upper(x)
              FROM unnest(coalesce(c.alt_positions, '{}'::text[])) x
          )
      );


    IF invalid_positions > 0 THEN
        errors := errors || jsonb_build_array(
            jsonb_build_object(
                'code', 'INVALID_POSITION',
                'message', 'One or more cards are assigned to positions they cannot play.',
                'count', invalid_positions
            )
        );
    END IF;


    -- Defensive duplicate protection.
    SELECT count(*)
    INTO duplicate_cards
    FROM (
        SELECT user_card_id
        FROM public.fc_squad_players
        WHERE squad_id = _squad_id
        GROUP BY user_card_id
        HAVING count(*) > 1
    ) duplicates;


    IF duplicate_cards > 0 THEN
        errors := errors || jsonb_build_array(
            jsonb_build_object(
                'code', 'DUPLICATE_CARD',
                'message', 'The same owned card cannot appear twice in one squad.',
                'count', duplicate_cards
            )
        );
    END IF;


    RETURN jsonb_build_object(
        'valid', jsonb_array_length(errors) = 0,
        'squad_id', _squad_id,
        'formation', squad.formation,
        'starting_xi', starter_count,
        'bench', bench_count,
        'reserves', reserve_count,
        'total_players', total_count,
        'captains', captain_count,
        'errors', errors
    );
END;
$$;


-- ============================================================
-- 4. SAVE SQUAD
-- ============================================================

CREATE OR REPLACE FUNCTION public.fc_squad_save(
    _squad_id uuid,
    _expected_version integer,
    _name text,
    _formation text,
    _players jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
    squad public.fc_squads;

    player jsonb;

    new_version integer;

    starter_count integer := 0;
    bench_count integer := 0;
    reserve_count integer := 0;

    player_count integer := 0;

    card_owner uuid;
    card_exists boolean;

    existing_card_id uuid;

    new_squad jsonb;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;


    -- --------------------------------------------------------
    -- Validate squad ownership and lock the row.
    -- --------------------------------------------------------

    SELECT *
    INTO squad
    FROM public.fc_squads
    WHERE id = _squad_id
      AND user_id = uid
    FOR UPDATE;

    IF squad.id IS NULL THEN
        RAISE EXCEPTION 'squad_not_found';
    END IF;


    -- --------------------------------------------------------
    -- Optimistic locking.
    -- --------------------------------------------------------

    IF _expected_version IS NULL THEN
        RAISE EXCEPTION 'version_required';
    END IF;

    IF squad.version <> _expected_version THEN
        RAISE EXCEPTION 'squad_version_conflict';
    END IF;


    -- --------------------------------------------------------
    -- Basic input validation.
    -- --------------------------------------------------------

    IF length(trim(coalesce(_name, ''))) < 1
       OR length(trim(_name)) > 40 THEN
        RAISE EXCEPTION 'invalid_squad_name';
    END IF;

    IF length(trim(coalesce(_formation, ''))) < 3
       OR length(trim(_formation)) > 32 THEN
        RAISE EXCEPTION 'invalid_formation';
    END IF;

    IF jsonb_typeof(_players) <> 'array' THEN
        RAISE EXCEPTION 'players_must_be_array';
    END IF;


    -- --------------------------------------------------------
    -- Maximum roster size.
    -- 11 starters + 7 bench + 5 reserves = 23.
    -- --------------------------------------------------------

    player_count := jsonb_array_length(_players);

    IF player_count > 23 THEN
        RAISE EXCEPTION 'squad_too_large';
    END IF;


    -- --------------------------------------------------------
    -- Validate every submitted player BEFORE changing DB.
    -- --------------------------------------------------------

    FOR player IN
        SELECT value
        FROM jsonb_array_elements(_players)
    LOOP

        IF player->>'user_card_id' IS NULL THEN
            RAISE EXCEPTION 'player_user_card_id_required';
        END IF;

        IF player->>'slot_key' IS NULL THEN
            RAISE EXCEPTION 'player_slot_required';
        END IF;

        IF player->>'position' IS NULL THEN
            RAISE EXCEPTION 'player_position_required';
        END IF;

        IF COALESCE(player->>'squad_role', 'STARTER')
            NOT IN ('STARTER', 'BENCH', 'RESERVE') THEN
            RAISE EXCEPTION 'invalid_squad_role';
        END IF;


        -- Verify card exists and belongs to current user.
        SELECT EXISTS (
            SELECT 1
            FROM public.fc_user_cards uc
            WHERE uc.id = (player->>'user_card_id')::uuid
              AND uc.user_id = uid
        )
        INTO card_exists;

        IF NOT card_exists THEN
            RAISE EXCEPTION 'card_not_owned';
        END IF;


        -- Validate position against card.
        IF NOT EXISTS (
            SELECT 1
            FROM public.fc_user_cards uc
            JOIN public.fc_cards c
                ON c.id = uc.card_id
            WHERE uc.id = (player->>'user_card_id')::uuid
              AND uc.user_id = uid
              AND (
                  upper(player->>'position') = upper(c.position)
                  OR upper(player->>'position') = ANY(
                      SELECT upper(x)
                      FROM unnest(
                          coalesce(c.alt_positions, '{}'::text[])
                      ) x
                  )
              )
        ) THEN
            RAISE EXCEPTION 'invalid_player_position';
        END IF;


        -- Count roles.
        IF COALESCE(player->>'squad_role', 'STARTER') = 'STARTER' THEN
            starter_count := starter_count + 1;
        ELSIF COALESCE(player->>'squad_role', 'STARTER') = 'BENCH' THEN
            bench_count := bench_count + 1;
        ELSE
            reserve_count := reserve_count + 1;
        END IF;

    END LOOP;


    IF starter_count > 11 THEN
        RAISE EXCEPTION 'too_many_starters';
    END IF;

    IF bench_count > 7 THEN
        RAISE EXCEPTION 'too_many_bench_players';
    END IF;

    IF reserve_count > 5 THEN
        RAISE EXCEPTION 'too_many_reserves';
    END IF;


    -- --------------------------------------------------------
    -- Replace squad players atomically.
    -- --------------------------------------------------------

    DELETE FROM public.fc_squad_players
    WHERE squad_id = _squad_id;


    INSERT INTO public.fc_squad_players (
        squad_id,
        user_card_id,
        slot_key,
        position,
        squad_role,
        is_captain
    )
    SELECT
        _squad_id,
        (value->>'user_card_id')::uuid,
        trim(value->>'slot_key'),
        upper(trim(value->>'position')),
        COALESCE(value->>'squad_role', 'STARTER'),
        COALESCE((value->>'is_captain')::boolean, false)
    FROM jsonb_array_elements(_players);


    -- --------------------------------------------------------
    -- Update squad metadata and version.
    -- --------------------------------------------------------

    new_version := squad.version + 1;

    UPDATE public.fc_squads
    SET
        name = trim(_name),
        formation = trim(_formation),
        version = new_version,
        updated_at = now()
    WHERE id = _squad_id;


    -- --------------------------------------------------------
    -- Return the new authoritative squad.
    -- --------------------------------------------------------

    SELECT public.fc_squad_get(_squad_id)
    INTO new_squad;

    RETURN new_squad;
END;
$$;


-- ============================================================
-- 5. DELETE SQUAD
-- ============================================================

CREATE OR REPLACE FUNCTION public.fc_squad_delete(
    _squad_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
    was_active boolean;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;


    SELECT is_active
    INTO was_active
    FROM public.fc_squads
    WHERE id = _squad_id
      AND user_id = uid
    FOR UPDATE;


    IF NOT FOUND THEN
        RAISE EXCEPTION 'squad_not_found';
    END IF;


    DELETE FROM public.fc_squads
    WHERE id = _squad_id
      AND user_id = uid;


    -- If the deleted squad was active,
    -- promote the newest remaining squad.
    IF was_active THEN

        UPDATE public.fc_squads
        SET is_active = true
        WHERE id = (
            SELECT id
            FROM public.fc_squads
            WHERE user_id = uid
            ORDER BY updated_at DESC
            LIMIT 1
        );

    END IF;


    RETURN true;
END;
$$;


-- ============================================================
-- 6. SET ACTIVE SQUAD
-- ============================================================

CREATE OR REPLACE FUNCTION public.fc_squad_set_active(
    _squad_id uuid
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
        FROM public.fc_squads
        WHERE id = _squad_id
          AND user_id = uid
    ) THEN
        RAISE EXCEPTION 'squad_not_found';
    END IF;


    UPDATE public.fc_squads
    SET is_active = false
    WHERE user_id = uid
      AND is_active = true;


    UPDATE public.fc_squads
    SET
        is_active = true,
        updated_at = now()
    WHERE id = _squad_id
      AND user_id = uid;


    RETURN public.fc_squad_get(_squad_id);
END;
$$;


-- ============================================================
-- 7. LIST USER SQUADS
-- ============================================================

CREATE OR REPLACE FUNCTION public.fc_squads_list()
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


    RETURN COALESCE(
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'id', s.id,
                    'name', s.name,
                    'formation', s.formation,
                    'is_active', s.is_active,
                    'version', s.version,
                    'player_count', (
                        SELECT count(*)
                        FROM public.fc_squad_players sp
                        WHERE sp.squad_id = s.id
                    ),
                    'updated_at', s.updated_at
                )
                ORDER BY
                    s.is_active DESC,
                    s.updated_at DESC
            )
            FROM public.fc_squads s
            WHERE s.user_id = uid
        ),
        '[]'::jsonb
    );
END;
$$;


-- ============================================================
-- 8. SECURITY
-- ============================================================

REVOKE ALL
ON FUNCTION public.fc_squad_create(text, text)
FROM PUBLIC, anon;

REVOKE ALL
ON FUNCTION public.fc_squad_get(uuid)
FROM PUBLIC, anon;

REVOKE ALL
ON FUNCTION public.fc_squad_validate(uuid)
FROM PUBLIC, anon;

REVOKE ALL
ON FUNCTION public.fc_squad_save(uuid, integer, text, text, jsonb)
FROM PUBLIC, anon;

REVOKE ALL
ON FUNCTION public.fc_squad_delete(uuid)
FROM PUBLIC, anon;

REVOKE ALL
ON FUNCTION public.fc_squad_set_active(uuid)
FROM PUBLIC, anon;

REVOKE ALL
ON FUNCTION public.fc_squads_list()
FROM PUBLIC, anon;


GRANT EXECUTE
ON FUNCTION public.fc_squad_create(text, text)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.fc_squad_get(uuid)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.fc_squad_validate(uuid)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.fc_squad_save(uuid, integer, text, text, jsonb)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.fc_squad_delete(uuid)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.fc_squad_set_active(uuid)
TO authenticated;

GRANT EXECUTE
ON FUNCTION public.fc_squads_list()
TO authenticated;


-- ============================================================
-- END PHASE 2A.2
-- ============================================================
