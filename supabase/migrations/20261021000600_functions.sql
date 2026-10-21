-- Helper functions used by RLS policies, triggers and the app.

create or replace function public.current_user_role() returns public.user_role
language sql stable security definer set search_path = public as $$
  select role from public.profiles where id = auth.uid()
$$;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin' and not is_blocked)
$$;

-- Owner, or active staff member, of a restaurant.
create or replace function public.is_restaurant_member(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.restaurants where id = rid and owner_id = auth.uid())
      or exists (select 1 from public.restaurant_staff where restaurant_id = rid and user_id = auth.uid() and status = 'active')
$$;

create or replace function public.my_restaurant_ids() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from public.restaurants where owner_id = auth.uid()
  union
  select restaurant_id from public.restaurant_staff where user_id = auth.uid() and status = 'active'
$$;

-- Customer, assigned rider, restaurant team or admin.
create or replace function public.can_view_order(oid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders o
    where o.id = oid
      and (o.customer_id = auth.uid() or o.rider_id = auth.uid() or public.is_restaurant_member(o.restaurant_id) or public.is_admin())
  )
$$;

-- Customer who can see a rider: has an active order with that rider.
create or replace function public.has_active_order_with_rider(rid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orders
    where rider_id = rid and customer_id = auth.uid()
      and status in ('RIDER_ASSIGNED', 'PICKED_UP', 'OUT_FOR_DELIVERY', 'READY', 'PREPARING', 'ACCEPTED')
  )
$$;

create or replace function public.is_cart_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.carts where id = cid and host_id = auth.uid())
      or exists (select 1 from public.cart_members where cart_id = cid and user_id = auth.uid())
$$;

create or replace function public.is_service_context() returns boolean
language sql stable as $$
  select coalesce(auth.role(), '') = 'service_role' or current_user in ('postgres', 'supabase_admin')
$$;

-- New auth user -> profile + wallet.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}');
  app_role text := new.raw_app_meta_data ->> 'role';
  code text;
