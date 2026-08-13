-- Poker security hardening:
-- 1) Never expose the full shuffled deck / opponents' hole cards through the table.
-- 2) Keep tournament metadata readable through a SECURITY DEFINER RPC that masks
--    private cards per caller.
-- 3) Prevent client-side chip synchronization from changing arbitrary seats.
-- 4) Cash-out uses the authoritative hand result when a hand is finished.

REVOKE SELECT ON public.poker_tournaments FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.poker_list_tournaments()
RETURNS SETOF jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  t record;
  raw_hand jsonb;
  deck jsonb;
  community_count integer;
  public_hand jsonb;
  public_players jsonb;
  public_community jsonb;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  FOR t IN
    SELECT id, name, buy_in, starting_chips, max_players, status, hand, created_by
    FROM public.poker_tournaments
    ORDER BY created_at DESC
    LIMIT 30
  LOOP
    raw_hand := t.hand;

    IF raw_hand IS NULL OR jsonb_typeof(raw_hand) <> 'object' THEN
      public_hand := NULL;
    ELSE
      deck := COALESCE(raw_hand->'deck', '[]'::jsonb);
      community_count := GREATEST(0, LEAST(COALESCE((raw_hand->>'community')::integer, 0), 5));

      SELECT COALESCE(jsonb_agg(value ORDER BY ordinality), '[]'::jsonb)
        INTO public_community
      FROM jsonb_array_elements(deck) WITH ORDINALITY
      WHERE ordinality > 18
        AND ordinality <= 18 + community_count;

      SELECT COALESCE(jsonb_agg(
        CASE
          WHEN value->>'userId' = uid::text THEN
            value || jsonb_build_object(
              'holeCards',
              COALESCE((
                SELECT jsonb_agg(card ORDER BY card_ord)
                FROM jsonb_array_elements(deck) WITH ORDINALITY AS cards(card, card_ord)
                WHERE card_ord BETWEEN ((ordinality - 1) * 2 + 1) AND ((ordinality - 1) * 2 + 2)
              ), '[]'::jsonb)
            )
          ELSE value
        END
        ORDER BY ordinality
      ), '[]'::jsonb)
        INTO public_players
      FROM jsonb_array_elements(COALESCE(raw_hand->'players', '[]'::jsonb)) WITH ORDINALITY;

      public_hand := (raw_hand - 'deck') || jsonb_build_object(
        'communityCards', public_community,
        'players', public_players
      );
    END IF;

    RETURN NEXT jsonb_build_object(
      'id', t.id,
      'name', t.name,
      'buy_in', t.buy_in,
      'starting_chips', t.starting_chips,
      'max_players', t.max_players,
      'status', t.status,
      'hand', public_hand,
      'created_by', t.created_by
    );
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.poker_list_tournaments() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.poker_list_tournaments() TO authenticated;

-- The old client-side chip sync was a direct integrity bypass: a seated user
-- could submit arbitrary stacks for every seat. Disable it until chip movement
-- is calculated entirely by a server-authoritative poker engine.
REVOKE ALL ON FUNCTION public.poker_sync_chips(uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.poker_cash_out(_tournament_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  uid uuid := auth.uid();
  t record;
  s record;
  hand_player jsonb;
  chips numeric;
  cash numeric;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO t
  FROM public.poker_tournaments
  WHERE id = _tournament_id;
  IF t.id IS NULL THEN RAISE EXCEPTION 'tournament_not_found'; END IF;

  SELECT * INTO s
  FROM public.poker_seats
  WHERE tournament_id = _tournament_id AND user_id = uid
  FOR UPDATE;
  IF s.id IS NULL THEN RAISE EXCEPTION 'not_seated'; END IF;

  IF COALESCE(t.hand->>'stage', '') NOT IN ('', 'done') AND t.status = 'running' THEN
    RAISE EXCEPTION 'hand_in_progress';
  END IF;

  hand_player := (
    SELECT value
    FROM jsonb_array_elements(COALESCE(t.hand->'players', '[]'::jsonb))
    WHERE value->>'userId' = uid::text
    LIMIT 1
  );

  chips := CASE
    WHEN hand_player IS NOT NULL AND COALESCE(t.hand->>'stage', '') = 'done'
      THEN GREATEST(0, COALESCE((hand_player->>'chips')::numeric, 0))
    ELSE GREATEST(0, COALESCE(s.chips, 0))
  END;

  cash := CASE
    WHEN t.starting_chips > 0 THEN ROUND((chips / t.starting_chips) * t.buy_in, 2)
    ELSE 0
  END;

  DELETE FROM public.poker_seats WHERE id = s.id;
  IF cash > 0 THEN
    UPDATE public.profiles SET balance = balance + cash WHERE id = uid;
  END IF;

  RETURN jsonb_build_object('ok', true, 'cashed', cash);
END;
$$;

REVOKE ALL ON FUNCTION public.poker_cash_out(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.poker_cash_out(uuid) TO authenticated;

-- Fix the Supabase "Function Search Path Mutable" warning for any existing
-- public function that does not already pin its search_path. Keep extensions
-- available because several Supabase helpers live there.
DO $$
DECLARE
  f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND NOT EXISTS (
        SELECT 1
        FROM unnest(COALESCE(p.proconfig, ARRAY[]::text[])) cfg
        WHERE cfg LIKE 'search_path=%'
      )
  LOOP
    EXECUTE format(
      'ALTER FUNCTION %s SET search_path = public, extensions, pg_temp',
      f.signature
    );
  END LOOP;
END;
$$;
