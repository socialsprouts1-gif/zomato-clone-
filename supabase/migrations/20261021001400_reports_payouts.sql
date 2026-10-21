-- Partner business reports + weekly restaurant payouts.
-- All periods are calendar dates in Asia/Kolkata; ranges are inclusive of both ends.

create index if not exists orders_restaurant_delivered_idx on public.orders (restaurant_id, delivered_at) where status = 'DELIVERED';
create index if not exists rescue_restaurant_claimed_idx on public.food_rescue_listings (restaurant_id, claimed_at) where status = 'claimed';
create index if not exists payouts_restaurant_period_desc on public.payouts (restaurant_id, period_start desc);

-- [start 00:00 IST, end+1 00:00 IST)
create or replace function public.ist_window(p_start date, p_end date, out from_ts timestamptz, out to_ts timestamptz)
language sql immutable as $$
  select (p_start::timestamp at time zone 'Asia/Kolkata'), ((p_end + 1)::timestamp at time zone 'Asia/Kolkata')
$$;

-- ---------------------------------------------------------------------------------------------
-- Business report for one outlet. Definitions (kept in sync with src/lib/partner/reports.ts):
--   placed orders  = orders created in range whose payment went through (not PENDING_PAYMENT / FAILED_PAYMENT)
--   gross sales    = item total (food value, before discounts, excl. packaging/taxes/fees) of DELIVERED orders
--   AOV            = gross sales / delivered orders
--   rejected       = REJECTED; cancelled = CANCELLED + CANCELLED_BY_CUSTOMER; rejection rate = rejected / placed
-- ---------------------------------------------------------------------------------------------
create or replace function public.partner_report(rid uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  w record;
  result jsonb;
begin
  if not (public.is_restaurant_member(rid) or public.is_admin() or public.is_service_context()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_to < p_from or p_to - p_from > 366 then
    raise exception 'invalid range' using errcode = '22023';
  end if;
  select * into w from public.ist_window(p_from, p_to);

  with o as (
    select id, status, item_total_paise, created_at, (created_at at time zone 'Asia/Kolkata') as local_ts
    from public.orders
    where restaurant_id = rid and created_at >= w.from_ts and created_at < w.to_ts
      and status not in ('PENDING_PAYMENT', 'FAILED_PAYMENT')
  ),
  kpi as (
    select count(*) as placed,
      count(*) filter (where status = 'DELIVERED') as delivered,
      coalesce(sum(item_total_paise) filter (where status = 'DELIVERED'), 0) as gross,
      count(*) filter (where status = 'REJECTED') as rejected,
      count(*) filter (where status in ('CANCELLED', 'CANCELLED_BY_CUSTOMER')) as cancelled
    from o
  ),
  days as (
    select d::date as day from generate_series(p_from::timestamp, p_to::timestamp, interval '1 day') d
  ),
  daily as (
    select days.day,
      coalesce(sum(o.item_total_paise) filter (where o.status = 'DELIVERED'), 0) as sales,
      count(o.id) as orders,
      count(o.id) filter (where o.status = 'DELIVERED') as delivered
    from days left join o on o.local_ts::date = days.day
    group by days.day order by days.day
  ),
  ev as (
    select event, count(*) as n from public.analytics_events
    where restaurant_id = rid and created_at >= w.from_ts and created_at < w.to_ts
      and event in ('menu_view', 'add_to_cart', 'checkout_start')
    group by event
  ),
  dishes as (
    select oi.name, sum(oi.quantity) as qty, sum(oi.total_paise) as revenue
    from o join public.order_items oi on oi.order_id = o.id
    where o.status = 'DELIVERED'
    group by oi.name
  ),
  heat as (
    select (extract(isodow from local_ts)::int - 1) as dow, extract(hour from local_ts)::int as hour, count(*) as n
    from o group by 1, 2
  )
  select jsonb_build_object(
    'kpis', (select jsonb_build_object(
      'placed', placed, 'delivered', delivered, 'gross_paise', gross,
      'aov_paise', case when delivered > 0 then round(gross::numeric / delivered)::bigint else 0 end,
      'rejected', rejected, 'cancelled', cancelled,
      'rejection_rate', case when placed > 0 then round(rejected::numeric * 100 / placed, 1) else 0 end
    ) from kpi),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'sales_paise', sales, 'orders', orders, 'delivered', delivered) order by day) from daily), '[]'),
    'funnel', jsonb_build_object(
      'menu_view', coalesce((select n from ev where event = 'menu_view'), 0),
      'add_to_cart', coalesce((select n from ev where event = 'add_to_cart'), 0),
      'checkout_start', coalesce((select n from ev where event = 'checkout_start'), 0),
      'orders', (select placed from kpi)
    ),
    'top_by_qty', coalesce((select jsonb_agg(t) from (select name, qty, revenue as revenue_paise from dishes order by qty desc, revenue desc, name limit 8) t), '[]'),
    'top_by_revenue', coalesce((select jsonb_agg(t) from (select name, qty, revenue as revenue_paise from dishes order by revenue desc, qty desc, name limit 8) t), '[]'),
    'heatmap', coalesce((select jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'orders', n)) from heat), '[]')
  ) into result;
  return result;
end
$$;

