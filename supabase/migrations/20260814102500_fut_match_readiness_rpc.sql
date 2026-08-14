-- FUT pre-match readiness guard.
-- Keep match entry dependent on an authoritative, server-validated squad.

CREATE OR REPLACE FUNCTION public.fc_squad_match_readiness(
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
    captain_count integer;
    bench_count integer;
    reserve_count integer;
    invalid_role_count integer;
    invalid_slot_count integer;
    duplicate_card_count integer;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT *
      INTO squad
      FROM public.fc_squads
     WHERE id = _squad_id
       AND user_id = uid
       AND is_active = true;

    IF squad.id IS NULL THEN
        RAISE EXCEPTION 'squad_not_found';
    END IF;

    SELECT count(*) FILTER (WHERE squad_role = 'STARTER'),
           count(*) FILTER (WHERE squad_role = 'BENCH'),
           count(*) FILTER (WHERE squad_role = 'RESERVE'),
           count(*) FILTER (WHERE is_captain = true)
      INTO starter_count, bench_count, reserve_count, captain_count
      FROM public.fc_squad_players
     WHERE squad_id = _squad_id;

    SELECT count(*)
      INTO invalid_role_count
      FROM public.fc_squad_players
     WHERE squad_id = _squad_id
       AND squad_role NOT IN ('STARTER', 'BENCH', 'RESERVE');

    SELECT count(*)
      INTO invalid_slot_count
      FROM public.fc_squad_players
     WHERE squad_id = _squad_id
       AND (
         (squad_role = 'STARTER' AND slot_key NOT IN ('GK','LB','CB1','CB2','RB','CM1','CM2','CAM','LW','ST','RW'))
         OR (squad_role = 'BENCH' AND slot_key !~ '^BENCH[1-7]$')
         OR (squad_role = 'RESERVE' AND slot_key !~ '^RESERVE[1-5]$')
       );

    SELECT count(*)
      INTO duplicate_card_count
      FROM (
        SELECT user_card_id
          FROM public.fc_squad_players
         WHERE squad_id = _squad_id
         GROUP BY user_card_id
        HAVING count(*) > 1
      ) d;

    RETURN jsonb_build_object(
      'ready', (
        squad.formation = '4-3-3'
        AND starter_count = 11
        AND bench_count <= 7
        AND reserve_count <= 5
        AND captain_count = 1
        AND invalid_role_count = 0
        AND invalid_slot_count = 0
        AND duplicate_card_count = 0
      ),
      'squad_id', squad.id,
      'formation', squad.formation,
      'starting_xi', starter_count,
      'bench', bench_count,
      'reserves', reserve_count,
      'captain_count', captain_count,
      'invalid_role_count', invalid_role_count,
      'invalid_slot_count', invalid_slot_count,
      'duplicate_card_count', duplicate_card_count,
      'version', squad.version
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fc_squad_match_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_squad_match_readiness(uuid) TO authenticated;
