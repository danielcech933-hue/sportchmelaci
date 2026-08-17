-- Normalize legacy matches into explicit 1v1/2v2 player arrays and enforce team sizes.
UPDATE public.matches
SET
  team_a_players = to_jsonb(regexp_split_to_array(team_a, '\s*(?:&|/|,|\+)\s*')),
  team_b_players = to_jsonb(regexp_split_to_array(team_b, '\s*(?:&|/|,|\+)\s*')),
  match_format = CASE
    WHEN array_length(regexp_split_to_array(team_a, '\s*(?:&|/|,|\+)\s*'), 1) = 2
      AND array_length(regexp_split_to_array(team_b, '\s*(?:&|/|,|\+)\s*'), 1) = 2
      THEN '2v2'
    ELSE '1v1'
  END
WHERE jsonb_array_length(COALESCE(team_a_players, '[]'::jsonb)) = 0
   OR jsonb_array_length(COALESCE(team_b_players, '[]'::jsonb)) = 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'matches_team_size_check'
      AND conrelid = 'public.matches'::regclass
  ) THEN
    ALTER TABLE public.matches
      ADD CONSTRAINT matches_team_size_check
      CHECK (
        (match_format = '1v1'
          AND jsonb_array_length(COALESCE(team_a_players, '[]'::jsonb)) = 1
          AND jsonb_array_length(COALESCE(team_b_players, '[]'::jsonb)) = 1)
        OR
        (match_format = '2v2'
          AND jsonb_array_length(COALESCE(team_a_players, '[]'::jsonb)) = 2
          AND jsonb_array_length(COALESCE(team_b_players, '[]'::jsonb)) = 2)
      );
  END IF;
END $$;
