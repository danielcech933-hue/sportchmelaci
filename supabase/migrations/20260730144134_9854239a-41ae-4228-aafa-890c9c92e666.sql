ALTER TABLE public.tournaments ADD COLUMN IF NOT EXISTS scheduled_at timestamptz;

CREATE OR REPLACE FUNCTION public.create_tournament(_name text, _sport text, _format text, _teams text[], _players jsonb, _scheduled_at timestamptz)
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
  seq int := 0;
  sched timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;
  IF _format NOT IN ('round_robin','single_elimination') THEN RAISE EXCEPTION 'invalid_format'; END IF;

  SELECT array_agg(TRIM(x)) INTO names
    FROM unnest(_teams) x WHERE TRIM(COALESCE(x,'')) <> '';
  n := COALESCE(array_length(names,1), 0);
  IF n < 2 THEN RAISE EXCEPTION 'need_at_least_two_teams'; END IF;
  IF n > 32 THEN RAISE EXCEPTION 'too_many_teams'; END IF;

  INSERT INTO public.tournaments(name, sport, format, created_by, scheduled_at)
    VALUES (COALESCE(NULLIF(TRIM(_name),''),'Turnaj'), _sport, _format, uid, _scheduled_at)
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
        sched := CASE WHEN _scheduled_at IS NULL THEN NULL ELSE _scheduled_at + (seq * interval '30 minutes') END;
        seq := seq + 1;
        INSERT INTO public.matches(owner_id, sport, team_a, team_b, tournament_id, round, slot, team_a_ref, team_b_ref, scheduled_at)
          VALUES (uid, _sport, names[i], names[j], t_id, 1, (i*100+j), ids[i], ids[j], sched);
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
      sched := CASE WHEN _scheduled_at IS NULL THEN NULL ELSE _scheduled_at + ((slot_no - 1) * interval '30 minutes') END;
      INSERT INTO public.matches(owner_id, sport, team_a, team_b, tournament_id, round, slot, team_a_ref, team_b_ref, ended_at, scheduled_at)
        VALUES (uid, _sport, a_name, b_name, t_id, 1, slot_no, a_ref, b_ref,
                CASE WHEN a_ref IS NULL OR b_ref IS NULL THEN now() ELSE NULL END, sched);
      i := i + 2;
    END LOOP;

    FOR r IN 2..rounds LOOP
      FOR slot_no IN 1..(size / (2^r)::int) LOOP
        sched := CASE WHEN _scheduled_at IS NULL THEN NULL
                      ELSE _scheduled_at + ((r - 1) * interval '2 hours') + ((slot_no - 1) * interval '30 minutes') END;
        INSERT INTO public.matches(owner_id, sport, team_a, team_b, tournament_id, round, slot, scheduled_at)
          VALUES (uid, _sport, 'TBD', 'TBD', t_id, r, slot_no, sched);
      END LOOP;
    END LOOP;

    PERFORM public.advance_bracket_from(m.id) FROM public.matches m
      WHERE m.tournament_id = t_id AND m.round = 1 AND (m.team_a_ref IS NULL OR m.team_b_ref IS NULL);
  END IF;

  RETURN t_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_tournament_schedule(_tournament_id uuid, _scheduled_at timestamptz)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  old_at timestamptz;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.has_role(uid, 'admin') THEN RAISE EXCEPTION 'not_admin'; END IF;

  PERFORM set_config('app.bypass_match_guard', 'on', true);

  SELECT scheduled_at INTO old_at FROM public.tournaments WHERE id = _tournament_id;
  UPDATE public.tournaments SET scheduled_at = _scheduled_at, updated_at = now() WHERE id = _tournament_id;

  IF _scheduled_at IS NULL THEN
    UPDATE public.matches SET scheduled_at = NULL
      WHERE tournament_id = _tournament_id AND ended_at IS NULL;
  ELSIF old_at IS NULL THEN
    UPDATE public.matches SET scheduled_at = _scheduled_at + (COALESCE(round,1) - 1) * interval '2 hours'
      WHERE tournament_id = _tournament_id AND ended_at IS NULL;
  ELSE
    UPDATE public.matches
      SET scheduled_at = COALESCE(scheduled_at, old_at) + (_scheduled_at - old_at)
      WHERE tournament_id = _tournament_id AND ended_at IS NULL;
  END IF;
END;
$function$;

REVOKE ALL ON FUNCTION public.create_tournament(text, text, text, text[], jsonb, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_tournament(text, text, text, text[], jsonb, timestamptz) TO authenticated;
REVOKE ALL ON FUNCTION public.set_tournament_schedule(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_tournament_schedule(uuid, timestamptz) TO authenticated;