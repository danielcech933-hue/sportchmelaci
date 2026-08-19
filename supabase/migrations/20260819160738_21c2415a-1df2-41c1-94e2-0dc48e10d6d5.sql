DROP POLICY IF EXISTS "profiles readable by authenticated" ON public.profiles;

CREATE POLICY "users read own profile"
ON public.profiles FOR SELECT TO authenticated
USING (auth.uid() = id);

REVOKE ALL ON public.profile_public FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER ON public.profile_public FROM authenticated;
GRANT SELECT ON public.profile_public TO authenticated;
GRANT SELECT ON public.profile_public TO service_role;