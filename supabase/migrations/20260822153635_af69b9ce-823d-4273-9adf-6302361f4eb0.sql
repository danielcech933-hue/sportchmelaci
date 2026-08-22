DO $mig$
DECLARE
  d text;
  case_roles text := '(public.has_role(uid,''case_opener''::public.app_role) OR public.has_role(uid,''admin''::public.app_role)) AND NOT public.has_role(uid,''restricted''::public.app_role)';
  slot_roles text := 'public.has_role(uid,''high_roller''::public.app_role) OR public.has_role(uid,''admin''::public.app_role)';
  pat text := 'lower\(trim\(coalesce\((?:nick|v_nickname|nickname),''''\)\)\)\s*(NOT\s+)?IN\s*\([^)]*''m1das''[^)]*\)';
  r record;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('case_opening_open','case_opening_stock_open','slot_spin','slot_epic_spin','slot_variant_spin')
  LOOP
    d := pg_get_functiondef(r.oid);
    d := regexp_replace(
      d,
      pat,
      '\1(' || CASE WHEN r.proname LIKE 'case_opening%' THEN case_roles ELSE slot_roles END || ')',
      'gi'
    );
    IF d ~* pat THEN
      RAISE EXCEPTION 'nickname guard still present in %', r.proname;
    END IF;
    EXECUTE d;
  END LOOP;
END
$mig$;