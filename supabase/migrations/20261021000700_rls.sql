-- Row Level Security on every table.
-- Pattern: customers see their own rows, restaurant teams their outlets,
-- riders their assigned orders, admins everything. Writes that move money or
-- order status happen in server code with the service role (which bypasses RLS).

do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- profiles
create policy "profiles: read own" on public.profiles for select using (id = (select auth.uid()) or public.is_admin());
create policy "profiles: update own" on public.profiles for update using (id = (select auth.uid()) or public.is_admin());

-- addresses
create policy "addresses: own" on public.addresses for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "addresses: admin read" on public.addresses for select using (public.is_admin());

-- wallets (writes only via wallet_apply on the server)
create policy "wallets: read own" on public.wallets for select using (user_id = (select auth.uid()) or public.is_admin());
create policy "wallet_txns: read own" on public.wallet_transactions for select using (user_id = (select auth.uid()) or public.is_admin());

-- referrals
create policy "referrals: read own" on public.referrals for select
  using (referrer_id = (select auth.uid()) or referee_id = (select auth.uid()) or public.is_admin());

-- notifications
create policy "notifications: read own" on public.notifications for select using (user_id = (select auth.uid()));
create policy "notifications: mark read" on public.notifications for update
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "notifications: delete own" on public.notifications for delete using (user_id = (select auth.uid()));

-- search history / recently viewed / favourites
create policy "search_history: own" on public.search_history for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "recently_viewed: own" on public.recently_viewed for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "favourites: own" on public.favourites for all
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- audit log
create policy "audit: admin read" on public.admin_audit_log for select using (public.is_admin());

-- restaurants
create policy "restaurants: public read approved" on public.restaurants for select
  using (status = 'approved' or owner_id = (select auth.uid()) or public.is_restaurant_member(id) or public.is_admin());
create policy "restaurants: onboard" on public.restaurants for insert to authenticated with check (true);
create policy "restaurants: team update" on public.restaurants for update
  using (public.is_restaurant_member(id) or public.is_admin());
create policy "restaurants: admin delete" on public.restaurants for delete using (public.is_admin());

create policy "restaurant_private: team" on public.restaurant_private for all
  using (public.is_restaurant_member(restaurant_id) or public.is_admin())
  with check (public.is_restaurant_member(restaurant_id) or public.is_admin());

create policy "restaurant_staff: team read" on public.restaurant_staff for select
  using (public.is_restaurant_member(restaurant_id) or user_id = (select auth.uid()) or public.is_admin());
create policy "restaurant_staff: owner manage" on public.restaurant_staff for all
  using (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = (select auth.uid())) or public.is_admin())
  with check (exists (select 1 from public.restaurants r where r.id = restaurant_id and r.owner_id = (select auth.uid())) or public.is_admin());

-- Visible restaurant = approved, or caller is on its team, or admin. Used by menu tables.
create or replace function public.can_see_restaurant(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurants where id = rid and status = 'approved')
      or public.is_restaurant_member(rid) or public.is_admin()
$$;

create policy "photos: read" on public.restaurant_photos for select using (public.can_see_restaurant(restaurant_id));
create policy "photos: team write" on public.restaurant_photos for all
  using (public.is_restaurant_member(restaurant_id) or public.is_admin())
  with check (public.is_restaurant_member(restaurant_id) or public.is_admin());

create policy "categories: read" on public.menu_categories for select using (public.can_see_restaurant(restaurant_id));
create policy "categories: team write" on public.menu_categories for all
  using (public.is_restaurant_member(restaurant_id) or public.is_admin())
  with check (public.is_restaurant_member(restaurant_id) or public.is_admin());

create policy "items: read" on public.menu_items for select using (public.can_see_restaurant(restaurant_id));
create policy "items: team write" on public.menu_items for all
  using (public.is_restaurant_member(restaurant_id) or public.is_admin())
  with check (public.is_restaurant_member(restaurant_id) or public.is_admin());

