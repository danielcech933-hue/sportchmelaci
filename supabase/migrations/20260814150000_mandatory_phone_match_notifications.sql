-- Mandatory verified phone is enforced in the app via Supabase Auth phone_confirmed_at.
-- This migration stores only match-reminder preferences/queues; raw phone numbers remain in auth.users.

alter table public.matches add column if not exists venue_id uuid references public.venues(id) on delete set null;
create index if not exists matches_venue_idx on public.matches(venue_id);

create table if not exists public.match_notification_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  sms_enabled boolean not null default false,
  reminder_minutes integer not null default 60 check (reminder_minutes between 5 and 1440),
  updated_at timestamptz not null default now()
);
alter table public.match_notification_preferences enable row level security;
grant select, insert, update on public.match_notification_preferences to authenticated;
drop policy if exists "match_notification_preferences_self_select" on public.match_notification_preferences;
create policy "match_notification_preferences_self_select" on public.match_notification_preferences for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists "match_notification_preferences_self_insert" on public.match_notification_preferences;
create policy "match_notification_preferences_self_insert" on public.match_notification_preferences for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "match_notification_preferences_self_update" on public.match_notification_preferences;
create policy "match_notification_preferences_self_update" on public.match_notification_preferences for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

insert into public.match_notification_preferences(user_id)
select id from auth.users on conflict (user_id) do nothing;

create table if not exists public.match_notification_jobs (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null default 'sms' check (channel in ('sms','in_app')),
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','cancelled')),
  dedupe_key text not null unique,
  opponent text,
  sport text,
  venue_name text,
  venue_address text,
  match_scheduled_at timestamptz,
  sent_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists match_notification_jobs_due_idx on public.match_notification_jobs(status, scheduled_for);
create index if not exists match_notification_jobs_user_idx on public.match_notification_jobs(user_id, scheduled_for desc);
alter table public.match_notification_jobs enable row level security;
grant select on public.match_notification_jobs to authenticated;
drop policy if exists "match_notification_jobs_self_select" on public.match_notification_jobs;
create policy "match_notification_jobs_self_select" on public.match_notification_jobs for select to authenticated using ((select auth.uid()) = user_id);

create or replace function public.schedule_match_sms_reminder(_match_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
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
  if m.venue_id is not null then select * into venue_record from public.venues where id = m.venue_id; end if;

  for recipient in
    select m.owner_id
    union
    select distinct tm.user_id from public.team_members tm where tm.team_id in (m.team_a_ref, m.team_b_ref)
    union
    select p.id from public.profiles p where lower(trim(p.nickname)) in (lower(trim(m.team_a)), lower(trim(m.team_b)))
  loop
    select * into pref from public.match_notification_preferences where user_id = recipient;
    if not coalesce(pref.sms_enabled,false) then continue; end if;
    if not exists (select 1 from auth.users au where au.id = recipient and au.phone is not null and au.phone_confirmed_at is not null) then continue; end if;
    remind_at := start_at - make_interval(mins => coalesce(pref.reminder_minutes,60));
    key := format('match:%s:user:%s:minutes:%s', m.id, recipient, coalesce(pref.reminder_minutes,60));
    insert into public.match_notification_jobs(match_id,user_id,channel,scheduled_for,dedupe_key,opponent,sport,venue_name,venue_address,match_scheduled_at)
    values (m.id, recipient, 'sms', remind_at, key, m.team_b, m.sport, venue_record.name, venue_record.address, start_at)
    on conflict (dedupe_key) do nothing;
    if found then added := added + 1; end if;
  end loop;
  return added;
end; $$;
revoke all on function public.schedule_match_sms_reminder(uuid) from public, anon, authenticated;
grant execute on function public.schedule_match_sms_reminder(uuid) to authenticated;

create or replace function public.get_my_match_notification_jobs()
returns table(id uuid, match_id uuid, scheduled_for timestamptz, status text, opponent text, sport text, venue_name text, venue_address text, match_scheduled_at timestamptz)
language sql security definer set search_path=public stable as $$
  select j.id,j.match_id,j.scheduled_for,j.status,j.opponent,j.sport,j.venue_name,j.venue_address,j.match_scheduled_at
  from public.match_notification_jobs j where j.user_id = auth.uid() order by j.scheduled_for desc limit 50;
$$;
revoke all on function public.get_my_match_notification_jobs() from public, anon;
grant execute on function public.get_my_match_notification_jobs() to authenticated;

comment on table public.match_notification_jobs is 'Server-side queue for verified-phone match reminders. SMS delivery is performed by a separately configured provider worker; no phone numbers are copied here.';
