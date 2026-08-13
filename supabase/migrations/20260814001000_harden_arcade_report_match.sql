-- SECURITY: arcade_report_match was a self-reporting reward endpoint.
-- There is currently no server-verified arcade match flow that can authorize
-- the submitted opponent/result, so authenticated clients must not be able
-- to call this RPC directly. Keep the function for future server-side use,
-- but remove client execution until a verified match flow exists.

REVOKE ALL ON FUNCTION public.arcade_report_match(uuid, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.arcade_report_match(uuid, integer, integer) FROM anon;
REVOKE ALL ON FUNCTION public.arcade_report_match(uuid, integer, integer) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.arcade_report_match(uuid, integer, integer) TO service_role;

-- Defensive input checks remain part of the function itself when invoked by
-- trusted server code; this migration specifically closes the client reward
-- farming vector identified by the security scan.
