-- Phase 9 · Admin overview: KPIs for "today" (IST) and a per-day series, in one round trip.
-- Definitions (also used by the e2e spec):
--   orders today      = orders created today (IST) that got past payment (not PENDING_PAYMENT / FAILED_PAYMENT)
--   cancelled         = REJECTED, CANCELLED or CANCELLED_BY_CUSTOMER among those
--   GMV               = sum(total_paise) of orders today that weren't cancelled
--   AOV               = GMV / (orders today − cancelled)
--   active riders     = approved riders that are online
--   active restaurants = approved restaurants that are online
create or replace function public.admin_overview(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  today date := (now() at time zone 'Asia/Kolkata')::date;
  day_from date := today - (greatest(1, least(p_days, 90)) - 1);
  result jsonb;
begin
  if not public.is_admin() and coalesce(auth.role(), '') <> 'service_role' then
    raise exception 'admins only' using errcode = '42501';
  end if;
  with o as (
    select (created_at at time zone 'Asia/Kolkata')::date as day, status, total_paise,
           status in ('REJECTED', 'CANCELLED', 'CANCELLED_BY_CUSTOMER') as cancelled
    from public.orders
    where created_at >= (day_from::timestamp at time zone 'Asia/Kolkata')
      and status not in ('PENDING_PAYMENT', 'FAILED_PAYMENT')
  ),
  days as (select generate_series(day_from, today, interval '1 day')::date as day),
  series as (
    select d.day,
           count(o.status)::int as orders,
           coalesce(sum(o.total_paise) filter (where not o.cancelled), 0)::bigint as gmv_paise,
           (count(o.status) filter (where o.cancelled))::int as cancelled
    from days d left join o on o.day = d.day
    group by d.day order by d.day
  ),
  t as (select * from series where day = today),
  mix as (
    select status::text as status, count(*)::int as orders from o where day = today group by status
  ),
  mix_range as (
    select status::text as status, count(*)::int as orders from o group by status
  )
  select jsonb_build_object(
    'today', today,
    'kpis', jsonb_build_object(
      'gmv_paise', coalesce((select gmv_paise from t), 0),
      'orders', coalesce((select orders from t), 0),
      'cancelled', coalesce((select cancelled from t), 0),
      'aov_paise', coalesce((select case when orders - cancelled > 0 then round(gmv_paise::numeric / (orders - cancelled)) else 0 end from t), 0),
      'cancellation_rate', coalesce((select case when orders > 0 then round(cancelled::numeric * 100 / orders, 1) else 0 end from t), 0),
      'active_riders', (select count(*) from public.riders where status = 'approved' and is_online),
      'active_restaurants', (select count(*) from public.restaurants where status = 'approved' and is_online)
    ),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'orders', orders, 'gmv_paise', gmv_paise, 'cancelled', cancelled) order by day) from series), '[]'::jsonb),
    'status_mix_today', coalesce((select jsonb_agg(jsonb_build_object('status', status, 'orders', orders) order by orders desc) from mix), '[]'::jsonb),
    'status_mix_range', coalesce((select jsonb_agg(jsonb_build_object('status', status, 'orders', orders) order by orders desc) from mix_range), '[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke execute on function public.admin_overview(int) from public, anon;
grant execute on function public.admin_overview(int) to authenticated, service_role;

-- The admin orders table sorts by newest first across all restaurants.
create index if not exists orders_created_at_idx on public.orders (created_at desc);
