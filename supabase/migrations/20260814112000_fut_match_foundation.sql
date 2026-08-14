-- ============================================================
-- SPORTCHMELÁCI ULTIMATE TEAM
-- FUT MATCH FOUNDATION
-- Server-authoritative match lifecycle based on active squad snapshot.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.fc_matches (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    squad_id uuid NOT NULL REFERENCES public.fc_squads(id) ON DELETE RESTRICT,
    squad_version integer NOT NULL,
    status text NOT NULL DEFAULT 'READY' CHECK (status IN ('READY','IN_PROGRESS','COMPLETED','ABANDONED')),
    opponent_name text NOT NULL,
    opponent_ovr integer NOT NULL CHECK (opponent_ovr BETWEEN 1 AND 99),
    user_score integer NOT NULL DEFAULT 0 CHECK (user_score >= 0),
    opponent_score integer NOT NULL DEFAULT 0 CHECK (opponent_score >= 0),
    reward_coins integer NOT NULL DEFAULT 0 CHECK (reward_coins >= 0),
    reward_xp integer NOT NULL DEFAULT 0 CHECK (reward_xp >= 0),
    started_at timestamptz,
    completed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS fc_matches_user_created_idx
  ON public.fc_matches (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS fc_matches_active_user_idx
  ON public.fc_matches (user_id, status)
  WHERE status IN ('READY','IN_PROGRESS');

ALTER TABLE public.fc_matches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS fc_matches_select_own ON public.fc_matches;
CREATE POLICY fc_matches_select_own
  ON public.fc_matches FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS fc_matches_insert_none ON public.fc_matches;
CREATE POLICY fc_matches_insert_none
  ON public.fc_matches FOR INSERT
  TO authenticated
  WITH CHECK (false);

DROP POLICY IF EXISTS fc_matches_update_none ON public.fc_matches;
CREATE POLICY fc_matches_update_none
  ON public.fc_matches FOR UPDATE
  TO authenticated
  USING (false)
  WITH CHECK (false);

DROP POLICY IF EXISTS fc_matches_delete_none ON public.fc_matches;
CREATE POLICY fc_matches_delete_none
  ON public.fc_matches FOR DELETE
  TO authenticated
  USING (false);

-- One active FUT match per user. A second browser/tab cannot create a parallel match.
CREATE UNIQUE INDEX IF NOT EXISTS fc_matches_one_active_per_user
  ON public.fc_matches (user_id)
  WHERE status IN ('READY','IN_PROGRESS');

CREATE OR REPLACE FUNCTION public.fc_match_create(
    _opponent_name text DEFAULT 'Chmelová AI',
    _opponent_ovr integer DEFAULT 75
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
    squad jsonb;
    squad_id uuid;
    squad_version integer;
    readiness jsonb;
    new_match public.fc_matches;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    IF length(trim(coalesce(_opponent_name, ''))) < 1 OR length(trim(_opponent_name)) > 40 THEN
        RAISE EXCEPTION 'invalid_opponent_name';
    END IF;

    IF _opponent_ovr < 1 OR _opponent_ovr > 99 THEN
        RAISE EXCEPTION 'invalid_opponent_ovr';
    END IF;

    SELECT id, version
      INTO squad_id, squad_version
      FROM public.fc_squads
     WHERE user_id = uid
       AND is_active = true
     ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
     LIMIT 1;

    IF squad_id IS NULL THEN
        RAISE EXCEPTION 'squad_not_found';
    END IF;

    readiness := public.fc_squad_match_readiness(squad_id);
    IF coalesce((readiness->>'ready')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'squad_not_ready';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public.fc_matches
         WHERE user_id = uid
           AND status IN ('READY','IN_PROGRESS')
    ) THEN
        RAISE EXCEPTION 'active_match_exists';
    END IF;

    INSERT INTO public.fc_matches (
        user_id, squad_id, squad_version, opponent_name, opponent_ovr, status
    ) VALUES (
        uid, squad_id, squad_version, trim(_opponent_name), _opponent_ovr, 'READY'
    )
    RETURNING * INTO new_match;

    RETURN jsonb_build_object(
        'id', new_match.id,
        'status', new_match.status,
        'squad_id', new_match.squad_id,
        'squad_version', new_match.squad_version,
        'opponent_name', new_match.opponent_name,
        'opponent_ovr', new_match.opponent_ovr,
        'user_score', new_match.user_score,
        'opponent_score', new_match.opponent_score,
        'reward_coins', new_match.reward_coins,
        'reward_xp', new_match.reward_xp,
        'created_at', new_match.created_at
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.fc_match_get(
    _match_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
    m public.fc_matches;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT * INTO m
      FROM public.fc_matches
     WHERE id = _match_id
       AND user_id = uid;

    IF m.id IS NULL THEN
        RAISE EXCEPTION 'match_not_found';
    END IF;

    RETURN to_jsonb(m);
END;
$$;

CREATE OR REPLACE FUNCTION public.fc_match_start(
    _match_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
    m public.fc_matches;
    readiness jsonb;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT * INTO m
      FROM public.fc_matches
     WHERE id = _match_id
       AND user_id = uid
     FOR UPDATE;

    IF m.id IS NULL THEN
        RAISE EXCEPTION 'match_not_found';
    END IF;

    IF m.status <> 'READY' THEN
        RAISE EXCEPTION 'match_not_ready';
    END IF;

    readiness := public.fc_squad_match_readiness(m.squad_id);
    IF coalesce((readiness->>'ready')::boolean, false) IS NOT TRUE THEN
        RAISE EXCEPTION 'squad_changed_since_match_creation';
    END IF;

    UPDATE public.fc_matches
       SET status = 'IN_PROGRESS',
           started_at = now(),
           updated_at = now()
     WHERE id = m.id;

    RETURN public.fc_match_get(m.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.fc_match_set_score(
    _match_id uuid,
    _user_score integer,
    _opponent_score integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
    m public.fc_matches;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;
    IF _user_score < 0 OR _opponent_score < 0 THEN
        RAISE EXCEPTION 'invalid_score';
    END IF;

    SELECT * INTO m
      FROM public.fc_matches
     WHERE id = _match_id
       AND user_id = uid
     FOR UPDATE;

    IF m.id IS NULL THEN
        RAISE EXCEPTION 'match_not_found';
    END IF;
    IF m.status <> 'IN_PROGRESS' THEN
        RAISE EXCEPTION 'match_not_in_progress';
    END IF;

    UPDATE public.fc_matches
       SET user_score = _user_score,
           opponent_score = _opponent_score,
           updated_at = now()
     WHERE id = m.id;

    RETURN public.fc_match_get(m.id);
END;
$$;

CREATE OR REPLACE FUNCTION public.fc_match_complete(
    _match_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    uid uuid := auth.uid();
    m public.fc_matches;
    coins_reward integer;
    xp_reward integer;
BEGIN
    IF uid IS NULL THEN
        RAISE EXCEPTION 'not_authenticated';
    END IF;

    SELECT * INTO m
      FROM public.fc_matches
     WHERE id = _match_id
       AND user_id = uid
     FOR UPDATE;

    IF m.id IS NULL THEN
        RAISE EXCEPTION 'match_not_found';
    END IF;
    IF m.status <> 'IN_PROGRESS' THEN
        RAISE EXCEPTION 'match_not_in_progress';
    END IF;

    coins_reward := CASE
      WHEN m.user_score > m.opponent_score THEN 250
      WHEN m.user_score = m.opponent_score THEN 150
      ELSE 100
    END;
    xp_reward := CASE
      WHEN m.user_score > m.opponent_score THEN 100
      WHEN m.user_score = m.opponent_score THEN 70
      ELSE 40
    END;

    UPDATE public.fc_matches
       SET status = 'COMPLETED',
           reward_coins = coins_reward,
           reward_xp = xp_reward,
           completed_at = now(),
           updated_at = now()
     WHERE id = m.id;

    RETURN public.fc_match_get(m.id) || jsonb_build_object(
      'result', CASE
        WHEN m.user_score > m.opponent_score THEN 'WIN'
        WHEN m.user_score = m.opponent_score THEN 'DRAW'
        ELSE 'LOSS'
      END
    );
END;
$$;

REVOKE ALL ON FUNCTION public.fc_match_create(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_match_create(text, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.fc_match_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_match_get(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.fc_match_start(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_match_start(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.fc_match_set_score(uuid, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_match_set_score(uuid, integer, integer) TO authenticated;
REVOKE ALL ON FUNCTION public.fc_match_complete(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fc_match_complete(uuid) TO authenticated;
