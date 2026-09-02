insert into storage.buckets (id, name, public)
values ('social-media', 'social-media', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists "social media public read" on storage.objects;
create policy "social media public read" on storage.objects for select using (bucket_id = 'social-media');
drop policy if exists "social media own upload" on storage.objects;
create policy "social media own upload" on storage.objects for insert to authenticated with check (bucket_id = 'social-media' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "social media own update" on storage.objects;
create policy "social media own update" on storage.objects for update to authenticated using (bucket_id = 'social-media' and owner_id = auth.uid()::text) with check (bucket_id = 'social-media' and owner_id = auth.uid()::text);
drop policy if exists "social media own delete" on storage.objects;
create policy "social media own delete" on storage.objects for delete to authenticated using (bucket_id = 'social-media' and owner_id = auth.uid()::text);
