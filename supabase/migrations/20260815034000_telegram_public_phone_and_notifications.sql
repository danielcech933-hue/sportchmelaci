alter table public.telegram_verifications add column if not exists phone_number text;
alter table public.telegram_verifications add column if not exists phone_public boolean not null default false;
alter table public.match_notification_preferences add column if not exists telegram_enabled boolean not null default true;
alter table public.match_notification_jobs drop constraint if exists match_notification_jobs_channel_check;
alter table public.match_notification_jobs add constraint match_notification_jobs_channel_check check (channel in ('telegram','in_app','sms'));

create or replace function public.get_public_verified_phone(_user_id uuid)
returns table(phone_number text)
language sql stable security definer set search_path=public
as $$
  select tv.phone_number
  from public.telegram_verifications tv
  where tv.user_id=_user_id and tv.phone_public=true and tv.verified_at is not null
  limit 1;
$$;
revoke all on function public.get_public_verified_phone(uuid) from public,anon;
grant execute on function public.get_public_verified_phone(uuid) to authenticated;

create or replace function public.set_phone_public(_enabled boolean)
returns boolean
language plpgsql security definer set search_path=public
as $$
begin
  update public.telegram_verifications set phone_public=_enabled where user_id=auth.uid() and verified_at is not null;
  if not found then raise exception 'phone_not_verified'; end if;
  return _enabled;
end;
$$;
revoke all on function public.set_phone_public(boolean) from public,anon;
grant execute on function public.set_phone_public(boolean) to authenticated;

create or replace function public.schedule_match_sms_reminder(_match_id uuid)
returns integer language plpgsql security definer set search_path=public as $$
declare m public.matches%rowtype; recipient uuid; pref public.match_notification_preferences%rowtype; venue_record public.venues%rowtype; start_at timestamptz; remind_at timestamptz; key text; added integer:=0;
begin
  select * into m from public.matches where id=_match_id;
  if not found or m.scheduled_at is null or m.ended_at is not null then return 0; end if;
  start_at:=m.scheduled_at;
  if m.venue_id is not null then select * into venue_record from public.venues where id=m.venue_id; end if;
  for recipient in
    select m.owner_id union
    select distinct tm.user_id from public.team_members tm where tm.team_id in (m.team_a_ref,m.team_b_ref) union
    select p.id from public.profiles p where lower(trim(p.nickname)) in (lower(trim(m.team_a)),lower(trim(m.team_b)))
  loop
    select * into pref from public.match_notification_preferences where user_id=recipient;
    if not coalesce(pref.telegram_enabled,true) then continue; end if;
    if not exists(select 1 from public.telegram_verifications tv where tv.user_id=recipient and tv.verified_at is not null) then continue; end if;
    remind_at:=start_at-make_interval(mins=>coalesce(pref.reminder_minutes,60));
    key:=format('match:%s:user:%s:telegram:%s',m.id,recipient,coalesce(pref.reminder_minutes,60));
    insert into public.match_notification_jobs(match_id,user_id,channel,scheduled_for,dedupe_key,opponent,sport,venue_name,venue_address,match_scheduled_at)
    values(m.id,recipient,'telegram',remind_at,key,m.team_b,m.sport,venue_record.name,venue_record.address,start_at)
    on conflict(dedupe_key) do nothing;
    if found then added:=added+1; end if;
  end loop;
  return added;
end; $$;
revoke all on function public.schedule_match_sms_reminder(uuid) from public,anon,authenticated;
grant execute on function public.schedule_match_sms_reminder(uuid) to authenticated;
