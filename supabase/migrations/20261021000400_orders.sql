-- Riders, carts, coupons, orders and everything hanging off an order.
create table public.riders (
  id uuid primary key references public.profiles (id) on delete cascade,
  name text not null,
  phone text,
  photo_url text,
  vehicle_type public.vehicle_type not null default 'scooter',
  vehicle_number text,
  status public.approval_status not null default 'pending',
  is_online boolean not null default false,
  is_simulated boolean not null default false,
  current_lat double precision,
  current_lng double precision,
  last_seen_at timestamptz,
  current_order_id uuid,
  rating numeric(2, 1) not null default 4.8,
  rating_count int not null default 0,
  floating_cash_paise bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.riders (status, is_online);
create index riders_geo_idx on public.riders (current_lat, current_lng);
create trigger riders_touch before update on public.riders for each row execute function public.touch_updated_at();

create table public.rider_private (
  rider_id uuid primary key references public.riders (id) on delete cascade,
  bank_account_name text,
  bank_account_number_masked text,
  bank_ifsc text,
  driving_license_url text,
  vehicle_rc_url text,
  updated_at timestamptz not null default now()
);

create table public.carts (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  is_group boolean not null default true,
  share_code text not null unique default public.random_code(8),
  status text not null default 'open' check (status in ('open', 'locked', 'checked_out', 'cancelled')),
  order_id uuid,
  created_at timestamptz not null default now()
);
create index on public.carts (host_id);
create index on public.carts (restaurant_id);

create table public.cart_members (
  cart_id uuid not null references public.carts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (cart_id, user_id)
);
create index on public.cart_members (user_id);

create table public.cart_items (
  id uuid primary key default gen_random_uuid(),
  cart_id uuid not null references public.carts (id) on delete cascade,
  menu_item_id uuid not null references public.menu_items (id) on delete cascade,
  variant_id uuid references public.item_variants (id) on delete set null,
  addon_ids uuid[] not null default '{}',
  quantity int not null default 1 check (quantity between 1 and 50),
  added_by uuid not null references public.profiles (id) on delete cascade,
  added_by_name text not null,
  created_at timestamptz not null default now()
);
create index on public.cart_items (cart_id);
create index on public.cart_items (menu_item_id);
create index on public.cart_items (added_by);

create table public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text not null,
  description text,
  discount_type public.discount_type not null,
  discount_value int not null default 0,
  max_discount_paise int,
  min_order_paise int not null default 0,
  first_order_only boolean not null default false,
  gold_only boolean not null default false,
  payment_method text check (payment_method in ('upi', 'card', 'netbanking', 'wallet', 'cod')),
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  per_user_limit int not null default 1,
  total_limit int,
  used_count int not null default 0,
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.coupons (restaurant_id);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number bigint generated always as identity (start with 104201) unique,
  customer_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete restrict,
  rider_id uuid references public.riders (id) on delete set null,
  address_id uuid references public.addresses (id) on delete set null,
  status public.order_status not null default 'PENDING_PAYMENT',
  source public.order_source not null default 'app',
  -- snapshots so history stays correct if the source rows change
  customer_name text,
  customer_phone text,
  delivery_address jsonb not null, -- {label, line1, flat, landmark, area, lat, lng}
  delivery_instructions jsonb not null default '{}', -- {avoid_calling, leave_at_door, directions}
  cooking_instructions text,
  no_cutlery boolean not null default false,
  distance_km numeric(6, 2),
  eta_minutes int,
  prep_minutes int,
  scheduled_for timestamptz,
  -- bill (all paise, computed server-side)
  item_total_paise int not null default 0,
  delivery_fee_paise int not null default 0,
  platform_fee_paise int not null default 0,
  packaging_fee_paise int not null default 0,
  gst_paise int not null default 0,
  tip_paise int not null default 0,
  discount_paise int not null default 0,
  donation_paise int not null default 0,
  total_paise int not null default 0,      -- grand total
  wallet_used_paise int not null default 0,
  payable_paise int not null default 0,    -- total minus wallet
  gold_savings_paise int not null default 0,
  coupon_id uuid references public.coupons (id) on delete set null,
  restaurant_offer_id uuid references public.restaurant_offers (id) on delete set null,
  coupon_code text,
  -- payment
  payment_method public.payment_method not null default 'razorpay',
  payment_method_detail text, -- upi, card, netbanking, wallet
  payment_status public.payment_status not null default 'pending',
  razorpay_order_id text unique,
  razorpay_payment_id text,
  refund_paise int not null default 0,
  refund_to text check (refund_to in ('wallet', 'original')),
  refunded_at timestamptz,
  -- lifecycle
  delivery_otp text not null default lpad((floor(random() * 10000))::int::text, 4, '0'),
  placed_at timestamptz,
  accepted_at timestamptz,
  ready_at timestamptz,
  rider_assigned_at timestamptz,
  rider_at_restaurant_at timestamptz,
  picked_up_at timestamptz,
  out_for_delivery_at timestamptz,
  delivered_at timestamptz,
  cancelled_at timestamptz,
  cancel_reason text,
  reject_reason text,
  -- relations
  group_cart_id uuid references public.carts (id) on delete set null,
  rescued_from_order_id uuid references public.orders (id) on delete set null,
  healthy_subscription_id uuid,
  hidden_by_customer boolean not null default false,
  is_gold_order boolean not null default false,
  is_demo boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.orders (customer_id, created_at desc);
create index on public.orders (restaurant_id, created_at desc);
create index on public.orders (rider_id);
create index on public.orders (status);
create index on public.orders (scheduled_for) where status = 'SCHEDULED';
create index on public.orders (address_id);
create index on public.orders (coupon_id);
create index on public.orders (restaurant_offer_id);
create index on public.orders (group_cart_id);
create index on public.orders (rescued_from_order_id);
create index on public.orders (healthy_subscription_id);
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

alter table public.carts add constraint carts_order_fk foreign key (order_id) references public.orders (id) on delete set null;
create index on public.carts (order_id);
alter table public.riders add constraint riders_current_order_fk foreign key (current_order_id) references public.orders (id) on delete set null;
create index on public.riders (current_order_id);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  name text not null,
  variant_name text,
  addons jsonb not null default '[]', -- [{name, price_paise}]
  quantity int not null check (quantity > 0),
  unit_price_paise int not null,
  total_paise int not null,
  is_veg boolean not null default true,
  added_by_name text,
  created_at timestamptz not null default now()
);
create index on public.order_items (order_id);
create index on public.order_items (menu_item_id);

