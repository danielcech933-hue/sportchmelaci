
CREATE OR REPLACE FUNCTION public.chat_force_nickname()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  real_nick text;
BEGIN
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
