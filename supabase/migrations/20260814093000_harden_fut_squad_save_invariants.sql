-- FUT squad save hardening: enforce the same invariants the validator reports.
-- The existing fc_squad_save RPC already validates ownership and positions;
-- this migration also rejects malformed rosters before they are persisted.

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
    captain_count integer := 0;
    card_exists boolean;
    duplicate_card boolean;
    duplicate_slot boolean;
    new_squad jsonb;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT *
      INTO squad
      FROM public.fc_squads
     WHERE id = _squad_id
       AND user_id = uid
     FOR UPDATE;

    IF squad.id IS NULL THEN
        RAISE EXCEPTION 'squad_not_found';
    END IF;

    IF _expected_version IS NULL THEN
        RAISE EXCEPTION 'version_required';
    END IF;

    IF squad.version <> _expected_version THEN
        RAISE EXCEPTION 'squad_version_conflict';
    END IF;

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

    player_count := jsonb_array_length(_players);

    IF player_count > 23 THEN
        RAISE EXCEPTION 'squad_too_large';
    END IF;

    FOR player IN SELECT value FROM jsonb_array_elements(_players)
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

        SELECT EXISTS (
            SELECT 1
              FROM public.fc_user_cards uc
             WHERE uc.id = (player->>'user_card_id')::uuid
               AND uc.user_id = uid
        ) INTO card_exists;

        IF NOT card_exists THEN
            RAISE EXCEPTION 'card_not_owned';
        END IF;

        IF NOT EXISTS (
            SELECT 1
              FROM public.fc_user_cards uc
              JOIN public.fc_cards c ON c.id = uc.card_id
             WHERE uc.id = (player->>'user_card_id')::uuid
               AND uc.user_id = uid
               AND (
                   upper(player->>'position') = upper(c.position)
                   OR upper(player->>'position') = ANY (
                       SELECT upper(x)
                         FROM unnest(coalesce(c.alt_positions, '{}'::text[])) x
                   )
               )
        ) THEN
            RAISE EXCEPTION 'invalid_player_position';
        END IF;

        IF COALESCE(player->>'is_captain', 'false')::boolean THEN
            captain_count := captain_count + 1;
        END IF;

        IF COALESCE(player->>'squad_role', 'STARTER') = 'STARTER' THEN
            starter_count := starter_count + 1;
        ELSIF COALESCE(player->>'squad_role', 'STARTER') = 'BENCH' THEN
            bench_count := bench_count + 1;
        ELSE
            reserve_count := reserve_count + 1;
        END IF;
    END LOOP;

    IF starter_count <> 11 THEN
        RAISE EXCEPTION 'invalid_starting_xi';
    END IF;

    IF bench_count > 7 THEN
        RAISE EXCEPTION 'too_many_bench_players';
    END IF;

    IF reserve_count > 5 THEN
        RAISE EXCEPTION 'too_many_reserves';
    END IF;

    IF captain_count <> 1 THEN
        RAISE EXCEPTION 'invalid_captain';
    END IF;

    SELECT EXISTS (
        SELECT 1
          FROM (
              SELECT (value->>'user_card_id')::uuid AS user_card_id
                FROM jsonb_array_elements(_players)
               GROUP BY 1
              HAVING count(*) > 1
          ) duplicates
    ) INTO duplicate_card;

    IF duplicate_card THEN
        RAISE EXCEPTION 'duplicate_card';
    END IF;

    SELECT EXISTS (
        SELECT 1
          FROM (
              SELECT trim(value->>'slot_key') AS slot_key
                FROM jsonb_array_elements(_players)
               WHERE upper(coalesce(value->>'squad_role', 'STARTER')) = 'STARTER'
               GROUP BY 1
              HAVING count(*) > 1
          ) duplicate_slots
    ) INTO duplicate_slot;

    IF duplicate_slot THEN
        RAISE EXCEPTION 'duplicate_starting_slot';
    END IF;

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

    new_version := squad.version + 1;

    UPDATE public.fc_squads
       SET name = trim(_name),
           formation = trim(_formation),
           version = new_version,
           updated_at = now()
     WHERE id = _squad_id;

    SELECT public.fc_squad_get(_squad_id)
      INTO new_squad;

    RETURN new_squad;
END;
$$;

REVOKE ALL ON FUNCTION public.fc_squad_save(uuid, integer, text, text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fc_squad_save(uuid, integer, text, text, jsonb) TO authenticated;
