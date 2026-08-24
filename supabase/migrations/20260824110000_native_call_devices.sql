create table if not exists public.call_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_id text not null check (char_length(trim(device_id)) between 1 and 200),
  platform text not null check (platform in ('ios','android','web')),
  push_token text,
  voip_token text,
  enabled boolean not null default true,
  app_version text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, device_id)
);

create index if not exists call_devices_user_enabled_idx
  on public.call_devices(user_id, enabled)
  where enabled = true;

alter table public.call_devices enable row level security;

drop policy if exists call_devices_self_select on public.call_devices;
create policy call_devices_self_select
  on public.call_devices for select to authenticated
  using (user_id = auth.uid());

drop policy if exists call_devices_self_update on public.call_devices;
create policy call_devices_self_update
  on public.call_devices for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists call_devices_self_delete on public.call_devices;
create policy call_devices_self_delete
  on public.call_devices for delete to authenticated
  using (user_id = auth.uid());

create or replace function public.register_call_device(
  _device_id text,
  _platform text,
  _push_token text default null,
  _voip_token text default null,
  _app_version text default null
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  uid uuid := auth.uid();
  did uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if _platform not in ('ios','android','web') then raise exception 'invalid_platform'; end if;
  if coalesce(length(trim(_device_id)),0) not between 1 and 200 then raise exception 'invalid_device_id'; end if;
  if nullif(trim(coalesce(_push_token,'')),'') is null and nullif(trim(coalesce(_voip_token,'')),'') is null then
    raise exception 'missing_push_token';
  end if;

  insert into public.call_devices(user_id,device_id,platform,push_token,voip_token,app_version,enabled,last_seen_at,updated_at)
  values(uid,trim(_device_id),_platform,nullif(trim(_push_token),''),nullif(trim(_voip_token),''),nullif(trim(_app_version),''),true,now(),now())
  on conflict (user_id,device_id) do update set
    platform=excluded.platform,
    push_token=coalesce(excluded.push_token,call_devices.push_token),
    voip_token=coalesce(excluded.voip_token,call_devices.voip_token),
    app_version=coalesce(excluded.app_version,call_devices.app_version),
    enabled=true,
    last_seen_at=now(),
    updated_at=now()
  returning id into did;

  return did;
end;
$$;

revoke all on function public.register_call_device(text,text,text,text,text) from public,anon;
grant execute on function public.register_call_device(text,text,text,text,text) to authenticated;

create or replace function public.disable_call_device(_device_id text)
returns boolean
language plpgsql
security definer
set search_path=public
as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  update public.call_devices
     set enabled=false, updated_at=now()
   where user_id=uid and device_id=trim(_device_id);
  return found;
end;
$$;

revoke all on function public.disable_call_device(text) from public,anon;
grant execute on function public.disable_call_device(text) to authenticated;

create or replace function public.call_target_devices(_call_id uuid)
returns table(user_id uuid, platform text, push_token text, voip_token text, device_id text)
language sql
stable
security definer
set search_path=public
as $$
  select d.user_id, d.platform, d.push_token, d.voip_token, d.device_id
  from public.call_devices d
  where d.enabled = true
    and exists (
      select 1
      from public.call_participants p
      where p.call_id = _call_id
        and p.user_id = d.user_id
        and p.left_at is null
        and p.user_id <> auth.uid()
    );
$$;

revoke all on function public.call_target_devices(uuid) from public,anon;
grant execute on function public.call_target_devices(uuid) to authenticated;

create or replace function public.touch_call_device(_device_id text)
returns boolean
language sql
security definer
set search_path=public
as $$
  update public.call_devices
     set last_seen_at=now(), updated_at=now()
   where user_id=auth.uid() and device_id=trim(_device_id) and enabled=true;
  select found;
$$;

revoke all on function public.touch_call_device(text) from public,anon;
grant execute on function public.touch_call_device(text) to authenticated;
