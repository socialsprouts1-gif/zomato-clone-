-- Realtime publication and Storage buckets.
alter publication supabase_realtime add table
  public.orders, public.order_events, public.rider_locations, public.chat_messages,
  public.cart_items, public.cart_members, public.notifications, public.rider_offers,
  public.menu_items, public.support_messages, public.food_rescue_listings, public.table_bookings;

-- Full old rows on UPDATE so clients can diff status changes.
alter table public.orders replica identity full;
alter table public.menu_items replica identity full;

insert into storage.buckets (id, name, public) values
  ('avatars', 'avatars', true),
  ('restaurant-media', 'restaurant-media', true),
  ('review-photos', 'review-photos', true),
  ('rider-docs', 'rider-docs', false)
on conflict (id) do nothing;

-- Users upload into a folder named after their user id; restaurant media into a folder named after the restaurant id.
create policy "avatars: own folder" on storage.objects for all to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "review photos: own folder" on storage.objects for all to authenticated
  using (bucket_id = 'review-photos' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'review-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "rider docs: own folder" on storage.objects for all to authenticated
  using (bucket_id = 'rider-docs' and ((storage.foldername(name))[1] = (select auth.uid())::text or public.is_admin()))
  with check (bucket_id = 'rider-docs' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "restaurant media: team folder" on storage.objects for all to authenticated
  using (bucket_id = 'restaurant-media' and public.is_restaurant_member(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'restaurant-media' and public.is_restaurant_member(((storage.foldername(name))[1])::uuid));
create policy "public buckets: read" on storage.objects for select
  using (bucket_id in ('avatars', 'restaurant-media', 'review-photos'));
