CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE,
  kind text NOT NULL,
  title text NOT NULL,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS notifications_unique_tournament_kind
  ON public.notifications(user_id, tournament_id, kind)
  WHERE tournament_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON public.notifications(user_id, created_at DESC);

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own notifications" ON public.notifications;
CREATE POLICY "users read own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "users update own notifications" ON public.notifications;
CREATE POLICY "users update own notifications" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "users delete own notifications" ON public.notifications;
CREATE POLICY "users delete own notifications" ON public.notifications
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.generate_tournament_notifications()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  t record;
  lead record;
  inserted int := 0;
  n int;
BEGIN
  FOR t IN
    SELECT id, name, sport, scheduled_at
    FROM public.tournaments
    WHERE status = 'active'
      AND scheduled_at IS NOT NULL
      AND scheduled_at > now()
      AND scheduled_at <= now() + interval '25 hours'
  LOOP
    FOR lead IN
      SELECT * FROM (VALUES
        ('tournament_1d', interval '24 hours', 'zítra'),
        ('tournament_1h', interval '1 hour', 'za hodinu')
      ) AS v(kind, span, label)
    LOOP
      CONTINUE WHEN t.scheduled_at > now() + lead.span;

      WITH recipients AS (
        SELECT ur.user_id FROM public.user_roles ur WHERE ur.role = 'admin'
        UNION
        SELECT p.id
        FROM public.tournament_teams tt
        CROSS JOIN LATERAL unnest(tt.players) AS pl(name)
        JOIN public.profiles p ON lower(p.nickname) = lower(trim(pl.name))
        WHERE tt.tournament_id = t.id
      )
      INSERT INTO public.notifications(user_id, tournament_id, kind, title, body)
      SELECT r.user_id, t.id, lead.kind,
             'Turnaj ' || t.name || ' začíná ' || lead.label,
             'Start: ' || to_char(t.scheduled_at AT TIME ZONE 'Europe/Prague', 'DD.MM.YYYY HH24:MI') || ' • ' || t.sport
      FROM recipients r
      ON CONFLICT (user_id, tournament_id, kind) DO NOTHING;

      GET DIAGNOSTICS n = ROW_COUNT;
      inserted := inserted + n;
    END LOOP;
  END LOOP;

  RETURN inserted;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_tournament_notifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_tournament_notifications() TO authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pg_cron;