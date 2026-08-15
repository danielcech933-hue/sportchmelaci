-- Restore the server-authoritative match score RPC used by the /match page.
-- The production database was missing this function, so Finish match could not persist ended_at.

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
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
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

  if v_match.owner_id <> v_uid then
    raise exception 'only the match owner may update the score';
  end if;

  if v_match.confirmed_at is not null and _ended_at is null then
    raise exception 'confirmed match cannot be reopened';
  end if;

  -- The matches table has a guard trigger for direct client updates.
  -- Temporarily bypass that guard inside this authenticated owner-only RPC.
  perform set_config('app.bypass_match_guard', 'on', true);

  update public.matches
  set score_a = _score_a,
      score_b = _score_b,
      sets = coalesce(_sets, '[]'::jsonb),
      ended_at = _ended_at
  where id = _match_id
  returning * into v_match;

  perform set_config('app.bypass_match_guard', 'off', true);
  return v_match;
exception when others then
  perform set_config('app.bypass_match_guard', 'off', true);
  raise;
end;
$$;

revoke all on function public.save_match_score(uuid, integer, integer, jsonb, timestamptz) from public, anon;
grant execute on function public.save_match_score(uuid, integer, integer, jsonb, timestamptz) to authenticated;
