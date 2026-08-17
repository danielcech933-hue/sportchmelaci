-- Harden poker JSON helpers against malformed/non-array payloads.
-- The live poker engine remains server-authoritative.

create or replace function public.poker_score5(_cards jsonb)
returns jsonb
language plpgsql
immutable
security definer
set search_path=public,extensions,pg_temp
as $function$
declare
  ranks int[];
  counts int[] := array[]::int[];
  uniq int[];
  flush boolean;
  straight_high int := 0;
  cat int := 0;
  kick int[] := array[0,0,0,0,0];
  score numeric := 0;
  r int;
  i int;
  pair_hi int := 0;
  pair_lo int := 0;
  trip int := 0;
  quad int := 0;
  n int;
begin
  if jsonb_typeof(_cards) <> 'array' then
    return jsonb_build_object('score',0,'label','—');
  end if;
  n := jsonb_array_length(_cards);
  if n <> 5 then
    raise exception 'invalid_five_cards';
  end if;

  ranks := array(select (v->>'r')::int from jsonb_array_elements(_cards) v order by (v->>'r')::int desc);
  uniq := array(select distinct (v->>'r')::int from jsonb_array_elements(_cards) v order by 1 desc);
  select count(distinct (v->>'s')) = 1 into flush from jsonb_array_elements(_cards) v;

  if array_length(uniq,1) = 5 then
    if uniq[1]-uniq[5] = 4 then
      straight_high := uniq[1];
    elsif uniq[1] = 14 and uniq[2] = 5 and uniq[3] = 4 and uniq[4] = 3 and uniq[5] = 2 then
      straight_high := 5;
    end if;
  end if;

  for r in reverse 14..2 loop
    select count(*)::int into i from jsonb_array_elements(_cards) v where (v->>'r')::int = r;
    counts := counts || i;
    if i = 4 then quad := r;
    elsif i = 3 and trip = 0 then trip := r;
    elsif i = 2 and pair_hi = 0 then pair_hi := r;
    elsif i = 2 then pair_lo := r;
    end if;
  end loop;

  if straight_high > 0 and flush then
    cat := 8; kick[1] := straight_high;
  elsif quad > 0 then
    cat := 7; kick[1] := quad; kick[2] := (select max((v->>'r')::int) from jsonb_array_elements(_cards) v where (v->>'r')::int <> quad);
  elsif trip > 0 and pair_hi > 0 then
    cat := 6; kick[1] := trip; kick[2] := pair_hi;
  elsif flush then
    cat := 5; for i in 1..5 loop kick[i] := ranks[i]; end loop;
  elsif straight_high > 0 then
    cat := 4; kick[1] := straight_high;
  elsif trip > 0 then
    cat := 3; kick[1] := trip; i := 2;
    for r in select (v->>'r')::int from jsonb_array_elements(_cards) v where (v->>'r')::int <> trip order by (v->>'r')::int desc loop
      kick[i] := r; i := i + 1;
    end loop;
  elsif pair_hi > 0 and pair_lo > 0 then
    cat := 2; kick[1] := pair_hi; kick[2] := pair_lo;
    kick[3] := (select max((v->>'r')::int) from jsonb_array_elements(_cards) v where (v->>'r')::int <> pair_hi and (v->>'r')::int <> pair_lo);
  elsif pair_hi > 0 then
    cat := 1; kick[1] := pair_hi; i := 2;
    for r in select (v->>'r')::int from jsonb_array_elements(_cards) v where (v->>'r')::int <> pair_hi order by (v->>'r')::int desc loop
      kick[i] := r; i := i + 1;
    end loop;
  else
    cat := 0; for i in 1..5 loop kick[i] := ranks[i]; end loop;
  end if;

  score := cat::numeric * 759375;
  for i in 1..5 loop score := score + kick[i] * power(15::numeric,5-i); end loop;

  return jsonb_build_object('score',score,'label',case cat
    when 8 then 'Straight flush' when 7 then 'Čtyřice' when 6 then 'Full house'
    when 5 then 'Flush' when 4 then 'Straight' when 3 then 'Trojice'
    when 2 then 'Dva páry' when 1 then 'Pár' else 'Vysoká karta' end);
end;
$function$;

create or replace function public.poker_eval7(_cards jsonb)
returns jsonb
language sql
immutable
security definer
set search_path=public,extensions,pg_temp
as $function$
  select case
    when jsonb_typeof(_cards) <> 'array' or jsonb_array_length(_cards) < 5
      then jsonb_build_object('score',0,'label','—')
    else coalesce((
      select public.poker_score5(jsonb_build_array(c1,c2,c3,c4,c5))
      from generate_series(0,jsonb_array_length(_cards)-5) a
      cross join generate_series(a+1,jsonb_array_length(_cards)-4) b
      cross join generate_series(b+1,jsonb_array_length(_cards)-3) c
      cross join generate_series(c+1,jsonb_array_length(_cards)-2) d
      cross join generate_series(d+1,jsonb_array_length(_cards)-1) e
      cross join lateral (select _cards->a as c1,_cards->b as c2,_cards->c as c3,_cards->d as c4,_cards->e as c5) x
      order by (public.poker_score5(jsonb_build_array(c1,c2,c3,c4,c5))->>'score')::numeric desc
      limit 1
    ),jsonb_build_object('score',0,'label','—'))
  end;
$function$;

create or replace function public.poker_next_player(_players jsonb,_from integer)
returns integer
language plpgsql
immutable
security definer
set search_path=public,extensions,pg_temp
as $function$
declare
  i int;
  n int;
  p jsonb;
begin
  if jsonb_typeof(_players) <> 'array' or jsonb_array_length(_players) = 0 then
    return greatest(0,_from);
  end if;
  n := jsonb_array_length(_players);
  for i in 1..n loop
    p := _players->((_from+i)%n);
    if not coalesce((p->>'folded')::boolean,false)
       and not coalesce((p->>'allIn')::boolean,false)
       and coalesce((p->>'chips')::int,0) > 0 then
      return ((_from+i)%n);
    end if;
  end loop;
  return _from;
end;
$function$;
