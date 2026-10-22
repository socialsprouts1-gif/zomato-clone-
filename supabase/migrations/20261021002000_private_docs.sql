-- Onboarding documents (FSSAI licence, GST certificate, cancelled cheque) live in a private bucket.
-- The app stores object paths, and admins view them through short-lived signed URLs.
insert into storage.buckets (id, name, public) values ('restaurant-docs', 'restaurant-docs', false)
on conflict (id) do update set public = false;

create policy "restaurant-docs: team upload, team and admin read" on storage.objects for all to authenticated
  using (bucket_id = 'restaurant-docs' and (public.is_restaurant_member(((storage.foldername(name))[1])::uuid) or public.is_admin()))
  with check (bucket_id = 'restaurant-docs' and public.is_restaurant_member(((storage.foldername(name))[1])::uuid));
