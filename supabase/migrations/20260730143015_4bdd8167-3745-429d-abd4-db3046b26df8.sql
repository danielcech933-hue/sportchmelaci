DROP POLICY IF EXISTS "owner updates matches" ON public.matches;

CREATE POLICY "owner updates matches"
ON public.matches
FOR UPDATE
TO authenticated
USING (auth.uid() = owner_id)
WITH CHECK (
  auth.uid() = owner_id
  AND owner_id = (SELECT m.owner_id FROM public.matches m WHERE m.id = matches.id)
  AND bets IS NOT DISTINCT FROM (SELECT m.bets FROM public.matches m WHERE m.id = matches.id)
  AND bets_locked_at IS NOT DISTINCT FROM (SELECT m.bets_locked_at FROM public.matches m WHERE m.id = matches.id)
  AND confirmed_at IS NOT DISTINCT FROM (SELECT m.confirmed_at FROM public.matches m WHERE m.id = matches.id)
  AND confirmed_by IS NOT DISTINCT FROM (SELECT m.confirmed_by FROM public.matches m WHERE m.id = matches.id)
  AND tournament_id IS NOT DISTINCT FROM (SELECT m.tournament_id FROM public.matches m WHERE m.id = matches.id)
);

-- chat: nickname is always taken from the sender's profile, client value ignored
CREATE OR REPLACE FUNCTION public.chat_force_nickname()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  real_nick text;
BEGIN
  IF NEW.user_id IS DISTINCT FROM auth.uid() AND auth.uid() IS NOT NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  SELECT nickname INTO real_nick FROM public.profiles WHERE id = NEW.user_id;
  IF real_nick IS NULL THEN
    RAISE EXCEPTION 'no_profile';
  END IF;
  NEW.nickname := real_nick;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS chat_force_nickname_trg ON public.chat_messages;
CREATE TRIGGER chat_force_nickname_trg
BEFORE INSERT OR UPDATE ON public.chat_messages
FOR EACH ROW EXECUTE FUNCTION public.chat_force_nickname();

REVOKE UPDATE, DELETE, INSERT ON public.chat_messages FROM anon;
REVOKE UPDATE, DELETE, INSERT ON public.matches FROM anon;