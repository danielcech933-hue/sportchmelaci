-- Prevent the same match from applying ELO more than once.
CREATE TABLE IF NOT EXISTS public.match_elo_applications (
  match_id uuid PRIMARY KEY REFERENCES public.matches(id) ON DELETE CASCADE,
  applied_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.match_elo_applications FROM PUBLIC, anon, authenticated;

INSERT INTO public.match_elo_applications(match_id)
SELECT id
FROM public.matches
WHERE ended_at IS NOT NULL AND confirmed_at IS NOT NULL
ON CONFLICT (match_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.sync_match_elo(_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  m record;
  winner text;
  sets_a int;
  sets_b int;
  ids_a uuid[];
  ids_b uuid[];
  avg_a numeric;
  avg_b numeric;
  exp_a numeric;
  delta int;
  u uuid;
  names_a text[];
  names_b text[];
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(),'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;

  INSERT INTO public.match_elo_applications(match_id)
  VALUES (_match_id)
  ON CONFLICT (match_id) DO NOTHING;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  SELECT * INTO m FROM public.matches WHERE id=_match_id;
  IF m.id IS NULL OR m.ended_at IS NULL OR m.confirmed_at IS NULL THEN
    DELETE FROM public.match_elo_applications WHERE match_id=_match_id;
    RETURN;
  END IF;

  IF m.score_a > m.score_b THEN winner:='a';
  ELSIF m.score_b > m.score_a THEN winner:='b';
  ELSE
    SELECT count(*) INTO sets_a FROM jsonb_array_elements(coalesce(m.sets,'[]'::jsonb)) s WHERE (s->>'a')::int>(s->>'b')::int;
    SELECT count(*) INTO sets_b FROM jsonb_array_elements(coalesce(m.sets,'[]'::jsonb)) s WHERE (s->>'b')::int>(s->>'a')::int;
    IF sets_a>sets_b THEN winner:='a';
    ELSIF sets_b>sets_a THEN winner:='b';
    ELSE
      DELETE FROM public.match_elo_applications WHERE match_id=_match_id;
      RETURN;
    END IF;
  END IF;

  IF coalesce(jsonb_array_length(m.team_a_players),0)>0 THEN
    SELECT array_agg(lower(trim(x))) INTO names_a FROM jsonb_array_elements_text(m.team_a_players) x;
  ELSE
    SELECT array_agg(lower(trim(x))) INTO names_a FROM regexp_split_to_table(m.team_a,'\\s*(?:&|/|,|\\+)\\s*') x;
  END IF;
  IF coalesce(jsonb_array_length(m.team_b_players),0)>0 THEN
    SELECT array_agg(lower(trim(x))) INTO names_b FROM jsonb_array_elements_text(m.team_b_players) x;
  ELSE
    SELECT array_agg(lower(trim(x))) INTO names_b FROM regexp_split_to_table(m.team_b,'\\s*(?:&|/|,|\\+)\\s*') x;
  END IF;

  SELECT coalesce(array_agg(p.id),array[]::uuid[]) INTO ids_a FROM public.profiles p WHERE lower(p.nickname)=ANY(names_a);
  SELECT coalesce(array_agg(p.id),array[]::uuid[]) INTO ids_b FROM public.profiles p WHERE lower(p.nickname)=ANY(names_b);
  IF array_length(ids_a,1) IS NULL OR array_length(ids_b,1) IS NULL THEN
    DELETE FROM public.match_elo_applications WHERE match_id=_match_id;
    RETURN;
  END IF;

  SELECT avg(elo) INTO avg_a FROM public.profiles WHERE id=ANY(ids_a);
  SELECT avg(elo) INTO avg_b FROM public.profiles WHERE id=ANY(ids_b);
  exp_a:=1.0/(1.0+power(10.0,(avg_b-avg_a)/400.0));
  IF winner='a' THEN delta:=greatest(5,round(32*(1-exp_a))::int);
  ELSE delta:=greatest(5,round(32*exp_a)::int); END IF;

  IF winner='a' THEN
    UPDATE public.profiles SET elo=elo+delta WHERE id=ANY(ids_a);
    UPDATE public.profiles SET elo=greatest(100,elo-delta) WHERE id=ANY(ids_b);
    FOREACH u IN ARRAY ids_a LOOP
      PERFORM public.notify_win(u,'match_win','🏆 Výhra: '||m.team_a||' vs '||m.team_b,to_char(coalesce(m.ended_at,now()) AT TIME ZONE 'Europe/Prague','DD.MM.YYYY HH24:MI')||' • '||m.score_a||':'||m.score_b||' • +'||delta||' ELO');
    END LOOP;
  ELSE
    UPDATE public.profiles SET elo=elo+delta WHERE id=ANY(ids_b);
    UPDATE public.profiles SET elo=greatest(100,elo-delta) WHERE id=ANY(ids_a);
    FOREACH u IN ARRAY ids_b LOOP
      PERFORM public.notify_win(u,'match_win','🏆 Výhra: '||m.team_b||' vs '||m.team_a,to_char(coalesce(m.ended_at,now()) AT TIME ZONE 'Europe/Prague','DD.MM.YYYY HH24:MI')||' • '||m.score_b||':'||m.score_a||' • +'||delta||' ELO');
    END LOOP;
  END IF;
END;
$function$;