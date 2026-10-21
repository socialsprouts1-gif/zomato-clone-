-- Platform-level features: banners, Gold, healthy plans, dining, events, support, zones & fees.
create table public.banners (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  image_url text,
  cta_label text,
  link_url text not null default '/',
  theme text not null default 'saffron', -- colour theme for the card
  sort int not null default 0,
  is_active boolean not null default true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.gold_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  duration_months int not null check (duration_months > 0),
  price_paise int not null check (price_paise > 0),
  original_price_paise int,
  is_active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.gold_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  plan_id uuid not null references public.gold_plans (id) on delete restrict,
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  status text not null default 'active' check (status in ('pending', 'active', 'expired', 'cancelled')),
  amount_paid_paise int not null,
  payment_method public.payment_method not null default 'razorpay',
  razorpay_order_id text unique,
  razorpay_payment_id text,
  created_at timestamptz not null default now()
);
create index on public.gold_memberships (user_id, ends_at desc);
create index on public.gold_memberships (plan_id);

create table public.healthy_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  address_id uuid references public.addresses (id) on delete set null,
  plan_days int not null check (plan_days in (5, 10)),
  slot text not null check (slot in ('lunch', 'dinner')),
  start_date date not null,
  menu_item_ids uuid[] not null,
  price_paise int not null,
  status text not null default 'active' check (status in ('pending', 'active', 'completed', 'cancelled')),
  payment_method public.payment_method not null default 'razorpay',
  razorpay_order_id text unique,
  created_at timestamptz not null default now()
);
create index on public.healthy_subscriptions (user_id);
create index on public.healthy_subscriptions (restaurant_id);
create index on public.healthy_subscriptions (address_id);
alter table public.orders add constraint orders_healthy_sub_fk foreign key (healthy_subscription_id) references public.healthy_subscriptions (id) on delete set null;

create table public.table_bookings (
  id uuid primary key default gen_random_uuid(),
  booking_code text not null unique default ('TB' || public.random_code(6)),
  user_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  table_id uuid references public.restaurant_tables (id) on delete set null,
  offer_id uuid references public.restaurant_offers (id) on delete set null,
  booking_date date not null,
  time_slot time not null,
  guests int not null check (guests between 1 and 20),
  status public.booking_status not null default 'pending',
  special_request text,
  customer_name text,
  customer_phone text,
  decline_reason text,
  created_at timestamptz not null default now()
);
create index on public.table_bookings (restaurant_id, booking_date);
create index on public.table_bookings (user_id);
create index on public.table_bookings (table_id);
create index on public.table_bookings (offer_id);

create table public.dining_payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  booking_id uuid references public.table_bookings (id) on delete set null,
  bill_paise int not null check (bill_paise > 0),
  offer_discount_paise int not null default 0,
  gold_discount_paise int not null default 0,
  paid_paise int not null,
  payment_method public.payment_method not null default 'razorpay',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  razorpay_order_id text unique,
  created_at timestamptz not null default now()
);
create index on public.dining_payments (user_id);
create index on public.dining_payments (restaurant_id);
create index on public.dining_payments (booking_id);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  description text,
  category text not null default 'Concert',
  venue text not null,
  city text not null default 'Pune',
  starts_at timestamptz not null,
  image_url text,
  tiers jsonb not null default '[]', -- [{id, name, price_paise, capacity}]
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.event_tickets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  tier_id text not null,
  tier_name text not null,
  quantity int not null check (quantity between 1 and 10),
  amount_paise int not null,
  ticket_code text not null unique default ('EV' || public.random_code(8)),
  status text not null default 'pending' check (status in ('pending', 'confirmed', 'cancelled', 'used')),
  payment_method public.payment_method not null default 'razorpay',
  razorpay_order_id text unique,
  created_at timestamptz not null default now()
);
create index on public.event_tickets (event_id);
create index on public.event_tickets (user_id);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  order_id uuid references public.orders (id) on delete set null,
  subject text not null,
  category text not null default 'order' check (category in ('order', 'payment', 'account', 'rider', 'restaurant', 'other')),
  status public.ticket_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.support_tickets (user_id);
create index on public.support_tickets (order_id);
create index on public.support_tickets (status, updated_at desc);
create trigger support_tickets_touch before update on public.support_tickets for each row execute function public.touch_updated_at();

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  sender_id uuid references public.profiles (id) on delete set null,
  sender_role text not null check (sender_role in ('customer', 'agent', 'bot')),
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on public.support_messages (ticket_id, created_at);
create index on public.support_messages (sender_id);

create table public.delivery_zones (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_km numeric(5, 2) not null default 8,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.fee_slabs (
  id uuid primary key default gen_random_uuid(),
  min_km numeric(5, 2) not null,
  max_km numeric(5, 2) not null,
  fee_paise int not null check (fee_paise >= 0),
  check (max_km > min_km)
);

-- Single-row platform configuration.
create table public.platform_settings (
  id boolean primary key default true check (id),
  platform_fee_paise int not null default 1000,
  gst_pct numeric(4, 2) not null default 5.00,
  gst_on_commission_pct numeric(4, 2) not null default 18.00,
  default_commission_pct numeric(5, 2) not null default 20.00,
  max_delivery_km numeric(5, 2) not null default 10,
  rider_search_km numeric(5, 2) not null default 5,
  gold_free_delivery_min_paise int not null default 19900,
  gold_extra_discount_pct numeric(4, 2) not null default 10.00,
  gold_dining_discount_pct numeric(4, 2) not null default 15.00,
  surge_rain boolean not null default false,
  surge_late_night boolean not null default false,
  surge_fee_paise int not null default 2500,
  rider_base_pay_paise int not null default 2500,
  rider_per_km_paise int not null default 600,
  rider_daily_target_orders int not null default 10,
  rider_daily_target_bonus_paise int not null default 15000,
  referral_reward_paise int not null default 10000,
  food_rescue_discount_pct int not null default 50,
  food_rescue_minutes int not null default 15,
  food_rescue_radius_km numeric(5, 2) not null default 3,
  updated_at timestamptz not null default now()
);
insert into public.platform_settings default values;
