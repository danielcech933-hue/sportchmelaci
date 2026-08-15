-- Telegram-based free phone verification (replaces paid SMS/Twilio flow)

CREATE TABLE IF NOT EXISTS public.telegram_verifications (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  telegram_user_id bigint UNIQUE NOT NULL,
  telegram_chat_id bigint,
  telegram_username text,
  phone_hash text NOT NULL,
  phone_last4 text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  notifications_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, UPDATE ON public.telegram_verifications TO authenticated;
GRANT ALL ON public.telegram_verifications TO service_role;
ALTER TABLE public.telegram_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own telegram verification select" ON public.telegram_verifications;
CREATE POLICY "own telegram verification select" ON public.telegram_verifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own telegram verification update" ON public.telegram_verifications;
CREATE POLICY "own telegram verification update" ON public.telegram_verifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.telegram_link_sessions (
  token text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  consumed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS telegram_link_sessions_user_idx ON public.telegram_link_sessions(user_id);

-- No direct client access: sessions are only created/consumed through functions.
GRANT ALL ON public.telegram_link_sessions TO service_role;
ALTER TABLE public.telegram_link_sessions ENABLE ROW LEVEL SECURITY;

-- Start a short-lived link session for the signed-in user and return the token.
CREATE OR REPLACE FUNCTION public.telegram_start_link()
RETURNS TABLE (token text, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_token text;
  v_exp timestamptz := now() + interval '15 minutes';
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  DELETE FROM public.telegram_link_sessions
   WHERE user_id = v_uid OR expires_at < now() - interval '1 day';

  v_token := replace(encode(gen_random_bytes(16), 'hex'), '-', '');

  INSERT INTO public.telegram_link_sessions (token, user_id, expires_at)
  VALUES (v_token, v_uid, v_exp);

  RETURN QUERY SELECT v_token, v_exp;
END;
$$;

REVOKE ALL ON FUNCTION public.telegram_start_link() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.telegram_start_link() FROM anon;
GRANT EXECUTE ON FUNCTION public.telegram_start_link() TO authenticated;

-- Consume a link session and store the verified phone hash (service role only; called by webhook).
CREATE OR REPLACE FUNCTION public.telegram_complete_link(
  _token text,
  _telegram_user_id bigint,
  _telegram_chat_id bigint,
  _telegram_username text,
  _phone_hash text,
  _phone_last4 text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid;
BEGIN
  UPDATE public.telegram_link_sessions
     SET consumed_at = now()
   WHERE token = _token
     AND consumed_at IS NULL
     AND expires_at > now()
  RETURNING user_id INTO v_uid;

  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.telegram_verifications AS tv
    (user_id, telegram_user_id, telegram_chat_id, telegram_username, phone_hash, phone_last4, verified_at)
  VALUES (v_uid, _telegram_user_id, _telegram_chat_id, _telegram_username, _phone_hash, _phone_last4, now())
  ON CONFLICT (user_id) DO UPDATE
    SET telegram_user_id = EXCLUDED.telegram_user_id,
        telegram_chat_id = EXCLUDED.telegram_chat_id,
        telegram_username = EXCLUDED.telegram_username,
        phone_hash = EXCLUDED.phone_hash,
        phone_last4 = EXCLUDED.phone_last4,
        verified_at = now();

  RETURN v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.telegram_complete_link(text, bigint, bigint, text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.telegram_complete_link(text, bigint, bigint, text, text, text) FROM anon;
REVOKE ALL ON FUNCTION public.telegram_complete_link(text, bigint, bigint, text, text, text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_complete_link(text, bigint, bigint, text, text, text) TO service_role;