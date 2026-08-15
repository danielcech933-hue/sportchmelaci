ALTER TABLE public.telegram_link_sessions
  ADD COLUMN IF NOT EXISTS telegram_chat_id bigint;

CREATE INDEX IF NOT EXISTS telegram_link_sessions_chat_idx
  ON public.telegram_link_sessions(telegram_chat_id);

CREATE OR REPLACE FUNCTION public.telegram_bind_chat(_token text, _telegram_chat_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ok boolean := false;
BEGIN
  UPDATE public.telegram_link_sessions
     SET telegram_chat_id = _telegram_chat_id
   WHERE token = _token
     AND consumed_at IS NULL
     AND expires_at > now()
  RETURNING true INTO v_ok;

  RETURN coalesce(v_ok, false);
END;
$$;

REVOKE ALL ON FUNCTION public.telegram_bind_chat(text, bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.telegram_bind_chat(text, bigint) FROM anon;
REVOKE ALL ON FUNCTION public.telegram_bind_chat(text, bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_bind_chat(text, bigint) TO service_role;

-- Find the pending session for a Telegram chat (server-only).
CREATE OR REPLACE FUNCTION public.telegram_pending_token(_telegram_chat_id bigint)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT token
    FROM public.telegram_link_sessions
   WHERE telegram_chat_id = _telegram_chat_id
     AND consumed_at IS NULL
     AND expires_at > now()
   ORDER BY created_at DESC
   LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.telegram_pending_token(bigint) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.telegram_pending_token(bigint) FROM anon;
REVOKE ALL ON FUNCTION public.telegram_pending_token(bigint) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.telegram_pending_token(bigint) TO service_role;