create or replace function public.item_restaurant(iid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select restaurant_id from public.menu_items where id = iid
$$;

create policy "variants: read" on public.item_variants for select using (public.can_see_restaurant(public.item_restaurant(item_id)));
create policy "variants: team write" on public.item_variants for all
  using (public.is_restaurant_member(public.item_restaurant(item_id)) or public.is_admin())
  with check (public.is_restaurant_member(public.item_restaurant(item_id)) or public.is_admin());

create policy "addon_groups: read" on public.addon_groups for select using (public.can_see_restaurant(public.item_restaurant(item_id)));
create policy "addon_groups: team write" on public.addon_groups for all
  using (public.is_restaurant_member(public.item_restaurant(item_id)) or public.is_admin())
  with check (public.is_restaurant_member(public.item_restaurant(item_id)) or public.is_admin());

create or replace function public.addon_group_restaurant(gid uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select m.restaurant_id from public.addon_groups g join public.menu_items m on m.id = g.item_id where g.id = gid
$$;

create policy "addons: read" on public.addons for select using (public.can_see_restaurant(public.addon_group_restaurant(group_id)));
create policy "addons: team write" on public.addons for all
  using (public.is_restaurant_member(public.addon_group_restaurant(group_id)) or public.is_admin())
  with check (public.is_restaurant_member(public.addon_group_restaurant(group_id)) or public.is_admin());

create policy "tables: read" on public.restaurant_tables for select using (public.can_see_restaurant(restaurant_id));
create policy "tables: team write" on public.restaurant_tables for all
  using (public.is_restaurant_member(restaurant_id) or public.is_admin())
  with check (public.is_restaurant_member(restaurant_id) or public.is_admin());

create policy "offers: read active" on public.restaurant_offers for select
  using ((is_active and public.can_see_restaurant(restaurant_id)) or public.is_restaurant_member(restaurant_id) or public.is_admin());
create policy "offers: team write" on public.restaurant_offers for all
  using (public.is_restaurant_member(restaurant_id) or public.is_admin())
  with check (public.is_restaurant_member(restaurant_id) or public.is_admin());

create policy "ads: team" on public.ad_campaigns for select using (public.is_restaurant_member(restaurant_id) or public.is_admin());
create policy "ads: team update" on public.ad_campaigns for update
  using (public.is_restaurant_member(restaurant_id) or public.is_admin());

create policy "analytics: log" on public.analytics_events for insert
  with check (user_id is null or user_id = (select auth.uid()));
create policy "analytics: team read" on public.analytics_events for select
  using (public.is_restaurant_member(restaurant_id) or public.is_admin());

-- collections
create policy "collections: read" on public.collections for select
  using (is_curated or is_public or owner_id = (select auth.uid()) or public.is_admin());
create policy "collections: own write" on public.collections for all
  using (owner_id = (select auth.uid()) or public.is_admin())
  with check ((owner_id = (select auth.uid()) and not is_curated) or public.is_admin());
create policy "collection_items: read" on public.collection_items for select
  using (exists (select 1 from public.collections c where c.id = collection_id
    and (c.is_curated or c.is_public or c.owner_id = (select auth.uid()) or public.is_admin())));
create policy "collection_items: own write" on public.collection_items for all
  using (exists (select 1 from public.collections c where c.id = collection_id and (c.owner_id = (select auth.uid()) or public.is_admin())))
  with check (exists (select 1 from public.collections c where c.id = collection_id and (c.owner_id = (select auth.uid()) or public.is_admin())));

-- riders
create policy "riders: read" on public.riders for select
  using (id = (select auth.uid()) or public.is_admin() or public.has_active_order_with_rider(id)
    or exists (select 1 from public.orders o where o.rider_id = riders.id and public.is_restaurant_member(o.restaurant_id)
               and o.status in ('RIDER_ASSIGNED', 'READY', 'PREPARING', 'ACCEPTED', 'PICKED_UP')));
create policy "riders: onboard" on public.riders for insert to authenticated with check (true);
create policy "riders: update self" on public.riders for update using (id = (select auth.uid()) or public.is_admin());
create policy "rider_private: self" on public.rider_private for all
  using (rider_id = (select auth.uid()) or public.is_admin())
  with check (rider_id = (select auth.uid()) or public.is_admin());

-- carts (group orders)
create policy "carts: members read" on public.carts for select using (public.is_cart_member(id) or public.is_admin());
create policy "carts: host create" on public.carts for insert with check (host_id = (select auth.uid()));
create policy "carts: host update" on public.carts for update using (host_id = (select auth.uid()));
create policy "cart_members: read" on public.cart_members for select using (public.is_cart_member(cart_id));
create policy "cart_members: join self" on public.cart_members for insert
  with check (user_id = (select auth.uid()) and exists (select 1 from public.carts c where c.id = cart_id and c.status = 'open'));
create policy "cart_items: read" on public.cart_items for select using (public.is_cart_member(cart_id));
create policy "cart_items: add" on public.cart_items for insert
  with check (added_by = (select auth.uid()) and public.is_cart_member(cart_id)
    and exists (select 1 from public.carts c where c.id = cart_id and c.status = 'open'));
create policy "cart_items: change own" on public.cart_items for update
  using (added_by = (select auth.uid()) or exists (select 1 from public.carts c where c.id = cart_id and c.host_id = (select auth.uid())));
create policy "cart_items: remove own" on public.cart_items for delete
  using (added_by = (select auth.uid()) or exists (select 1 from public.carts c where c.id = cart_id and c.host_id = (select auth.uid())));

-- coupons
create policy "coupons: read active" on public.coupons for select using (is_active or public.is_admin());
create policy "coupons: admin write" on public.coupons for all using (public.is_admin()) with check (public.is_admin());
create policy "redemptions: read own" on public.coupon_redemptions for select
  using (user_id = (select auth.uid()) or public.is_admin()
    or (restaurant_offer_id is not null and exists (select 1 from public.restaurant_offers ro where ro.id = restaurant_offer_id and public.is_restaurant_member(ro.restaurant_id))));

-- orders (all writes via server)
create policy "orders: participants read" on public.orders for select
  using (customer_id = (select auth.uid()) or rider_id = (select auth.uid())
    or public.is_restaurant_member(restaurant_id) or public.is_admin());
create policy "order_items: read" on public.order_items for select using (public.can_view_order(order_id));
create policy "order_events: read" on public.order_events for select using (public.can_view_order(order_id));

-- rider offers / locations / earnings
create policy "rider_offers: own" on public.rider_offers for select using (rider_id = (select auth.uid()) or public.is_admin());
create policy "rider_locations: read" on public.rider_locations for select
  using (rider_id = (select auth.uid()) or public.is_admin() or (order_id is not null and public.can_view_order(order_id)));
create policy "rider_locations: rider insert" on public.rider_locations for insert
  with check (rider_id = (select auth.uid()) and (order_id is null or exists (select 1 from public.orders o where o.id = order_id and o.rider_id = (select auth.uid()))));
create policy "rider_earnings: own" on public.rider_earnings for select using (rider_id = (select auth.uid()) or public.is_admin());
create policy "rider_cash: own" on public.rider_cash_deposits for select using (rider_id = (select auth.uid()) or public.is_admin());

-- chat
create policy "chat: read" on public.chat_messages for select using (
  public.is_admin() or exists (
    select 1 from public.orders o where o.id = order_id and (
      (thread = 'customer_rider' and (o.customer_id = (select auth.uid()) or o.rider_id = (select auth.uid()))) or
      (thread = 'customer_restaurant' and (o.customer_id = (select auth.uid()) or public.is_restaurant_member(o.restaurant_id))) or
      (thread = 'rider_restaurant' and (o.rider_id = (select auth.uid()) or public.is_restaurant_member(o.restaurant_id)))
    )));
create policy "chat: send" on public.chat_messages for insert with check (
  sender_id = (select auth.uid()) and exists (
    select 1 from public.orders o where o.id = order_id and (
      (sender_role = 'customer' and o.customer_id = (select auth.uid()) and thread in ('customer_rider', 'customer_restaurant')) or
      (sender_role = 'rider' and o.rider_id = (select auth.uid()) and thread in ('customer_rider', 'rider_restaurant')) or
      (sender_role = 'restaurant' and public.is_restaurant_member(o.restaurant_id) and thread in ('customer_restaurant', 'rider_restaurant'))
    )));

-- reviews (public read; writes via server so we can verify the order)
create policy "reviews: public read" on public.reviews for select using (true);
create policy "review_photos: public read" on public.review_photos for select using (true);
create policy "review_replies: public read" on public.review_replies for select using (true);
create policy "review_replies: team write" on public.review_replies for all
  using (exists (select 1 from public.reviews r where r.id = review_id and public.is_restaurant_member(r.restaurant_id)))
  with check (author_id = (select auth.uid()) and exists (select 1 from public.reviews r where r.id = review_id and public.is_restaurant_member(r.restaurant_id)));

-- food rescue (claiming happens on the server)
create policy "rescue: read" on public.food_rescue_listings for select to authenticated
  using (status = 'available' or claimed_by = (select auth.uid()) or public.is_restaurant_member(restaurant_id) or public.is_admin());

-- payouts / donations
create policy "payouts: read" on public.payouts for select
  using (public.is_admin() or rider_id = (select auth.uid()) or (restaurant_id is not null and public.is_restaurant_member(restaurant_id)));
create policy "donations: read own" on public.donations for select using (user_id = (select auth.uid()) or public.is_admin());

-- banners / gold / settings (public config)
create policy "banners: read" on public.banners for select using (is_active or public.is_admin());
create policy "banners: admin write" on public.banners for all using (public.is_admin()) with check (public.is_admin());
create policy "gold_plans: read" on public.gold_plans for select using (true);
create policy "gold_plans: admin write" on public.gold_plans for all using (public.is_admin()) with check (public.is_admin());
create policy "gold_memberships: own" on public.gold_memberships for select using (user_id = (select auth.uid()) or public.is_admin());
create policy "zones: read" on public.delivery_zones for select using (true);
create policy "zones: admin write" on public.delivery_zones for all using (public.is_admin()) with check (public.is_admin());
create policy "fee_slabs: read" on public.fee_slabs for select using (true);
create policy "fee_slabs: admin write" on public.fee_slabs for all using (public.is_admin()) with check (public.is_admin());
create policy "settings: read" on public.platform_settings for select using (true);
create policy "settings: admin write" on public.platform_settings for update using (public.is_admin());

-- healthy subscriptions
create policy "healthy: own" on public.healthy_subscriptions for select
  using (user_id = (select auth.uid()) or public.is_restaurant_member(restaurant_id) or public.is_admin());

-- dining
create policy "bookings: read" on public.table_bookings for select
  using (user_id = (select auth.uid()) or public.is_restaurant_member(restaurant_id) or public.is_admin());
create policy "bookings: create" on public.table_bookings for insert
  with check (user_id = (select auth.uid()) and status = 'pending');
create policy "bookings: update" on public.table_bookings for update
  using (user_id = (select auth.uid()) or public.is_restaurant_member(restaurant_id) or public.is_admin());
create policy "dining_payments: read" on public.dining_payments for select
  using (user_id = (select auth.uid()) or public.is_restaurant_member(restaurant_id) or public.is_admin());

-- events
create policy "events: read" on public.events for select using (is_active or public.is_admin());
create policy "events: admin write" on public.events for all using (public.is_admin()) with check (public.is_admin());
create policy "event_tickets: own" on public.event_tickets for select using (user_id = (select auth.uid()) or public.is_admin());

-- support
create policy "tickets: read" on public.support_tickets for select using (user_id = (select auth.uid()) or public.is_admin());
create policy "tickets: create" on public.support_tickets for insert with check (user_id = (select auth.uid()));
create policy "tickets: admin update" on public.support_tickets for update using (public.is_admin());
create policy "support_messages: read" on public.support_messages for select
  using (exists (select 1 from public.support_tickets t where t.id = ticket_id and (t.user_id = (select auth.uid()) or public.is_admin())));
create policy "support_messages: send" on public.support_messages for insert with check (
  sender_id = (select auth.uid()) and exists (select 1 from public.support_tickets t where t.id = ticket_id
    and ((t.user_id = (select auth.uid()) and sender_role = 'customer') or (public.is_admin() and sender_role = 'agent'))));
