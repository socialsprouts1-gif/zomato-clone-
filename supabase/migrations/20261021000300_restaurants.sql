-- Restaurants, menus, dine-in tables, offers and ads.
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete set null,
  name text not null,
  slug text not null unique,
  description text,
  cuisines text[] not null default '{}',
  tags text[] not null default '{}',
  locality text not null,
  address text not null,
  city text not null default 'Pune',
  lat double precision not null,
  lng double precision not null,
  phone text,
  cover_image_url text,
  logo_url text,
  cost_for_two_paise int not null default 40000,
  is_pure_veg boolean not null default false,
  is_online boolean not null default true,
  busy_until timestamptz,
  holidays date[] not null default '{}',
  auto_accept boolean not null default false,
  status public.approval_status not null default 'pending',
  commission_pct numeric(5, 2) not null default 20.00,
  rating_delivery numeric(2, 1) not null default 0,
  rating_dining numeric(2, 1) not null default 0,
  rating_count int not null default 0,
  dining_rating_count int not null default 0,
  avg_prep_minutes int not null default 20,
  packaging_charge_paise int not null default 2000,
  fssai text,
  opening_hours jsonb not null default '{"mon":[["10:00","23:00"]],"tue":[["10:00","23:00"]],"wed":[["10:00","23:00"]],"thu":[["10:00","23:00"]],"fri":[["10:00","23:30"]],"sat":[["10:00","23:30"]],"sun":[["10:00","23:00"]]}',
  gold_partner boolean not null default false,
  dining_enabled boolean not null default false,
  outdoor_seating boolean not null default false,
  serves_alcohol boolean not null default false,
  is_healthy_partner boolean not null default false,
  is_featured boolean not null default false,
  sponsored_until timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.restaurants (owner_id);
create index on public.restaurants (status);
create index restaurants_geo_idx on public.restaurants (lat, lng);
create index restaurants_name_trgm on public.restaurants using gin (name extensions.gin_trgm_ops);
create index restaurants_cuisines_idx on public.restaurants using gin (cuisines);
create trigger restaurants_touch before update on public.restaurants for each row execute function public.touch_updated_at();

-- Sensitive onboarding details, readable only by the restaurant team and admins.
create table public.restaurant_private (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  gst_number text,
  pan_number text,
  bank_account_name text,
  bank_account_number_masked text,
  bank_ifsc text,
  owner_name text,
  owner_phone text,
  owner_email text,
  updated_at timestamptz not null default now()
);

create table public.restaurant_staff (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete cascade,
  email text not null,
  role text not null check (role in ('manager', 'order_taker')),
  status text not null default 'invited' check (status in ('invited', 'active', 'removed')),
  created_at timestamptz not null default now(),
  unique (restaurant_id, email)
);
create index on public.restaurant_staff (user_id);
create index on public.restaurant_staff (lower(email));

