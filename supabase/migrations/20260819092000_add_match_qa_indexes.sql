-- QA/performance indexes for match feeds, Team HQ lookups and scheduled/live queries.
CREATE INDEX IF NOT EXISTS matches_team_a_ref_idx ON public.matches (team_a_ref);
CREATE INDEX IF NOT EXISTS matches_team_b_ref_idx ON public.matches (team_b_ref);
CREATE INDEX IF NOT EXISTS matches_live_status_idx ON public.matches (match_format, confirmed_at, ended_at, started_at DESC);
CREATE INDEX IF NOT EXISTS matches_scheduled_at_idx ON public.matches (scheduled_at DESC) WHERE scheduled_at IS NOT NULL;
