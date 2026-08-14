-- Admin-managed partner venues + privacy-aware player locator.

create table if not exists public.venues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  city text not null,
  address text,
  sports text not null default '',
  hours text not null default '',
  phone text,
  note text not null default '',
  booking_url text,
  map_url text,
  latitude double precision,
  longitude double precision,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint venues_lat_lon_pair check ((latitude is null and longitude is null) or (latitude between -90 and 90 and longitude between -180 and 180))
);

create index if not exists venues_active_sort_idx on public.venues (is_active, sort_order, name);
alter table public.venues enable row level security;
grant select on public.venues to anon, authenticated;
grant insert, update, delete on public.venues to authenticated;

drop policy if exists "venues_public_read_active" on public.venues;
create policy "venues_public_read_active" on public.venues
for select to anon, authenticated using (is_active = true);

drop policy if exists "venues_admin_insert" on public.venues;
create policy "venues_admin_insert" on public.venues
for insert to authenticated
with check ((select public.has_role(auth.uid(),'admin'::app_role)));

drop policy if exists "venues_admin_update" on public.venues;
create policy "venues_admin_update" on public.venues
for update to authenticated
using ((select public.has_role(auth.uid(),'admin'::app_role)))
with check ((select public.has_role(auth.uid(),'admin'::app_role)));

drop policy if exists "venues_admin_delete" on public.venues;
create policy "venues_admin_delete" on public.venues
for delete to authenticated
using ((select public.has_role(auth.uid(),'admin'::app_role)));

create or replace function public.touch_venues_updated_at()
returns trigger language plpgsql security definer set search_path = public
as $$ begin new.updated_at = now(); return new; end; $$;
revoke all on function public.touch_venues_updated_at() from public, anon, authenticated;

drop trigger if exists trg_touch_venues_updated_at on public.venues;
create trigger trg_touch_venues_updated_at
before update on public.venues
for each row execute function public.touch_venues_updated_at();

insert into public.venues (name, city, sports, hours, phone, note, sort_order)
select * from (values
  ('Chmelová Aréna','Praha 7','🎾 Tenis · 🏐 Volejbal · 🏆 Nohejbal','Po–Ne 8:00–22:00','+420 777 111 222','Domácí hala ligy — 3 antukové kurty a scoreboard na zdi.',10),
  ('Sportpark Hopfen','Brno-Židenice','⚽ Fotbal · 🎾 Padel','Po–Ne 7:00–23:00','+420 777 333 444','Umělá tráva s osvětlením, padel pod střechou.',20),
  ('Pivní Pinpong Klub','Plzeň','🏓 Ping pong · 🍺 Beer pong','Po–So 16:00–02:00',null,'8 stolů, turnaje každý čtvrtek.',30),
  ('Garage Darts & Foosball','Ostrava','🎯 Šipky · ⚽ Stolní fotbal','Denně 15:00–01:00',null,'Elektronické terče s automatickým zápisem skóre.',40)
) as v(name,city,sports,hours,phone,note,sort_order)
where not exists (select 1 from public.venues where venues.name = v.name);

create table if not exists public.user_locations (
  user_id uuid primary key references auth.users(id) on delete cascade,
  latitude double precision not null,
  longitude double precision not null,
  accuracy_m double precision,
  enabled boolean not null default false,
  visibility text not null default 'authenticated' check (visibility in ('off','authenticated')),
  updated_at timestamptz not null default now(),
  constraint user_locations_lat_lon_check check (latitude between -90 and 90 and longitude between -180 and 180)
);

create index if not exists user_locations_updated_idx on public.user_locations (updated_at desc);
alter table public.user_locations enable row level security;
grant select, insert, update, delete on public.user_locations to authenticated;

drop policy if exists "user_locations_self_select" on public.user_locations;
create policy "user_locations_self_select" on public.user_locations
for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "user_locations_self_insert" on public.user_locations;
create policy "user_locations_self_insert" on public.user_locations
for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "user_locations_self_update" on public.user_locations;
create policy "user_locations_self_update" on public.user_locations
for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

drop policy if exists "user_locations_self_delete" on public.user_locations;
create policy "user_locations_self_delete" on public.user_locations
for delete to authenticated using ((select auth.uid()) = user_id);

create or replace function public.get_public_user_location(_user_id uuid)
returns table (
  user_id uuid,
  latitude double precision,
  longitude double precision,
  accuracy_m double precision,
  updated_at timestamptz,
  stale boolean
)
language sql security definer set search_path = public stable
as $$
  select ul.user_id,
         round(ul.latitude::numeric,3)::double precision,
         round(ul.longitude::numeric,3)::double precision,
         ul.accuracy_m,
         ul.updated_at,
         (ul.updated_at < now() - interval '15 minutes')
  from public.user_locations ul
  where auth.uid() is not null
    and ul.user_id = _user_id
    and ul.enabled = true
    and ul.visibility = 'authenticated';
$$;

revoke all on function public.get_public_user_location(uuid) from public, anon;
grant execute on function public.get_public_user_location(uuid) to authenticated;
