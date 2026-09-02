create table if not exists public.social_stories (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, author_nickname text not null, media_url text not null, storage_path text, caption text, expires_at timestamptz not null default (now() + interval '24 hours'), created_at timestamptz not null default now()
);
create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, author_nickname text not null, body text not null default '', image_url text, storage_path text, match_id text, created_at timestamptz not null default now()
);
create table if not exists public.social_comments (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.social_posts(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, author_nickname text not null, body text not null, created_at timestamptz not null default now()
);
create table if not exists public.social_post_likes (
  id uuid primary key default gen_random_uuid(), post_id uuid not null references public.social_posts(id) on delete cascade, user_id uuid not null references auth.users(id) on delete cascade, created_at timestamptz not null default now(), unique (post_id, user_id)
);
create table if not exists public.profile_media (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, media_url text not null, storage_path text, caption text, match_id text, created_at timestamptz not null default now()
);
alter table public.social_stories add column if not exists storage_path text;
alter table public.social_posts add column if not exists storage_path text;
alter table public.profile_media add column if not exists storage_path text;
create index if not exists social_stories_created_idx on public.social_stories(created_at desc);
create index if not exists social_stories_expires_idx on public.social_stories(expires_at);
create index if not exists social_stories_user_idx on public.social_stories(user_id, created_at desc);
create index if not exists social_posts_created_idx on public.social_posts(created_at desc);
create index if not exists social_posts_user_idx on public.social_posts(user_id, created_at desc);
create index if not exists social_comments_post_idx on public.social_comments(post_id, created_at asc);
create index if not exists social_likes_post_idx on public.social_post_likes(post_id);
create index if not exists social_likes_user_idx on public.social_post_likes(user_id, post_id);
create index if not exists profile_media_user_idx on public.profile_media(user_id, created_at desc);
alter table public.social_stories enable row level security;
alter table public.social_posts enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_post_likes enable row level security;
alter table public.profile_media enable row level security;
drop policy if exists "social stories public read" on public.social_stories;
create policy "social stories public read" on public.social_stories for select using (true);
drop policy if exists "social stories own insert" on public.social_stories;
create policy "social stories own insert" on public.social_stories for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "social stories own update" on public.social_stories;
create policy "social stories own update" on public.social_stories for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "social stories own delete" on public.social_stories;
create policy "social stories own delete" on public.social_stories for delete to authenticated using (auth.uid() = user_id);
drop policy if exists "social posts public read" on public.social_posts;
create policy "social posts public read" on public.social_posts for select using (true);
drop policy if exists "social posts own insert" on public.social_posts;
create policy "social posts own insert" on public.social_posts for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "social posts own update" on public.social_posts;
create policy "social posts own update" on public.social_posts for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "social posts own delete" on public.social_posts;
create policy "social posts own delete" on public.social_posts for delete to authenticated using (auth.uid() = user_id);
drop policy if exists "social comments public read" on public.social_comments;
create policy "social comments public read" on public.social_comments for select using (true);
drop policy if exists "social comments own insert" on public.social_comments;
create policy "social comments own insert" on public.social_comments for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "social comments own delete" on public.social_comments;
create policy "social comments own delete" on public.social_comments for delete to authenticated using (auth.uid() = user_id);
drop policy if exists "social likes public read" on public.social_post_likes;
create policy "social likes public read" on public.social_post_likes for select using (true);
drop policy if exists "social likes own insert" on public.social_post_likes;
create policy "social likes own insert" on public.social_post_likes for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "social likes own delete" on public.social_post_likes;
create policy "social likes own delete" on public.social_post_likes for delete to authenticated using (auth.uid() = user_id);
drop policy if exists "profile media public read" on public.profile_media;
create policy "profile media public read" on public.profile_media for select using (true);
drop policy if exists "profile media own insert" on public.profile_media;
create policy "profile media own insert" on public.profile_media for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "profile media own update" on public.profile_media;
create policy "profile media own update" on public.profile_media for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "profile media own delete" on public.profile_media;
create policy "profile media own delete" on public.profile_media for delete to authenticated using (auth.uid() = user_id);