create table public.restaurant_photos (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  url text not null,
  caption text,
  kind text not null default 'food' check (kind in ('food', 'ambience', 'menu')),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.restaurant_photos (restaurant_id, sort);

create table public.menu_categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  parent_id uuid references public.menu_categories (id) on delete cascade,
  name text not null,
  description text,
  sort int not null default 0,
  available_from time,
  available_to time,
  available_days int[] not null default '{0,1,2,3,4,5,6}', -- 0 = Sunday
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.menu_categories (restaurant_id, sort);
create index on public.menu_categories (parent_id);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid not null references public.menu_categories (id) on delete cascade,
  name text not null,
  description text,
  price_paise int not null check (price_paise >= 0),
  is_veg boolean not null default true,
  contains_egg boolean not null default false,
  image_url text,
  in_stock boolean not null default true,
  stock_qty int,
  low_stock_threshold int not null default 5,
  bestseller boolean not null default false,
  tags text[] not null default '{}',
  rating numeric(2, 1),
  rating_count int not null default 0,
  calories int,
  protein_g numeric(5, 1),
  carbs_g numeric(5, 1),
  fat_g numeric(5, 1),
  grams int,
  healthy_score public.healthy_score,
  is_temperature_sensitive boolean not null default false,
  variant_group_name text,
  sort int not null default 0,
  is_deleted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.menu_items (restaurant_id);
create index on public.menu_items (category_id, sort);
create index menu_items_name_trgm on public.menu_items using gin (name extensions.gin_trgm_ops);
create trigger menu_items_touch before update on public.menu_items for each row execute function public.touch_updated_at();

-- Auto out-of-stock at zero; back in stock when restocked.
create or replace function public.menu_items_stock_guard() returns trigger language plpgsql as $$
begin
  if new.stock_qty is not null then
    if new.stock_qty <= 0 then
      new.stock_qty := 0;
      new.in_stock := false;
    elsif tg_op = 'UPDATE' and old.stock_qty is not null and old.stock_qty <= 0 and new.stock_qty > 0 then
      new.in_stock := true;
    end if;
  end if;
  return new;
end $$;
create trigger menu_items_stock before insert or update of stock_qty on public.menu_items
  for each row execute function public.menu_items_stock_guard();

create table public.item_variants (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.menu_items (id) on delete cascade,
  name text not null,
  price_paise int not null check (price_paise >= 0), -- full price of the item in this variant
  is_default boolean not null default false,
  in_stock boolean not null default true,
  sort int not null default 0
);
create index on public.item_variants (item_id, sort);

create table public.addon_groups (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.menu_items (id) on delete cascade,
  name text not null,
  min_select int not null default 0,
  max_select int not null default 1,
  sort int not null default 0,
  check (min_select >= 0 and max_select >= greatest(min_select, 1))
);
create index on public.addon_groups (item_id, sort);

create table public.addons (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.addon_groups (id) on delete cascade,
  name text not null,
  price_paise int not null default 0 check (price_paise >= 0),
  is_veg boolean not null default true,
  in_stock boolean not null default true,
  sort int not null default 0
);
create index on public.addons (group_id, sort);

create table public.restaurant_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  label text not null,
  section text not null default 'Main',
  seats int not null default 4 check (seats > 0),
  qr_token text not null unique default public.random_code(10),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, label)
);

create table public.restaurant_offers (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  title text not null,
  description text,
  code text not null,
  discount_type public.discount_type not null,
  discount_value int not null default 0, -- percent, or paise for flat
  max_discount_paise int,
  min_order_paise int not null default 0,
  bogo_item_id uuid references public.menu_items (id) on delete set null,
  free_item_id uuid references public.menu_items (id) on delete set null,
  target text not null default 'all' check (target in ('all', 'new_users', 'gold')),
  applies_to text not null default 'delivery' check (applies_to in ('delivery', 'dining', 'both')),
  valid_from timestamptz not null default now(),
  valid_until timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, code)
);
create index on public.restaurant_offers (restaurant_id);

create table public.ad_campaigns (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  daily_budget_paise int not null check (daily_budget_paise > 0),
  starts_on date not null default current_date,
  ends_on date,
  status text not null default 'active' check (status in ('active', 'paused', 'ended')),
  impressions int not null default 0,
  clicks int not null default 0,
  orders int not null default 0,
  spend_paise bigint not null default 0,
  created_at timestamptz not null default now()
);
create index on public.ad_campaigns (restaurant_id);

-- Funnel tracking for partner reports (menu views -> add to cart -> orders).
create table public.analytics_events (
  id bigint generated always as identity primary key,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  event text not null check (event in ('menu_view', 'add_to_cart', 'checkout_start', 'order_placed', 'ad_impression', 'ad_click')),
  created_at timestamptz not null default now()
);
create index on public.analytics_events (restaurant_id, created_at);
create index on public.analytics_events (user_id);

create table public.favourites (
  user_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);
create index on public.favourites (restaurant_id);

create table public.recently_viewed (
  user_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, restaurant_id)
);
create index on public.recently_viewed (user_id, viewed_at desc);
create index on public.recently_viewed (restaurant_id);

create table public.collections (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  image_url text,
  slug text unique,
  is_curated boolean not null default false,
  is_public boolean not null default false,
  share_code text unique default public.random_code(8),
  sort int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.collections (owner_id);

create table public.collection_items (
  collection_id uuid not null references public.collections (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  sort int not null default 0,
  created_at timestamptz not null default now(),
  primary key (collection_id, restaurant_id)
);
create index on public.collection_items (restaurant_id);