begin
  loop
    code := public.random_code(6);
    exit when not exists (select 1 from public.profiles where referral_code = code);
  end loop;
  insert into public.profiles (id, role, name, email, phone, avatar_url, referral_code)
  values (
    new.id,
    coalesce(nullif(app_role, '')::public.user_role, 'customer'),
    coalesce(meta ->> 'name', meta ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when new.email like '%@phone.thaali.app' then null else new.email end,
    coalesce(nullif(new.phone, ''), meta ->> 'phone'),
    meta ->> 'avatar_url',
    code
  )
  on conflict (id) do nothing;
  insert into public.wallets (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Only admins / server code may change privileged profile fields.
create or replace function public.profiles_guard() returns trigger language plpgsql as $$
begin
  if (new.role is distinct from old.role or new.is_blocked is distinct from old.is_blocked
      or new.referral_code is distinct from old.referral_code or new.referred_by is distinct from old.referred_by)
     and not public.is_service_context() and not public.is_admin() then
    raise exception 'not allowed to change role, block status or referral fields' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();

-- Restaurant teams can edit their outlet but not platform-controlled fields.
create or replace function public.restaurants_guard() returns trigger language plpgsql as $$
begin
  if public.is_service_context() or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.status := 'pending';
    new.owner_id := auth.uid();
    new.commission_pct := (select default_commission_pct from public.platform_settings);
    new.rating_delivery := 0; new.rating_dining := 0; new.rating_count := 0; new.dining_rating_count := 0;
    new.is_featured := false; new.sponsored_until := null; new.gold_partner := false;
    return new;
  end if;
  if new.status is distinct from old.status or new.commission_pct is distinct from old.commission_pct
     or new.owner_id is distinct from old.owner_id or new.is_featured is distinct from old.is_featured
     or new.rating_delivery is distinct from old.rating_delivery or new.rating_dining is distinct from old.rating_dining
     or new.rating_count is distinct from old.rating_count or new.gold_partner is distinct from old.gold_partner
     or new.sponsored_until is distinct from old.sponsored_until or new.slug is distinct from old.slug then
    raise exception 'not allowed to change platform-controlled restaurant fields' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger restaurants_guard before insert or update on public.restaurants for each row execute function public.restaurants_guard();

-- Riders can toggle online/location but not approval, rating or cash fields.
create or replace function public.riders_guard() returns trigger language plpgsql as $$
begin
  if public.is_service_context() or public.is_admin() then
    return new;
  end if;
  if tg_op = 'INSERT' then
    new.id := auth.uid(); new.status := 'pending'; new.is_simulated := false; new.rating := 5.0;
    new.rating_count := 0; new.floating_cash_paise := 0; new.current_order_id := null; new.is_online := false;
    return new;
  end if;
  if new.status is distinct from old.status or new.rating is distinct from old.rating
     or new.rating_count is distinct from old.rating_count or new.floating_cash_paise is distinct from old.floating_cash_paise
     or new.current_order_id is distinct from old.current_order_id or new.is_simulated is distinct from old.is_simulated then
    raise exception 'not allowed to change platform-controlled rider fields' using errcode = '42501';
  end if;
  if new.is_online and old.status <> 'approved' then
    raise exception 'rider is not approved yet' using errcode = '42501';
  end if;
  return new;
end $$;
create trigger riders_guard before insert or update on public.riders for each row execute function public.riders_guard();

-- Atomic wallet movement. Server-only (service role).
create or replace function public.wallet_apply(
  p_user uuid, p_amount bigint, p_type public.wallet_txn_type, p_description text, p_reference uuid default null
) returns bigint language plpgsql security definer set search_path = public as $$
declare new_balance bigint;
begin
  insert into public.wallets (user_id) values (p_user) on conflict do nothing;
  update public.wallets set balance_paise = balance_paise + p_amount, updated_at = now()
    where user_id = p_user
    returning balance_paise into new_balance;
  if new_balance < 0 then
    raise exception 'insufficient wallet balance' using errcode = 'P0001';
  end if;
  insert into public.wallet_transactions (user_id, amount_paise, type, description, reference_id, balance_after_paise)
  values (p_user, p_amount, p_type, p_description, p_reference, new_balance);
  return new_balance;
end $$;
revoke execute on function public.wallet_apply(uuid, bigint, public.wallet_txn_type, text, uuid) from public, anon, authenticated;
grant execute on function public.wallet_apply(uuid, bigint, public.wallet_txn_type, text, uuid) to service_role;

-- Keep restaurant / rider ratings in sync with reviews.
create or replace function public.refresh_ratings() returns trigger
language plpgsql security definer set search_path = public as $$
declare rid uuid := coalesce(new.restaurant_id, old.restaurant_id);
declare rdr uuid := coalesce(new.rider_id, old.rider_id);
begin
  update public.restaurants r set
    rating_delivery = coalesce((select round(avg(food_rating)::numeric, 1) from public.reviews where restaurant_id = rid and kind = 'delivery'), 0),
    rating_count = (select count(*) from public.reviews where restaurant_id = rid and kind = 'delivery'),
    rating_dining = coalesce((select round(avg(food_rating)::numeric, 1) from public.reviews where restaurant_id = rid and kind = 'dining'), r.rating_dining),
    dining_rating_count = (select count(*) from public.reviews where restaurant_id = rid and kind = 'dining')
  where r.id = rid;
  if rdr is not null then
    update public.riders set
      rating = coalesce((select round(avg(delivery_rating)::numeric, 1) from public.reviews where rider_id = rdr and delivery_rating is not null), rating),
      rating_count = (select count(*) from public.reviews where rider_id = rdr and delivery_rating is not null)
    where id = rdr;
  end if;
  return null;
end $$;
create trigger reviews_refresh_ratings after insert or update or delete on public.reviews
  for each row execute function public.refresh_ratings();

-- Fuzzy search (pg_trgm). Security invoker: RLS still applies.
create or replace function public.search_restaurants(q text, lim int default 20)
returns setof public.restaurants language sql stable set search_path = public, extensions as $$
  select r.* from public.restaurants r
  where r.name ilike '%' || q || '%'
     or word_similarity(q, r.name) > 0.35
     or exists (select 1 from unnest(r.cuisines) c where c ilike '%' || q || '%' or word_similarity(q, c) > 0.45)
  order by greatest(word_similarity(q, r.name), (select coalesce(max(word_similarity(q, c)), 0) from unnest(r.cuisines) c)) desc,
           r.rating_delivery desc
  limit lim
$$;

create or replace function public.search_dishes(q text, lim int default 40)
returns setof public.menu_items language sql stable set search_path = public, extensions as $$
  select m.* from public.menu_items m
  where not m.is_deleted
    and (m.name ilike '%' || q || '%' or word_similarity(q, m.name) > 0.4)
  order by word_similarity(q, m.name) desc, m.bestseller desc, m.rating desc nulls last
  limit lim
$$;

-- Nearest free, online, approved rider within max_km. Real riders win ties over simulated ones.
create or replace function public.find_nearest_rider(p_lat double precision, p_lng double precision, max_km double precision, exclude uuid[] default '{}')
returns uuid language sql stable security definer set search_path = public as $$
  select r.id from public.riders r
  where r.status = 'approved' and r.is_online and r.current_order_id is null
    and r.current_lat is not null and not (r.id = any (exclude))
    and public.haversine_km(p_lat, p_lng, r.current_lat, r.current_lng) <= max_km
    and not exists (select 1 from public.rider_offers o where o.rider_id = r.id and o.status = 'pending' and o.expires_at > now())
  order by r.is_simulated, public.haversine_km(p_lat, p_lng, r.current_lat, r.current_lng)
  limit 1
$$;
revoke execute on function public.find_nearest_rider(double precision, double precision, double precision, uuid[]) from public, anon, authenticated;
grant execute on function public.find_nearest_rider(double precision, double precision, double precision, uuid[]) to service_role;

-- Restaurants within a radius (bounding box first, then exact distance).
create or replace function public.restaurants_near(p_lat double precision, p_lng double precision, radius_km double precision)
returns table (restaurant_id uuid, distance_km double precision) language sql stable set search_path = public as $$
  select r.id, public.haversine_km(p_lat, p_lng, r.lat, r.lng)
  from public.restaurants r
  where r.lat between p_lat - radius_km / 111.0 and p_lat + radius_km / 111.0
    and r.lng between p_lng - radius_km / (111.0 * cos(radians(p_lat))) and p_lng + radius_km / (111.0 * cos(radians(p_lat)))
    and public.haversine_km(p_lat, p_lng, r.lat, r.lng) <= radius_km
  order by 2
$$;
