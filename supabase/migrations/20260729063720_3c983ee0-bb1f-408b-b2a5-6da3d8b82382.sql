
-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nickname TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Matches
CREATE TABLE public.matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport TEXT NOT NULL,
  team_a TEXT NOT NULL,
  team_b TEXT NOT NULL,
  score_a INTEGER NOT NULL DEFAULT 0,
  score_b INTEGER NOT NULL DEFAULT 0,
  sets JSONB NOT NULL DEFAULT '[]'::jsonb,
  bets JSONB NOT NULL DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.matches TO authenticated;
GRANT ALL ON public.matches TO service_role;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "matches readable by authenticated" ON public.matches FOR SELECT TO authenticated USING (true);
CREATE POLICY "owner inserts matches" ON public.matches FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner updates matches" ON public.matches FOR UPDATE TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner deletes matches" ON public.matches FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE INDEX matches_owner_id_idx ON public.matches (owner_id);
CREATE INDEX matches_started_at_idx ON public.matches (started_at DESC);

-- Updated-at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_matches_updated_at BEFORE UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup from user metadata nickname
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  desired TEXT;
  candidate TEXT;
  suffix INT := 0;
BEGIN
  desired := COALESCE(NULLIF(TRIM(NEW.raw_user_meta_data->>'nickname'), ''), split_part(NEW.email, '@', 1), 'player');
  desired := substr(desired, 1, 30);
  candidate := desired;
  WHILE EXISTS (SELECT 1 FROM public.profiles WHERE nickname = candidate) LOOP
    suffix := suffix + 1;
    candidate := substr(desired, 1, 26) || '_' || suffix::text;
  END LOOP;
  INSERT INTO public.profiles (id, nickname) VALUES (NEW.id, candidate);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