create table public.order_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id uuid references public.profiles (id) on delete set null,
  actor_role text not null check (actor_role in ('customer', 'restaurant', 'rider', 'admin', 'system')),
  note text,
  created_at timestamptz not null default now()
);
create index on public.order_events (order_id, created_at);
create index on public.order_events (actor_id);

create table public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid references public.coupons (id) on delete set null,
  restaurant_offer_id uuid references public.restaurant_offers (id) on delete set null,
  order_id uuid not null references public.orders (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  discount_paise int not null,
  created_at timestamptz not null default now()
);
create index on public.coupon_redemptions (coupon_id);
create index on public.coupon_redemptions (restaurant_offer_id);
create index on public.coupon_redemptions (order_id);
create index on public.coupon_redemptions (user_id);

create table public.rider_offers (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  rider_id uuid not null references public.riders (id) on delete cascade,
  status public.offer_status not null default 'pending',
  restaurant_name text not null,
  restaurant_locality text,
  pickup_km numeric(6, 2) not null,
  drop_km numeric(6, 2) not null,
  estimated_earning_paise int not null,
  expires_at timestamptz not null,
  responded_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.rider_offers (rider_id, status);
create index on public.rider_offers (order_id);

create table public.rider_locations (
  id bigint generated always as identity primary key,
  rider_id uuid not null references public.riders (id) on delete cascade,
  order_id uuid references public.orders (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  heading double precision,
  created_at timestamptz not null default now()
);
create index on public.rider_locations (order_id, created_at desc);
create index on public.rider_locations (rider_id, created_at desc);

create table public.rider_earnings (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  kind text not null default 'delivery' check (kind in ('delivery', 'incentive', 'adjustment')),
  base_pay_paise int not null default 0,
  distance_pay_paise int not null default 0,
  tip_paise int not null default 0,
  incentive_paise int not null default 0,
  total_paise int not null,
  note text,
  created_at timestamptz not null default now()
);
create index on public.rider_earnings (rider_id, created_at desc);
create index on public.rider_earnings (order_id);

create table public.rider_cash_deposits (
  id uuid primary key default gen_random_uuid(),
  rider_id uuid not null references public.riders (id) on delete cascade,
  amount_paise bigint not null check (amount_paise > 0),
  reference text not null,
  created_at timestamptz not null default now()
);
create index on public.rider_cash_deposits (rider_id);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  thread text not null check (thread in ('customer_rider', 'customer_restaurant', 'rider_restaurant')),
  sender_id uuid references public.profiles (id) on delete set null,
  sender_role text not null check (sender_role in ('customer', 'rider', 'restaurant', 'system')),
  sender_name text,
  body text not null check (length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index on public.chat_messages (order_id, thread, created_at);
create index on public.chat_messages (sender_id);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'delivery' check (kind in ('delivery', 'dining')),
  order_id uuid unique references public.orders (id) on delete set null,
  customer_id uuid references public.profiles (id) on delete set null,
  customer_name text,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  rider_id uuid references public.riders (id) on delete set null,
  food_rating int not null check (food_rating between 1 and 5),
  delivery_rating int check (delivery_rating between 1 and 5),
  food_tags text[] not null default '{}',
  delivery_tags text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now()
);
create index on public.reviews (restaurant_id, created_at desc);
create index on public.reviews (customer_id);
create index on public.reviews (rider_id);

create table public.review_photos (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  url text not null,
  created_at timestamptz not null default now()
);
create index on public.review_photos (review_id);

create table public.review_replies (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null unique references public.reviews (id) on delete cascade,
  author_id uuid references public.profiles (id) on delete set null,
  body text not null,
  created_at timestamptz not null default now()
);
create index on public.review_replies (author_id);

create table public.food_rescue_listings (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null unique references public.orders (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  lat double precision not null,
  lng double precision not null,
  items_summary text not null,
  is_veg boolean not null default true,
  original_price_paise int not null,
  rescue_price_paise int not null,
  status text not null default 'available' check (status in ('available', 'claimed', 'expired')),
  expires_at timestamptz not null,
  claimed_by uuid references public.profiles (id) on delete set null,
  claimed_order_id uuid references public.orders (id) on delete set null,
  claimed_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.food_rescue_listings (status, expires_at);
create index on public.food_rescue_listings (restaurant_id);
create index on public.food_rescue_listings (claimed_by);
create index on public.food_rescue_listings (claimed_order_id);

create table public.payouts (
  id uuid primary key default gen_random_uuid(),
  payee_type text not null check (payee_type in ('restaurant', 'rider')),
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  rider_id uuid references public.riders (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  order_count int not null default 0,
  gross_paise bigint not null default 0,
  commission_paise bigint not null default 0,
  gst_on_commission_paise bigint not null default 0,
  food_rescue_paise bigint not null default 0,
  adjustments_paise bigint not null default 0,
  net_paise bigint not null default 0,
  status text not null default 'generated' check (status in ('generated', 'paid')),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check ((payee_type = 'restaurant' and restaurant_id is not null) or (payee_type = 'rider' and rider_id is not null))
);
create unique index payouts_restaurant_period on public.payouts (restaurant_id, period_start) where payee_type = 'restaurant';
create unique index payouts_rider_period on public.payouts (rider_id, period_start) where payee_type = 'rider';

create table public.donations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  order_id uuid references public.orders (id) on delete set null,
  amount_paise int not null check (amount_paise > 0),
  created_at timestamptz not null default now()
);
create index on public.donations (user_id);
create index on public.donations (order_id);
