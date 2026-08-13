-- Keep live match score writes behind a single server-side RPC.
-- The client may request a score change, but never writes match score columns directly.

create or replace function public.save_match_score(
  _match_id uuid,
  _score_a integer,
  _score_b integer,
  _sets jsonb default '[]'::jsonb,
  _ended_at timestamptz default null
)
returns public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  v_match public.matches;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  if _score_a < 0 or _score_b < 0 then
    raise exception 'score cannot be negative';
  end if;

  select * into v_match
  from public.matches
  where id = _match_id
  for update;

  if not found then
    raise exception 'match not found';
  end if;

  if v_match.owner_id <> auth.uid() then
    raise exception 'only the match owner may update the score';
  end if;

  if v_match.confirmed_at is not null and _ended_at is null then
    raise exception 'confirmed match cannot be reopened through score update';
  end if;

  update public.matches
  set score_a = _score_a,
      score_b = _score_b,
      sets = coalesce(_sets, '[]'::jsonb),
      ended_at = _ended_at
  where id = _match_id
  returning * into v_match;

  return v_match;
end;
$$;

revoke all on function public.save_match_score(uuid, integer, integer, jsonb, timestamptz) from public;
grant execute on function public.save_match_score(uuid, integer, integer, jsonb, timestamptz) to authenticated;
