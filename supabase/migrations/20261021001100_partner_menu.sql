-- Phase 8: partner menu & inventory.

-- Low-stock alert: notify the restaurant team once each time a tracked item crosses
-- down to (or below) its low-stock threshold — whether by an order or a manual edit.
create or replace function public.menu_items_low_stock_alert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  was_low boolean := false;
  is_low boolean := new.stock_qty is not null and new.stock_qty <= new.low_stock_threshold;
  owner uuid;
begin
  if tg_op = 'UPDATE' then
    was_low := old.stock_qty is not null and old.stock_qty <= old.low_stock_threshold;
  end if;
  if not is_low or was_low or new.is_deleted then
    return null;
  end if;
  select owner_id into owner from public.restaurants where id = new.restaurant_id;
  insert into public.notifications (user_id, type, title, body, link)
  select uid, 'partner',
    case when new.stock_qty = 0 then format('Out of stock: %s', new.name)
         else format('Low stock: %s (%s left)', new.name, new.stock_qty) end,
    case when new.stock_qty = 0 then 'It is hidden from ordering until you restock.'
         else format('Below your alert level of %s. Restock soon to keep it on the menu.', new.low_stock_threshold) end,
    '/partner/menu?view=inventory'
  from (
    select owner as uid
    union
    select user_id from public.restaurant_staff where restaurant_id = new.restaurant_id and status = 'active'
  ) team
  where uid is not null;
  return null;
end $$;

drop trigger if exists menu_items_low_stock on public.menu_items;
create trigger menu_items_low_stock after insert or update of stock_qty, low_stock_threshold on public.menu_items
  for each row execute function public.menu_items_low_stock_alert();

-- Atomic stock adjustment for the inventory screen (+/- buttons). Team members only.
create or replace function public.adjust_menu_stock(p_item uuid, p_delta int) returns int
language plpgsql security invoker set search_path = public as $$
declare
  qty int;
begin
  update public.menu_items
    set stock_qty = greatest(0, stock_qty + p_delta)
    where id = p_item and stock_qty is not null and not is_deleted
    returning stock_qty into qty;
  return qty;
end $$;
revoke execute on function public.adjust_menu_stock(uuid, int) from public, anon;
grant execute on function public.adjust_menu_stock(uuid, int) to authenticated;
