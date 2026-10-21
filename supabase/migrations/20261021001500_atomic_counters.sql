-- Atomic counters used when an order is placed (no read-then-write races).
grant execute on function public.adjust_menu_stock(uuid, int) to service_role;

create or replace function public.increment_coupon_use(p_coupon uuid) returns void
language sql security definer set search_path = public as $$
  update public.coupons set used_count = used_count + 1 where id = p_coupon;
$$;
revoke execute on function public.increment_coupon_use(uuid) from public, anon, authenticated;
grant execute on function public.increment_coupon_use(uuid) to service_role;
