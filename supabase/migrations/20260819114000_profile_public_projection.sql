-- Security projection for public profile data.
-- Do not expose wallet balances through public profile reads.

CREATE OR REPLACE VIEW public.profile_public AS
SELECT id, nickname, avatar_path, elo, arcade_points, created_at, updated_at
FROM public.profiles;

GRANT SELECT ON public.profile_public TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_wallet()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('balance', balance, 'slot_czk', slot_czk)
  FROM public.profiles
  WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_wallet() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_wallet() TO authenticated;
