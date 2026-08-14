create or replace function public.is_dm_group_member(_group_id uuid, _user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.dm_group_members gm
    where gm.group_id=_group_id and gm.user_id=_user_id
  );
$$;
revoke all on function public.is_dm_group_member(uuid,uuid) from public,anon;
grant execute on function public.is_dm_group_member(uuid,uuid) to authenticated;

create or replace function public.is_call_participant(_call_id uuid, _user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path=public as $$
  select exists(
    select 1 from public.call_participants cp
    where cp.call_id=_call_id and cp.user_id=_user_id
  );
$$;
revoke all on function public.is_call_participant(uuid,uuid) from public,anon;
grant execute on function public.is_call_participant(uuid,uuid) to authenticated;

drop policy if exists dm_groups_member_select on public.dm_groups;
create policy dm_groups_member_select on public.dm_groups for select to authenticated using (public.is_dm_group_member(id));

drop policy if exists dm_group_members_self_select on public.dm_group_members;
create policy dm_group_members_self_select on public.dm_group_members for select to authenticated using (public.is_dm_group_member(group_id));

drop policy if exists dm_group_messages_member_select on public.dm_group_messages;
create policy dm_group_messages_member_select on public.dm_group_messages for select to authenticated using (public.is_dm_group_member(group_id));

drop policy if exists dm_group_messages_member_insert on public.dm_group_messages;
create policy dm_group_messages_member_insert on public.dm_group_messages for insert to authenticated with check (sender_id=auth.uid() and public.is_dm_group_member(group_id));

drop policy if exists call_rooms_participant_select on public.call_rooms;
create policy call_rooms_participant_select on public.call_rooms for select to authenticated using (
  public.is_call_participant(id)
  or (group_id is not null and public.is_dm_group_member(group_id))
);

drop policy if exists call_participants_self_select on public.call_participants;
create policy call_participants_self_select on public.call_participants for select to authenticated using (public.is_call_participant(call_id));

drop policy if exists call_signals_participant_select on public.call_signals;
create policy call_signals_participant_select on public.call_signals for select to authenticated using (public.is_call_participant(call_id));

drop policy if exists call_signals_participant_insert on public.call_signals;
create policy call_signals_participant_insert on public.call_signals for insert to authenticated with check (sender_id=auth.uid() and public.is_call_participant(call_id));

DO $$ BEGIN
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='call_rooms') then
    alter publication supabase_realtime add table public.call_rooms;
  end if;
END $$;
