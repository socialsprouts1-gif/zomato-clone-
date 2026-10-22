-- Phase 9 · admin config: a public bucket for platform artwork (home banners, curated collection covers).
insert into storage.buckets (id, name, public) values ('platform-media', 'platform-media', true)
on conflict (id) do nothing;

create policy "platform media: read" on storage.objects for select
  using (bucket_id = 'platform-media');
create policy "platform media: admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'platform-media' and public.is_admin());
create policy "platform media: admin update" on storage.objects for update to authenticated
  using (bucket_id = 'platform-media' and public.is_admin())
  with check (bucket_id = 'platform-media' and public.is_admin());
create policy "platform media: admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'platform-media' and public.is_admin());
