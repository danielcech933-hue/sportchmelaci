ALTER TABLE public.tournament_teams ADD COLUMN IF NOT EXISTS players text[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.create_tournament(_name text, _sport text, _format text, _teams text[], _players jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  t_id uuid;
  n int;
  size int := 1;
  rounds int;
  i int;
  j int;
  r int;
  slot_no int;
  ids uuid[] := ARRAY[]::uuid[];
  names text[] := ARRAY[]::text[];
  plist text[];
  padded uuid[];
  padded_names text[];
  new_id uuid;
  a_ref uuid;
  b_ref uuid;
  a_name text;
  b_name text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF _format NOT IN ('round_robin','single_elimination') THEN RAISE EXCEPTION 'invalid_format'; END IF;

  SELECT array_agg(TRIM(x)) INTO names
    FROM unnest(_teams) x WHERE TRIM(COALESCE(x,'')) <> '';
  n := COALESCE(array_length(names,1), 0);
  IF n < 2 THEN RAISE EXCEPTION 'need_at_least_two_teams'; END IF;
  IF n > 32 THEN RAISE EXCEPTION 'too_many_teams'; END IF;

  INSERT INTO public.tournaments(name, sport, format, created_by)
    VALUES (COALESCE(NULLIF(TRIM(_name),''),'Turnaj'), _sport, _format, uid)
    RETURNING id INTO t_id;

  FOR i IN 1..n LOOP
    plist := ARRAY[]::text[];
    IF _players IS NOT NULL AND jsonb_typeof(_players) = 'array' AND jsonb_typeof(_players -> (i-1)) = 'array' THEN
      SELECT COALESCE(array_agg(TRIM(v)), ARRAY[]::text[]) INTO plist
        FROM jsonb_array_elements_text(_players -> (i-1)) v
        WHERE TRIM(COALESCE(v,'')) <> '';
    END IF;
    INSERT INTO public.tournament_teams(tournament_id, name, seed, players)
      VALUES (t_id, names[i], i, plist) RETURNING id INTO new_id;
    ids := ids || new_id;
  END LOOP;

  IF _format = 'round_robin' THEN
    FOR i IN 1..n-1 LOOP
      FOR j IN i+1..n LOOP
        INSERT INTO public.matches(owner_id, sport, team_a, team_b, tournament_id, round, slot, team_a_ref, team_b_ref)
          VALUES (uid, _sport, names[i], names[j], t_id, 1, (i*100+j), ids[i], ids[j]);
      END LOOP;
    END LOOP;
  ELSE
    WHILE size < n LOOP size := size * 2; END LOOP;
    rounds := 0;
    i := size;
    WHILE i > 1 LOOP rounds := rounds + 1; i := i / 2; END LOOP;

    padded := ids;
    padded_names := names;
    FOR i IN n+1..size LOOP
      padded := padded || NULL::uuid;
      padded_names := padded_names || NULL::text;
    END LOOP;

    slot_no := 0;
    i := 1;
    WHILE i <= size LOOP
      slot_no := slot_no + 1;
      a_ref := padded[i];
      b_ref := padded[i+1];
      a_name := COALESCE(padded_names[i], 'BYE');
      b_name := COALESCE(padded_names[i+1], 'BYE');
      INSERT INTO public.matches(owner_id, sport, team_a, team_b, tournament_id, round, slot, team_a_ref, team_b_ref, ended_at)
        VALUES (uid, _sport, a_name, b_name, t_id, 1, slot_no, a_ref, b_ref,
                CASE WHEN a_ref IS NULL OR b_ref IS NULL THEN now() ELSE NULL END);
      i := i + 2;
    END LOOP;

    FOR r IN 2..rounds LOOP
      FOR slot_no IN 1..(size / (2^r)::int) LOOP
        INSERT INTO public.matches(owner_id, sport, team_a, team_b, tournament_id, round, slot)
          VALUES (uid, _sport, 'TBD', 'TBD', t_id, r, slot_no);
      END LOOP;
    END LOOP;

    PERFORM public.advance_bracket_from(m.id) FROM public.matches m
      WHERE m.tournament_id = t_id AND m.round = 1 AND (m.team_a_ref IS NULL OR m.team_b_ref IS NULL);
  END IF;

  RETURN t_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_tournament(text, text, text, text[], jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_tournament(text, text, text, text[], jsonb) TO authenticated;