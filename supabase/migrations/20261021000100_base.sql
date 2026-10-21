-- Base: extensions, enums, shared helpers.
create extension if not exists pg_trgm with schema extensions;
create extension if not exists pgcrypto with schema extensions;

create type public.user_role as enum ('customer', 'restaurant_owner', 'restaurant_staff', 'rider', 'admin');
create type public.approval_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.dietary_preference as enum ('none', 'veg', 'vegan', 'eggetarian', 'non_veg');
create type public.healthy_score as enum ('low', 'medium', 'high', 'super');
create type public.vehicle_type as enum ('bicycle', 'scooter', 'motorcycle', 'ev_scooter');
create type public.order_status as enum (
  'PENDING_PAYMENT', 'SCHEDULED', 'PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'RIDER_ASSIGNED',
  'PICKED_UP', 'OUT_FOR_DELIVERY', 'DELIVERED', 'REJECTED', 'CANCELLED_BY_CUSTOMER', 'CANCELLED', 'FAILED_PAYMENT'
);
create type public.payment_method as enum ('razorpay', 'cod', 'wallet');
create type public.payment_status as enum ('pending', 'paid', 'failed', 'refunded', 'partially_refunded', 'cod_pending', 'cod_collected');
create type public.order_source as enum ('app', 'group', 'food_rescue', 'healthy_subscription', 'reorder', 'demo');
create type public.discount_type as enum ('percent', 'flat', 'free_delivery', 'bogo', 'free_item');
create type public.wallet_txn_type as enum (
  'topup', 'order_payment', 'refund', 'referral_bonus', 'admin_credit', 'cashback', 'gold_purchase',
  'event_ticket', 'dining_bill', 'ad_budget', 'adjustment'
);
create type public.offer_status as enum ('pending', 'accepted', 'rejected', 'expired');
create type public.booking_status as enum ('pending', 'confirmed', 'declined', 'cancelled', 'completed');
create type public.ticket_status as enum ('open', 'pending', 'resolved');

-- Keeps updated_at current.
create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Great-circle distance in km between two points.
create or replace function public.haversine_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable parallel safe as $$
  select 2 * 6371 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ))
$$;

-- Short, human-friendly random code (no ambiguous characters).
create or replace function public.random_code(len int) returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, len)
$$;
