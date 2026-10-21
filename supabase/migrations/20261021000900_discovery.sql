-- Aggregate stats for discovery. Security definer so customers can see popularity
-- without being able to read anyone else's orders or searches.

create or replace function public.restaurant_order_counts(days int default 7)
returns table (restaurant_id uuid, orders bigint)
language sql stable security definer set search_path = public as $$
  select o.restaurant_id, count(*)
  from public.orders o
  where o.status = 'DELIVERED' and o.created_at > now() - make_interval(days => days)
  group by o.restaurant_id
$$;

create or replace function public.trending_searches(days int default 7, lim int default 8)
returns table (query text, hits bigint)
language sql stable security definer set search_path = public as $$
  select lower(trim(s.query)) as query, count(*) as hits
  from public.search_history s
  where s.created_at > now() - make_interval(days => days) and length(trim(s.query)) >= 3
  group by 1
  order by 2 desc, 1
  limit lim
$$;

-- Most-ordered dishes per restaurant (for "Bestseller" sorting and recommendations).
create or replace function public.popular_items(p_restaurant uuid, lim int default 10)
returns table (menu_item_id uuid, orders bigint)
language sql stable security definer set search_path = public as $$
  select oi.menu_item_id, count(*)
  from public.order_items oi join public.orders o on o.id = oi.order_id
  where o.restaurant_id = p_restaurant and o.status = 'DELIVERED' and oi.menu_item_id is not null
  group by 1 order by 2 desc limit lim
$$;
