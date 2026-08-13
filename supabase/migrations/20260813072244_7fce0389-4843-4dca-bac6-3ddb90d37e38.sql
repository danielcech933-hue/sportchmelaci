-- Profile writes were blocked by missing table privileges (policies existed, grants did not)
GRANT INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

-- anon has no policies on these tables; drop the unused privileges
REVOKE ALL ON public.direct_messages FROM anon;
REVOKE ALL ON public.chat_messages FROM anon;
REVOKE ALL ON public.matches FROM anon;
REVOKE ALL ON public.profiles FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.direct_messages TO authenticated;
GRANT ALL ON public.direct_messages TO service_role;
GRANT ALL ON public.chat_messages TO service_role;
GRANT ALL ON public.matches TO service_role;