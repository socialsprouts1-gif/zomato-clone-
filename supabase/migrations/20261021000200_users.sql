-- People: profiles, addresses, money, engagement.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.user_role not null default 'customer',
  name text,
  email text,
  phone text,
  avatar_url text,
  dietary_preference public.dietary_preference not null default 'none',
  veg_mode boolean not null default false,
  healthy_mode boolean not null default false,
  language text not null default 'en' check (language in ('en', 'hi')),
  notification_prefs jsonb not null default '{"order_updates": true, "offers": true, "push": false}',
  referral_code text unique,
  referred_by uuid references public.profiles (id) on delete set null,
  is_blocked boolean not null default false,
  last_lat double precision,
  last_lng double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index on public.profiles (role);
create index on public.profiles (referred_by);
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null default 'Home' check (label in ('Home', 'Work', 'Other')),
  custom_label text,
  line1 text not null,
  flat text,
  landmark text,
  area text,
  city text not null default 'Pune',
  pincode text,
  lat double precision not null,
  lng double precision not null,
  instructions text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.addresses (user_id);

create table public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance_paise bigint not null default 0 check (balance_paise >= 0),
  updated_at timestamptz not null default now()
);

create table public.wallet_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  amount_paise bigint not null,
  type public.wallet_txn_type not null,
  description text not null,
  reference_id uuid,
  balance_after_paise bigint not null,
  created_at timestamptz not null default now()
);
create index on public.wallet_transactions (user_id, created_at desc);

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles (id) on delete cascade,
  referee_id uuid not null unique references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'rewarded')),
  reward_paise int not null default 10000,
  rewarded_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.referrals (referrer_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type text not null default 'info',
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index on public.notifications (user_id, created_at desc);

create table public.search_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  query text not null,
  created_at timestamptz not null default now()
);
create index on public.search_history (user_id, created_at desc);
create index search_history_query_trgm on public.search_history using gin (query extensions.gin_trgm_ops);

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on public.admin_audit_log (created_at desc);
create index on public.admin_audit_log (admin_id);
