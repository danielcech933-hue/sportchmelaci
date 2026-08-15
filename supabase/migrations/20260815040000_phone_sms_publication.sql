-- SMS phone verification uses Supabase Auth phone_confirmed_at.
-- This table stores only the user's explicit public-phone preference.

create table if not exists public.phone_verifications (
  user_id uuid primary key references auth.users(id) on delete cascade,
  phone_public boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.phone_verifications enable row level security;
grant select, insert, update on public.phone_verifications to authenticated;

drop policy if exists phone_verifications_self_select on public.phone_verifications;
create policy phone_verifications_self_select on public.phone_verifications
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists phone_verifications_self_insert on public.phone_verifications;
create policy phone_verifications_self_insert on public.phone_verifications
  for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists phone_verifications_self_update on public.phone_verifications;
create policy phone_verifications_self_update on public.phone_verifications
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function public.get_public_verified_phone(_user_id uuid)
returns table(phone_number text)
language sql stable security definer set search_path = public
as $$
  select au.phone
  from auth.users au
  left join public.phone_verifications pv on pv.user_id = au.id
  where au.id = _user_id
    and au.phone is not null
    and au.phone_confirmed_at is not null
    and coalesce(pv.phone_public, false) = true
  limit 1;
$$;
revoke all on function public.get_public_verified_phone(uuid) from public, anon;
grant execute on function public.get_public_verified_phone(uuid) to authenticated;

create or replace function public.set_phone_public(_enabled boolean)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from auth.users au
    where au.id = auth.uid()
      and au.phone is not null
      and au.phone_confirmed_at is not null
  ) then
    raise exception 'phone_not_verified';
  end if;

  insert into public.phone_verifications(user_id, phone_public, updated_at)
  values (auth.uid(), _enabled, now())
  on conflict (user_id) do update
    set phone_public = excluded.phone_public,
        updated_at = now();

  return _enabled;
end;
$$;
revoke all on function public.set_phone_public(boolean) from public, anon;
grant execute on function public.set_phone_public(boolean) to authenticated;

alter table public.match_notification_preferences
  add column if not exists sms_enabled boolean not null default false;
alter table public.match_notification_preferences
  drop column if exists telegram_enabled;

create or replace function public.schedule_match_sms_reminder(_match_id uuid)
returns integer
language plpgsql security definer set search_path = public
as $$
declare
  m public.matches%rowtype;
  recipient uuid;
  pref public.match_notification_preferences%rowtype;
  venue_record public.venues%rowtype;
  start_at timestamptz;
  remind_at timestamptz;
  key text;
  added integer := 0;
begin
  select * into m from public.matches where id = _match_id;
  if not found or m.scheduled_at is null or m.ended_at is not null then return 0; end if;
  start_at := m.scheduled_at;
  if m.venue_id is not null then
    select * into venue_record from public.venues where id = m.venue_id;
  end if;

  for recipient in
    select m.owner_id
    union
    select distinct tm.user_id
    from public.team_members tm
    where tm.team_id in (m.team_a_ref, m.team_b_ref)
    union
    select p.id
    from public.profiles p
    where lower(trim(p.nickname)) in (lower(trim(m.team_a)), lower(trim(m.team_b)))
  loop
    select * into pref
    from public.match_notification_preferences
    where user_id = recipient;

    if not coalesce(pref.sms_enabled, false) then continue; end if;
    if not exists (
      select 1 from auth.users au
      where au.id = recipient
        and au.phone is not null
        and au.phone_confirmed_at is not null
    ) then continue; end if;

    remind_at := start_at - make_interval(mins => coalesce(pref.reminder_minutes, 60));
    key := format('match:%s:user:%s:sms:%s', m.id, recipient, coalesce(pref.reminder_minutes, 60));

    insert into public.match_notification_jobs(
      match_id, user_id, channel, scheduled_for, dedupe_key,
      opponent, sport, venue_name, venue_address, match_scheduled_at
    )
    values (
      m.id, recipient, 'sms', remind_at, key,
      m.team_b, m.sport, venue_record.name, venue_record.address, start_at
    )
    on conflict (dedupe_key) do nothing;

    if found then added := added + 1; end if;
  end loop;

  return added;
end;
$$;
revoke all on function public.schedule_match_sms_reminder(uuid) from public, anon, authenticated;
grant execute on function public.schedule_match_sms_reminder(uuid) to authenticated;