-- ---------------------------------------------------------------------------------------------
-- Payout statement for one restaurant and period (computed live; generate_restaurant_payout stores it).
--   order value  = item total + packaging − restaurant-funded offer discount, for DELIVERED orders whose
--                  delivered_at falls in the period (Food Rescue resale orders are excluded here)
--   commission   = commission_pct % of order value;  GST = gst_on_commission_pct % of commission
--   food rescue  = rescue price of this restaurant's listings claimed in the period (commission-free)
--   net          = order value − commission − GST + food rescue + adjustments
-- ---------------------------------------------------------------------------------------------
create or replace function public.payout_statement(rid uuid, p_start date, p_end date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  w record;
  pct numeric;
  gst_pct numeric;
  result jsonb;
begin
  if not (public.is_restaurant_member(rid) or public.is_admin() or public.is_service_context()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into w from public.ist_window(p_start, p_end);
  select commission_pct into pct from public.restaurants where id = rid;
  if pct is null then raise exception 'restaurant not found' using errcode = 'P0002'; end if;
  select gst_on_commission_pct into gst_pct from public.platform_settings;

  with lines as (
    select o.id as order_id, o.order_number, o.delivered_at, o.item_total_paise::bigint as item_total_paise,
      o.packaging_fee_paise::bigint as packaging_paise,
      (case when o.restaurant_offer_id is not null then o.discount_paise else 0 end)::bigint as restaurant_discount_paise,
      (o.item_total_paise + o.packaging_fee_paise - case when o.restaurant_offer_id is not null then o.discount_paise else 0 end)::bigint as order_value_paise,
      o.payment_method::text as payment_method
    from public.orders o
    where o.restaurant_id = rid and o.status = 'DELIVERED' and o.source <> 'food_rescue'
      and o.delivered_at >= w.from_ts and o.delivered_at < w.to_ts
  ),
  rescue as (
    select f.id, f.items_summary, f.claimed_at, f.rescue_price_paise::bigint as rescue_price_paise
    from public.food_rescue_listings f
    where f.restaurant_id = rid and f.status = 'claimed' and f.claimed_at >= w.from_ts and f.claimed_at < w.to_ts
  ),
  totals as (
    select (select count(*) from lines)::int as cnt,
      (select coalesce(sum(order_value_paise), 0) from lines)::bigint as gross,
      (select coalesce(sum(rescue_price_paise), 0) from rescue)::bigint as rescue
  ),
  money as (
    select cnt, gross, rescue, round(gross * pct / 100)::bigint as commission from totals
  ),
  money2 as (
    select *, round(commission * gst_pct / 100)::bigint as gst from money
  )
  select jsonb_build_object(
    'restaurant_id', rid, 'period_start', p_start, 'period_end', p_end,
    'order_count', m.cnt, 'gross_paise', m.gross, 'commission_pct', pct, 'commission_paise', m.commission,
    'gst_pct', gst_pct, 'gst_on_commission_paise', m.gst, 'food_rescue_paise', m.rescue,
    'net_before_adjustments_paise', m.gross - m.commission - m.gst + m.rescue,
    'orders', coalesce((select jsonb_agg(to_jsonb(l) order by l.delivered_at, l.order_number) from lines l), '[]'),
    'rescue', coalesce((select jsonb_agg(to_jsonb(r) order by r.claimed_at) from rescue r), '[]')
  ) into result
  from money2 m;
  return result;
end
$$;

-- Idempotent: inserts the statement, or refreshes it while still 'generated' (adjustments are kept);
-- a 'paid' statement is never changed.
create or replace function public.generate_restaurant_payout(rid uuid, p_start date, p_end date) returns public.payouts
language plpgsql volatile security definer set search_path = public as $$
declare
  s jsonb;
  row public.payouts;
begin
  if not (public.is_admin() or public.is_service_context()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_end < p_start then raise exception 'invalid period' using errcode = '22023'; end if;
  s := public.payout_statement(rid, p_start, p_end);
  insert into public.payouts as p (payee_type, restaurant_id, period_start, period_end, order_count, gross_paise,
    commission_paise, gst_on_commission_paise, food_rescue_paise, adjustments_paise, net_paise)
  values ('restaurant', rid, p_start, p_end, (s->>'order_count')::int, (s->>'gross_paise')::bigint,
    (s->>'commission_paise')::bigint, (s->>'gst_on_commission_paise')::bigint, (s->>'food_rescue_paise')::bigint, 0,
    (s->>'net_before_adjustments_paise')::bigint)
  on conflict (restaurant_id, period_start) where payee_type = 'restaurant' do update set
    period_end = excluded.period_end, order_count = excluded.order_count, gross_paise = excluded.gross_paise,
    commission_paise = excluded.commission_paise, gst_on_commission_paise = excluded.gst_on_commission_paise,
    food_rescue_paise = excluded.food_rescue_paise, net_paise = excluded.net_paise + p.adjustments_paise
    where p.status = 'generated'
  returning * into row;
  if row.id is null then
    select * into row from public.payouts where payee_type = 'restaurant' and restaurant_id = rid and period_start = p_start;
  end if;
  return row;
end
$$;

revoke execute on function public.generate_restaurant_payout(uuid, date, date) from public, anon;
grant execute on function public.generate_restaurant_payout(uuid, date, date) to authenticated, service_role;
revoke execute on function public.partner_report(uuid, date, date) from public, anon;
grant execute on function public.partner_report(uuid, date, date) to authenticated, service_role;
revoke execute on function public.payout_statement(uuid, date, date) from public, anon;
grant execute on function public.payout_statement(uuid, date, date) to authenticated, service_role;
