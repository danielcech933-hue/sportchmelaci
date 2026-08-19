-- Backfill only unambiguous historical 2v2 team references.
-- A side is linked only when the team's member set is exactly the same two players
-- represented by team_a_players/team_b_players. Ambiguous/unmatched sides remain NULL.

WITH side_rows AS (
  SELECT m.id AS match_id, 'a'::text AS side, m.team_a_players AS players
  FROM public.matches m
  WHERE m.match_format = '2v2' AND m.team_a_ref IS NULL
  UNION ALL
  SELECT m.id, 'b'::text, m.team_b_players
  FROM public.matches m
  WHERE m.match_format = '2v2' AND m.team_b_ref IS NULL
),
normalized AS (
  SELECT s.match_id, s.side,
         lower(trim(x)) AS nickname
  FROM side_rows s
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(s.players, '[]'::jsonb)) x
),
candidates AS (
  SELECT n.match_id, n.side, t.id AS team_id,
         COUNT(DISTINCT n.nickname) AS requested_players,
         COUNT(DISTINCT tm.user_id) AS team_members,
         COUNT(DISTINCT p.id) AS matched_players
  FROM normalized n
  JOIN public.profiles p ON lower(p.nickname) = n.nickname
  JOIN public.team_members tm ON tm.user_id = p.id
  JOIN public.teams t ON t.id = tm.team_id
  GROUP BY n.match_id, n.side, t.id
),
valid AS (
  SELECT c.*
  FROM candidates c
  WHERE c.requested_players = 2
    AND c.team_members = 2
    AND c.matched_players = 2
),
unique_valid AS (
  SELECT v.*
  FROM valid v
  WHERE NOT EXISTS (
    SELECT 1
    FROM valid v2
    WHERE v2.match_id = v.match_id
      AND v2.side = v.side
      AND v2.team_id <> v.team_id
  )
)
UPDATE public.matches m
SET team_a_ref = u.team_id
FROM unique_valid u
WHERE u.match_id = m.id
  AND u.side = 'a'
  AND m.team_a_ref IS NULL;

WITH side_rows AS (
  SELECT m.id AS match_id, 'a'::text AS side, m.team_a_players AS players
  FROM public.matches m
  WHERE m.match_format = '2v2' AND m.team_a_ref IS NULL
  UNION ALL
  SELECT m.id, 'b'::text, m.team_b_players
  FROM public.matches m
  WHERE m.match_format = '2v2' AND m.team_b_ref IS NULL
),
normalized AS (
  SELECT s.match_id, s.side,
         lower(trim(x)) AS nickname
  FROM side_rows s
  CROSS JOIN LATERAL jsonb_array_elements_text(COALESCE(s.players, '[]'::jsonb)) x
),
candidates AS (
  SELECT n.match_id, n.side, t.id AS team_id,
         COUNT(DISTINCT n.nickname) AS requested_players,
         COUNT(DISTINCT tm.user_id) AS team_members,
         COUNT(DISTINCT p.id) AS matched_players
  FROM normalized n
  JOIN public.profiles p ON lower(p.nickname) = n.nickname
  JOIN public.team_members tm ON tm.user_id = p.id
  JOIN public.teams t ON t.id = tm.team_id
  GROUP BY n.match_id, n.side, t.id
),
valid AS (
  SELECT c.*
  FROM candidates c
  WHERE c.requested_players = 2
    AND c.team_members = 2
    AND c.matched_players = 2
),
unique_valid AS (
  SELECT v.*
  FROM valid v
  WHERE NOT EXISTS (
    SELECT 1
    FROM valid v2
    WHERE v2.match_id = v.match_id
      AND v2.side = v.side
      AND v2.team_id <> v.team_id
  )
)
UPDATE public.matches m
SET team_b_ref = u.team_id
FROM unique_valid u
WHERE u.match_id = m.id
  AND u.side = 'b'
  AND m.team_b_ref IS NULL;
