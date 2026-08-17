-- Roll Battles for virtual stock collectibles.
-- Play-money / virtual collectibles only. No real securities or real-world ownership.

CREATE TABLE IF NOT EXISTS public.case_roll_battles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  creator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  opponent_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','rolling','finished','cancelled')),
  creator_value numeric(30,2) NOT NULL DEFAULT 0,
  opponent_value numeric(30,2) NOT NULL DEFAULT 0,
  winner_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  joined_at timestamptz,
  finished_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.case_roll_battle_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  battle_id uuid NOT NULL REFERENCES public.case_roll_battles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  inventory_id uuid NOT NULL REFERENCES public.case_opening_stock_inventory(id) ON DELETE RESTRICT,
  battle_value numeric(30,2) NOT NULL,
  item_index integer NOT NULL CHECK (item_index BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (battle_id, inventory_id),
  UNIQUE (battle_id, user_id, item_index)
);

CREATE INDEX IF NOT EXISTS case_roll_battles_status_created_idx
  ON public.case_roll_battles(status, created_at DESC);
CREATE INDEX IF NOT EXISTS case_roll_battle_items_inventory_idx
  ON public.case_roll_battle_items(inventory_id);

ALTER TABLE public.case_roll_battles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.case_roll_battle_items ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.case_roll_battles FROM anon, authenticated;
REVOKE ALL ON public.case_roll_battle_items FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.case_roll_item_value(
  _case_id text,
  _company_id bigint,
  _share_count bigint,
  _rarity_score integer
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT round(
    c.cost
    * (
      0.45
      + 0.55 * least(
          1.0,
          ln(greatest(2, _share_count + 1)::numeric) / ln(1000001::numeric)
        )
      )
    * (1 + least(1.10, greatest(0, _rarity_score)::numeric / 100))
    * (1 + greatest(0, co.company_tier - 1)::numeric * 0.08),
    2
  )
  FROM public.case_opening_stock_cases c
  JOIN public.case_opening_stock_companies co ON co.id = _company_id
  WHERE c.id = _case_id;
$$;
REVOKE ALL ON FUNCTION public.case_roll_item_value(text,bigint,bigint,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_roll_item_value(text,bigint,bigint,integer) TO authenticated;

CREATE OR REPLACE FUNCTION public.case_opening_stock_inventory_summary()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT coalesce(
    jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC),
    '[]'::jsonb
  )
  FROM (
    SELECT
      i.id,
      i.case_id,
      i.company_name,
      i.ticker,
      i.sector,
      i.share_count,
      i.rarity,
      i.rarity_score,
      i.serial,
      i.created_at,
      public.case_roll_item_value(i.case_id, i.company_id, i.share_count, i.rarity_score) AS battle_value
    FROM public.case_opening_stock_inventory i
    WHERE i.user_id = auth.uid()
    ORDER BY i.created_at DESC
    LIMIT 100
  ) x;
$$;
REVOKE ALL ON FUNCTION public.case_opening_stock_inventory_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_opening_stock_inventory_summary() TO authenticated;

CREATE OR REPLACE FUNCTION public.case_roll_battle_payload(_battle_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT jsonb_build_object(
    'id', b.id,
    'code', b.code,
    'status', b.status,
    'creator_id', b.creator_id,
    'creator_nickname', cp.nickname,
    'opponent_id', b.opponent_id,
    'opponent_nickname', op.nickname,
    'creator_value', b.creator_value,
    'opponent_value', b.opponent_value,
    'winner_id', b.winner_id,
    'created_at', b.created_at,
    'joined_at', b.joined_at,
    'finished_at', b.finished_at,
    'creator_items', coalesce((
      SELECT jsonb_agg(to_jsonb(z) ORDER BY z.item_index)
      FROM (
        SELECT
          bi.item_index,
          i.id,
          i.company_name,
          i.ticker,
          i.sector,
          i.share_count,
          i.rarity,
          i.rarity_score,
          i.serial,
          bi.battle_value
        FROM public.case_roll_battle_items bi
        JOIN public.case_opening_stock_inventory i ON i.id = bi.inventory_id
        WHERE bi.battle_id = b.id AND bi.user_id = b.creator_id
      ) z
    ), '[]'::jsonb),
    'opponent_items', coalesce((
      SELECT jsonb_agg(to_jsonb(z) ORDER BY z.item_index)
      FROM (
        SELECT
          bi.item_index,
          i.id,
          i.company_name,
          i.ticker,
          i.sector,
          i.share_count,
          i.rarity,
          i.rarity_score,
          i.serial,
          bi.battle_value
        FROM public.case_roll_battle_items bi
        JOIN public.case_opening_stock_inventory i ON i.id = bi.inventory_id
        WHERE bi.battle_id = b.id AND bi.user_id = b.opponent_id
      ) z
    ), '[]'::jsonb)
  )
  FROM public.case_roll_battles b
  LEFT JOIN public.profiles cp ON cp.id = b.creator_id
  LEFT JOIN public.profiles op ON op.id = b.opponent_id
  WHERE b.id = _battle_id;
$$;
REVOKE ALL ON FUNCTION public.case_roll_battle_payload(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_roll_battle_payload(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.case_roll_list_open()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.created_at DESC), '[]'::jsonb)
  FROM (
    SELECT
      b.id,
      b.code,
      b.creator_id,
      p.nickname AS creator_nickname,
      b.creator_value,
      count(bi.id)::integer AS item_count,
      b.created_at
    FROM public.case_roll_battles b
    JOIN public.profiles p ON p.id = b.creator_id
    LEFT JOIN public.case_roll_battle_items bi ON bi.battle_id = b.id
    WHERE b.status = 'open'
      AND b.creator_id <> auth.uid()
    GROUP BY b.id, p.nickname
    ORDER BY b.created_at DESC
    LIMIT 30
  ) x;
$$;
REVOKE ALL ON FUNCTION public.case_roll_list_open() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_roll_list_open() TO authenticated;

CREATE OR REPLACE FUNCTION public.case_roll_history()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT coalesce(jsonb_agg(to_jsonb(x) ORDER BY x.finished_at DESC), '[]'::jsonb)
  FROM (
    SELECT
      b.id,
      b.code,
      b.status,
      b.creator_id,
      cp.nickname AS creator_nickname,
      b.opponent_id,
      op.nickname AS opponent_nickname,
      b.creator_value,
      b.opponent_value,
      b.winner_id,
      CASE WHEN b.winner_id = auth.uid() THEN true ELSE false END AS user_won,
      b.finished_at
    FROM public.case_roll_battles b
    LEFT JOIN public.profiles cp ON cp.id = b.creator_id
    LEFT JOIN public.profiles op ON op.id = b.opponent_id
    WHERE b.status IN ('finished','cancelled')
      AND (b.creator_id = auth.uid() OR b.opponent_id = auth.uid())
    ORDER BY b.finished_at DESC NULLS LAST
    LIMIT 25
  ) x;
$$;
REVOKE ALL ON FUNCTION public.case_roll_history() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_roll_history() TO authenticated;

CREATE OR REPLACE FUNCTION public.case_roll_create(_inventory_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_count integer;
  v_index integer := 0;
  v_value numeric := 0;
  v_battle_id uuid;
  v_code text;
  r record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _inventory_ids IS NULL OR coalesce(array_length(_inventory_ids, 1), 0) NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'invalid_item_count';
  END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.case_opening_stock_inventory i
  WHERE i.user_id = uid AND i.id = ANY(_inventory_ids);
  IF v_count <> array_length(_inventory_ids, 1) THEN
    RAISE EXCEPTION 'invalid_inventory_item';
  END IF;

  FOR r IN
    SELECT i.*
    FROM public.case_opening_stock_inventory i
    WHERE i.user_id = uid AND i.id = ANY(_inventory_ids)
    ORDER BY i.id
    FOR UPDATE
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.case_roll_battle_items bi
      JOIN public.case_roll_battles b ON b.id = bi.battle_id
      WHERE bi.inventory_id = r.id AND b.status IN ('open','rolling')
    ) THEN
      RAISE EXCEPTION 'item_locked';
    END IF;
    v_index := v_index + 1;
    v_value := v_value + public.case_roll_item_value(r.case_id, r.company_id, r.share_count, r.rarity_score);
  END LOOP;

  v_battle_id := gen_random_uuid();
  v_code := 'ROLL-' || upper(substr(replace(v_battle_id::text, '-', ''), 1, 8));

  INSERT INTO public.case_roll_battles(id, code, creator_id, creator_value)
  VALUES(v_battle_id, v_code, uid, round(v_value,2));

  v_index := 0;
  FOR r IN
    SELECT i.*
    FROM public.case_opening_stock_inventory i
    WHERE i.user_id = uid AND i.id = ANY(_inventory_ids)
    ORDER BY i.id
  LOOP
    v_index := v_index + 1;
    INSERT INTO public.case_roll_battle_items(battle_id,user_id,inventory_id,battle_value,item_index)
    VALUES(v_battle_id,uid,r.id,public.case_roll_item_value(r.case_id,r.company_id,r.share_count,r.rarity_score),v_index);
  END LOOP;

  RETURN public.case_roll_battle_payload(v_battle_id);
END;
$$;
REVOKE ALL ON FUNCTION public.case_roll_create(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_roll_create(uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.case_roll_join(_battle_id uuid, _inventory_ids uuid[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  b public.case_roll_battles%ROWTYPE;
  v_count integer;
  v_index integer := 0;
  v_value numeric := 0;
  v_min numeric;
  v_max numeric;
  v_winner uuid;
  r record;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _inventory_ids IS NULL OR coalesce(array_length(_inventory_ids, 1), 0) NOT BETWEEN 1 AND 5 THEN
    RAISE EXCEPTION 'invalid_item_count';
  END IF;

  SELECT * INTO b
  FROM public.case_roll_battles
  WHERE id = _battle_id
  FOR UPDATE;
  IF b.id IS NULL THEN RAISE EXCEPTION 'battle_not_found'; END IF;
  IF b.status <> 'open' THEN RAISE EXCEPTION 'battle_not_open'; END IF;
  IF b.creator_id = uid THEN RAISE EXCEPTION 'self_join'; END IF;

  SELECT count(*)::integer INTO v_count
  FROM public.case_opening_stock_inventory i
  WHERE i.user_id = uid AND i.id = ANY(_inventory_ids);
  IF v_count <> array_length(_inventory_ids, 1) THEN
    RAISE EXCEPTION 'invalid_inventory_item';
  END IF;

  FOR r IN
    SELECT i.*
    FROM public.case_opening_stock_inventory i
    WHERE i.user_id = uid AND i.id = ANY(_inventory_ids)
    ORDER BY i.id
    FOR UPDATE
  LOOP
    IF EXISTS (
      SELECT 1
      FROM public.case_roll_battle_items bi
      JOIN public.case_roll_battles bb ON bb.id = bi.battle_id
      WHERE bi.inventory_id = r.id AND bb.status IN ('open','rolling')
    ) THEN
      RAISE EXCEPTION 'item_locked';
    END IF;
    v_value := v_value + public.case_roll_item_value(r.case_id, r.company_id, r.share_count, r.rarity_score);
  END LOOP;

  v_value := round(v_value,2);
  v_min := round(b.creator_value * 0.85,2);
  v_max := round(b.creator_value * 1.15,2);
  IF v_value < v_min OR v_value > v_max THEN
    RAISE EXCEPTION 'roll_value_mismatch';
  END IF;

  UPDATE public.case_roll_battles
  SET opponent_id = uid,
      opponent_value = v_value,
      status = 'rolling',
      joined_at = now()
  WHERE id = b.id;

  FOR r IN
    SELECT i.*
    FROM public.case_opening_stock_inventory i
    WHERE i.user_id = uid AND i.id = ANY(_inventory_ids)
    ORDER BY i.id
  LOOP
    v_index := v_index + 1;
    INSERT INTO public.case_roll_battle_items(battle_id,user_id,inventory_id,battle_value,item_index)
    VALUES(b.id,uid,r.id,public.case_roll_item_value(r.case_id,r.company_id,r.share_count,r.rarity_score),v_index);
  END LOOP;

  IF random() < 0.5 THEN
    v_winner := b.creator_id;
  ELSE
    v_winner := uid;
  END IF;

  UPDATE public.case_roll_battles
  SET winner_id = v_winner,
      status = 'finished',
      finished_at = now()
  WHERE id = b.id;

  UPDATE public.case_opening_stock_inventory i
  SET user_id = v_winner
  WHERE i.id IN (
    SELECT bi.inventory_id
    FROM public.case_roll_battle_items bi
    WHERE bi.battle_id = b.id
  );

  RETURN public.case_roll_battle_payload(b.id);
END;
$$;
REVOKE ALL ON FUNCTION public.case_roll_join(uuid,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_roll_join(uuid,uuid[]) TO authenticated;

CREATE OR REPLACE FUNCTION public.case_roll_cancel(_battle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  v_rows integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  UPDATE public.case_roll_battles
  SET status='cancelled', finished_at=now()
  WHERE id=_battle_id AND creator_id=uid AND status='open';
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RAISE EXCEPTION 'cannot_cancel_battle'; END IF;
  RETURN public.case_roll_battle_payload(_battle_id);
END;
$$;
REVOKE ALL ON FUNCTION public.case_roll_cancel(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_roll_cancel(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.case_roll_get(_battle_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  uid uuid := auth.uid();
  b public.case_roll_battles%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO b FROM public.case_roll_battles WHERE id=_battle_id;
  IF b.id IS NULL THEN RAISE EXCEPTION 'battle_not_found'; END IF;
  IF b.creator_id <> uid AND b.opponent_id IS DISTINCT FROM uid THEN
    RAISE EXCEPTION 'battle_forbidden';
  END IF;
  RETURN public.case_roll_battle_payload(_battle_id);
END;
$$;
REVOKE ALL ON FUNCTION public.case_roll_get(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.case_roll_get(uuid) TO authenticated;
