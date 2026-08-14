create table if not exists public.dm_groups (id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 1 and 80), created_by uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now());
create table if not exists public.dm_group_members (group_id uuid not null references public.dm_groups(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, is_admin boolean not null default false, joined_at timestamptz not null default now(), primary key (group_id,user_id));
create table if not exists public.dm_group_messages (id uuid primary key default gen_random_uuid(), group_id uuid not null references public.dm_groups(id) on delete cascade, sender_id uuid not null references auth.users(id) on delete cascade, content text not null check (char_length(trim(content)) between 1 and 4000), created_at timestamptz not null default now());
create table if not exists public.call_rooms (id uuid primary key default gen_random_uuid(), group_id uuid references public.dm_groups(id) on delete cascade, created_by uuid not null references auth.users(id) on delete cascade, kind text not null check (kind in ('direct','group')), status text not null default 'ringing' check (status in ('ringing','active','ended')), created_at timestamptz not null default now(), ended_at timestamptz);
create table if not exists public.call_participants (call_id uuid not null references public.call_rooms(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, joined_at timestamptz not null default now(), left_at timestamptz, primary key (call_id,user_id));
create table if not exists public.call_signals (id uuid primary key default gen_random_uuid(), call_id uuid not null references public.call_rooms(id) on delete cascade, sender_id uuid not null references auth.users(id) on delete cascade, recipient_id uuid references auth.users(id) on delete cascade, signal_type text not null check (signal_type in ('offer','answer','ice-candidate','hangup')), payload jsonb not null default '{}'::jsonb, created_at timestamptz not null default now());
create index if not exists dm_group_members_user_idx on public.dm_group_members(user_id,group_id);
create index if not exists dm_group_messages_group_created_idx on public.dm_group_messages(group_id,created_at);
create index if not exists call_participants_call_active_idx on public.call_participants(call_id,joined_at) where left_at is null;
create index if not exists call_signals_call_created_idx on public.call_signals(call_id,created_at);

alter table public.dm_groups enable row level security;
alter table public.dm_group_members enable row level security;
alter table public.dm_group_messages enable row level security;
alter table public.call_rooms enable row level security;
alter table public.call_participants enable row level security;
alter table public.call_signals enable row level security;

drop policy if exists dm_groups_member_select on public.dm_groups;
create policy dm_groups_member_select on public.dm_groups for select to authenticated using (exists (select 1 from public.dm_group_members m where m.group_id=id and m.user_id=auth.uid()));
drop policy if exists dm_group_members_self_select on public.dm_group_members;
create policy dm_group_members_self_select on public.dm_group_members for select to authenticated using (exists (select 1 from public.dm_group_members mine where mine.group_id=group_id and mine.user_id=auth.uid()));
drop policy if exists dm_group_messages_member_select on public.dm_group_messages;
create policy dm_group_messages_member_select on public.dm_group_messages for select to authenticated using (exists (select 1 from public.dm_group_members m where m.group_id=group_id and m.user_id=auth.uid()));
drop policy if exists dm_group_messages_member_insert on public.dm_group_messages;
create policy dm_group_messages_member_insert on public.dm_group_messages for insert to authenticated with check (sender_id=auth.uid() and exists (select 1 from public.dm_group_members m where m.group_id=group_id and m.user_id=auth.uid()));
drop policy if exists call_rooms_participant_select on public.call_rooms;
create policy call_rooms_participant_select on public.call_rooms for select to authenticated using (exists (select 1 from public.call_participants p where p.call_id=id and p.user_id=auth.uid()));
drop policy if exists call_participants_self_select on public.call_participants;
create policy call_participants_self_select on public.call_participants for select to authenticated using (exists (select 1 from public.call_participants p where p.call_id=call_id and p.user_id=auth.uid()));
drop policy if exists call_signals_participant_select on public.call_signals;
create policy call_signals_participant_select on public.call_signals for select to authenticated using (exists (select 1 from public.call_participants p where p.call_id=call_id and p.user_id=auth.uid()));
drop policy if exists call_signals_participant_insert on public.call_signals;
create policy call_signals_participant_insert on public.call_signals for insert to authenticated with check (sender_id=auth.uid() and exists (select 1 from public.call_participants p where p.call_id=call_id and p.user_id=auth.uid()));

create or replace function public.create_dm_group(_name text, _member_ids uuid[])
returns uuid language plpgsql security definer set search_path=public as $$
declare gid uuid; uid uuid:=auth.uid(); mid uuid;
begin
 if uid is null then raise exception 'not_authenticated'; end if;
 if coalesce(length(trim(_name)),0) not between 1 and 80 then raise exception 'invalid_group_name'; end if;
 if coalesce(array_length(_member_ids,1),0) < 1 or array_length(_member_ids,1) > 24 then raise exception 'invalid_member_count'; end if;
 insert into public.dm_groups(name,created_by) values (trim(_name),uid) returning id into gid;
 insert into public.dm_group_members(group_id,user_id,is_admin) values (gid,uid,true) on conflict do nothing;
 foreach mid in array _member_ids loop
   if mid <> uid and exists(select 1 from public.profiles where id=mid) then
     insert into public.dm_group_members(group_id,user_id,is_admin) values(gid,mid,false) on conflict do nothing;
   end if;
 end loop;
 return gid;
end; $$;
revoke all on function public.create_dm_group(text,uuid[]) from public,anon;
grant execute on function public.create_dm_group(text,uuid[]) to authenticated;

create or replace function public.create_call(_peer_id uuid default null, _group_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); cid uuid; member_ok boolean;
begin
 if uid is null then raise exception 'not_authenticated'; end if;
 if ((_peer_id is null) = (_group_id is null)) then raise exception 'choose_direct_or_group'; end if;
 if _group_id is not null then
   select exists(select 1 from public.dm_group_members where group_id=_group_id and user_id=uid) into member_ok;
   if not member_ok then raise exception 'not_group_member'; end if;
   insert into public.call_rooms(group_id,created_by,kind) values(_group_id,uid,'group') returning id into cid;
   insert into public.call_participants(call_id,user_id) values(cid,uid);
 elsif _peer_id is not null then
   if _peer_id=uid then raise exception 'cannot_call_self'; end if;
   if not exists(select 1 from public.profiles where id=_peer_id) then raise exception 'peer_not_found'; end if;
   insert into public.call_rooms(created_by,kind) values(uid,'direct') returning id into cid;
   insert into public.call_participants(call_id,user_id) values(cid,uid),(cid,_peer_id);
 end if;
 return cid;
end; $$;
revoke all on function public.create_call(uuid,uuid) from public,anon;
grant execute on function public.create_call(uuid,uuid) to authenticated;

create or replace function public.join_call(_call_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); ok boolean;
begin
 if uid is null then raise exception 'not_authenticated'; end if;
 select exists(
   select 1 from public.call_rooms c
   where c.id=_call_id and (
     (c.kind='direct' and exists(select 1 from public.call_participants p where p.call_id=c.id and p.user_id=uid))
     or (c.kind='group' and exists(select 1 from public.dm_group_members gm where gm.group_id=c.group_id and gm.user_id=uid))
   )
 ) into ok;
 if not ok then raise exception 'not_allowed'; end if;
 insert into public.call_participants(call_id,user_id) values(_call_id,uid) on conflict(call_id,user_id) do update set left_at=null,joined_at=now();
 update public.call_rooms set status='active',ended_at=null where id=_call_id;
 return true;
end; $$;
revoke all on function public.join_call(uuid) from public,anon;
grant execute on function public.join_call(uuid) to authenticated;

create or replace function public.leave_call(_call_id uuid)
returns boolean language plpgsql security definer set search_path=public as $$
declare uid uuid:=auth.uid(); remaining integer;
begin
 if uid is null then raise exception 'not_authenticated'; end if;
 update public.call_participants set left_at=now() where call_id=_call_id and user_id=uid;
 select count(*) into remaining from public.call_participants where call_id=_call_id and left_at is null;
 if remaining=0 then update public.call_rooms set status='ended',ended_at=coalesce(ended_at,now()) where id=_call_id; end if;
 return true;
end; $$;
revoke all on function public.leave_call(uuid) from public,anon;
grant execute on function public.leave_call(uuid) to authenticated;

create or replace function public.call_participant_snapshot(_call_id uuid)
returns table(user_id uuid, nickname text, joined_at timestamptz) language sql stable security definer set search_path=public as $$
 select p.user_id, prof.nickname, p.joined_at
 from public.call_participants p join public.profiles prof on prof.id=p.user_id
 where p.call_id=_call_id and p.left_at is null and exists(select 1 from public.call_participants me where me.call_id=_call_id and me.user_id=auth.uid())
 order by p.joined_at;
$$;
revoke all on function public.call_participant_snapshot(uuid) from public,anon;
grant execute on function public.call_participant_snapshot(uuid) to authenticated;

DO $$ BEGIN
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='dm_group_messages') then alter publication supabase_realtime add table public.dm_group_messages; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='call_participants') then alter publication supabase_realtime add table public.call_participants; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='call_signals') then alter publication supabase_realtime add table public.call_signals; end if;
END $$;