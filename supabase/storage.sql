-- =====================================================================
--  Optional: photo uploads for listings.
--  Run this after schema.sql if you want members to add a photo.
--  Photos go in a public bucket, max 2 MB, images only. Each member can
--  only upload into, or delete from, their own folder.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', true, 2097152,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members upload their own listing photos" on storage.objects;
create policy "Members upload their own listing photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "Members delete their own listing photos" on storage.objects;
create policy "Members delete their own listing photos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'listing-photos' and (storage.foldername(name))[1] = auth.uid()::text);
