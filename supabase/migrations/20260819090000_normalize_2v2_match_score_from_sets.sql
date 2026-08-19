-- Keep 2v2 scoreboard/statistics aligned with the authoritative set results.
-- For team matches, score_a/score_b represent sets won, while `sets` keeps point-by-point set scores.

UPDATE public.matches AS m
SET
  score_a = COALESCE((
    SELECT count(*)
    FROM jsonb_array_elements(COALESCE(m.sets, '[]'::jsonb)) AS s
    WHERE (s->>'a')::int > (s->>'b')::int
  ), 0),
  score_b = COALESCE((
    SELECT count(*)
    FROM jsonb_array_elements(COALESCE(m.sets, '[]'::jsonb)) AS s
    WHERE (s->>'b')::int > (s->>'a')::int
  ), 0),
  updated_at = now()
WHERE m.match_format = '2v2'
  AND m.ended_at IS NOT NULL
  AND m.confirmed_at IS NOT NULL
  AND jsonb_typeof(COALESCE(m.sets, '[]'::jsonb)) = 'array'
  AND jsonb_array_length(COALESCE(m.sets, '[]'::jsonb)) > 0
  AND m.score_a = 0
  AND m.score_b = 0;

-- Future 2v2 score updates derive the match score from set winners.
CREATE OR REPLACE FUNCTION public.save_match_score(
  _match_id uuid,
  _score_a integer,
  _score_b integer,
  _sets jsonb DEFAULT '[]'::jsonb,
  _ended_at timestamp with time zone DEFAULT NULL
)
RETURNS public.matches
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_match public.matches;
  v_uid uuid := auth.uid();
  v_score_a integer := GREATEST(0, COALESCE(_score_a, 0));
  v_score_b integer := GREATEST(0, COALESCE(_score_b, 0));
  v_sets jsonb := COALESCE(_sets, '[]'::jsonb);
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'authentication required'; END IF;
  IF _score_a < 0 OR _score_b < 0 THEN RAISE EXCEPTION 'score cannot be negative'; END IF;

  SELECT * INTO v_match
  FROM public.matches
  WHERE id = _match_id
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'match not found'; END IF;
  IF v_match.owner_id <> v_uid THEN RAISE EXCEPTION 'only the match owner may update the score'; END IF;
  IF v_match.confirmed_at IS NOT NULL AND _ended_at IS NULL THEN
    RAISE EXCEPTION 'confirmed match cannot be reopened';
  END IF;

  IF v_match.match_format = '2v2'
     AND jsonb_typeof(v_sets) = 'array'
     AND jsonb_array_length(v_sets) > 0 THEN
    SELECT
      count(*) FILTER (WHERE (s->>'a')::int > (s->>'b')::int),
      count(*) FILTER (WHERE (s->>'b')::int > (s->>'a')::int)
    INTO v_score_a, v_score_b
    FROM jsonb_array_elements(v_sets) AS s;
  END IF;

  PERFORM set_config('app.bypass_match_guard', 'on', true);
  UPDATE public.matches
  SET score_a = v_score_a,
      score_b = v_score_b,
      sets = v_sets,
      ended_at = _ended_at
  WHERE id = _match_id
  RETURNING * INTO v_match;
  PERFORM set_config('app.bypass_match_guard', 'off', true);
  RETURN v_match;
EXCEPTION WHEN others THEN
  PERFORM set_config('app.bypass_match_guard', 'off', true);
  RAISE;
END;
$function$;
