-- Admin ops: rider payouts, payout adjustments with notes, paid-statement immutability.
-- Periods are inclusive IST calendar dates (see public.ist_window).

-- COD cash netted off a rider statement (see rider_payout_statement).
alter table public.payouts add column if not exists cash_held_paise bigint not null default 0;
create index if not exists payouts_period_type_idx on public.payouts (period_start, payee_type);
create index if not exists orders_rider_delivered_idx on public.orders (rider_id, delivered_at) where status = 'DELIVERED';
create index if not exists rider_cash_deposits_rider_created_idx on public.rider_cash_deposits (rider_id, created_at);

-- Manual ± corrections on a statement. Kept across regeneration (payouts.adjustments_paise is their running total).
create table if not exists public.payout_adjustments (
  id uuid primary key default gen_random_uuid(),
  payout_id uuid not null references public.payouts (id) on delete cascade,
  amount_paise bigint not null check (amount_paise <> 0),
  note text not null check (length(note) between 3 and 300),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists payout_adjustments_payout_idx on public.payout_adjustments (payout_id, created_at);
create index if not exists payout_adjustments_created_by_idx on public.payout_adjustments (created_by);
alter table public.payout_adjustments enable row level security;
-- Readable by whoever can read the statement (admins, the rider, the restaurant team). Writes go through add_payout_adjustment.
drop policy if exists "payout_adjustments: read" on public.payout_adjustments;
create policy "payout_adjustments: read" on public.payout_adjustments for select
  using (exists (select 1 from public.payouts p where p.id = payout_id
    and (public.is_admin() or p.rider_id = (select auth.uid()) or (p.restaurant_id is not null and public.is_restaurant_member(p.restaurant_id)))));

-- Paid statements are immutable for every API role (service role included). Only the database owner
-- (migrations / maintenance) can still correct one.
create or replace function public.payouts_paid_guard() returns trigger
language plpgsql as $$
begin
  if old.status = 'paid' and current_user not in ('postgres', 'supabase_admin') then
    raise exception 'paid statements cannot be changed' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists payouts_paid_guard on public.payouts;
create trigger payouts_paid_guard before update on public.payouts for each row execute function public.payouts_paid_guard();

-- ---------------------------------------------------------------------------------------------
-- Rider statement for one rider and period. Definitions:
--   trips      = 'delivery' earnings rows created in the period
--   earnings   = Σ rider_earnings.total_paise in the period (base + distance pay + tips + incentives,
--                plus incentive/adjustment rows) — the statement's gross
--   cash held  = COD cash the rider still holds (riders.floating_cash_paise: + on COD delivery,
--                − on deposit) not already claimed by another unpaid statement; it is netted off the
--                payout, and marking the statement paid settles it (a 'PAYOUT-…' deposit row).
--   net        = earnings − cash held + adjustments  (negative = the rider owes Thaali)
-- COD collected / deposited during the period are returned for information only.
-- ---------------------------------------------------------------------------------------------
create or replace function public.rider_payout_statement(p_rider uuid, p_start date, p_end date) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  w record;
  floating bigint;
  claimed bigint;
  result jsonb;
begin
  if not (p_rider = auth.uid() or public.is_admin() or public.is_service_context()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select floating_cash_paise into floating from public.riders where id = p_rider;
  if floating is null then raise exception 'rider not found' using errcode = 'P0002'; end if;
  select coalesce(sum(cash_held_paise), 0) into claimed from public.payouts
    where payee_type = 'rider' and rider_id = p_rider and status = 'generated' and period_start <> p_start;
  select * into w from public.ist_window(p_start, p_end);

  with e as (
    select * from public.rider_earnings
    where rider_id = p_rider and created_at >= w.from_ts and created_at < w.to_ts
  ),
  cod as (
    select o.id as order_id, o.order_number, o.delivered_at, o.payable_paise::bigint as amount_paise
    from public.orders o
    where o.rider_id = p_rider and o.status = 'DELIVERED' and o.payment_method = 'cod' and o.payment_status = 'cod_collected'
      and o.delivered_at >= w.from_ts and o.delivered_at < w.to_ts
  ),
  t as (
    select
      (select count(*) from e where kind = 'delivery')::int as trips,
      (select coalesce(sum(total_paise), 0) from e)::bigint as earnings,
      (select coalesce(sum(base_pay_paise + distance_pay_paise), 0) from e)::bigint as trip_pay,
      (select coalesce(sum(tip_paise), 0) from e)::bigint as tips,
      (select coalesce(sum(incentive_paise), 0) from e)::bigint as incentives,
      (select coalesce(sum(amount_paise), 0) from cod)::bigint as collected,
      (select coalesce(sum(amount_paise), 0) from public.rider_cash_deposits
        where rider_id = p_rider and created_at >= w.from_ts and created_at < w.to_ts)::bigint as deposited,
      greatest(floating - claimed, 0)::bigint as held
  )
  select jsonb_build_object(
    'rider_id', p_rider, 'period_start', p_start, 'period_end', p_end,
    'trip_count', t.trips, 'earnings_paise', t.earnings, 'trip_pay_paise', t.trip_pay, 'tips_paise', t.tips,
    'incentives_paise', t.incentives, 'other_paise', t.earnings - t.trip_pay - t.tips - t.incentives,
    'cod_collected_paise', t.collected, 'cash_deposited_paise', t.deposited, 'floating_cash_paise', floating,
    'cash_held_paise', t.held,
    'net_before_adjustments_paise', t.earnings - t.held,
    'trips', coalesce((select jsonb_agg(jsonb_build_object('order_id', e.order_id, 'order_number', o.order_number,
        'created_at', e.created_at, 'kind', e.kind, 'total_paise', e.total_paise, 'tip_paise', e.tip_paise,
        'incentive_paise', e.incentive_paise, 'note', e.note) order by e.created_at)
      from e left join public.orders o on o.id = e.order_id), '[]')
  ) into result
  from t;
  return result;
end
$$;

-- Idempotent, like generate_restaurant_payout: inserts or refreshes an unpaid statement (adjustments kept);
-- a paid statement is returned unchanged.
create or replace function public.generate_rider_payout(p_rider uuid, p_start date, p_end date) returns public.payouts
language plpgsql volatile security definer set search_path = public as $$
declare
  s jsonb;
  row public.payouts;
begin
  if not (public.is_admin() or public.is_service_context()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  if p_end < p_start then raise exception 'invalid period' using errcode = '22023'; end if;
  s := public.rider_payout_statement(p_rider, p_start, p_end);
  insert into public.payouts as p (payee_type, rider_id, period_start, period_end, order_count, gross_paise,
    commission_paise, gst_on_commission_paise, food_rescue_paise, cash_held_paise, adjustments_paise, net_paise)
  values ('rider', p_rider, p_start, p_end, (s->>'trip_count')::int, (s->>'earnings_paise')::bigint, 0, 0, 0,
    (s->>'cash_held_paise')::bigint, 0, (s->>'net_before_adjustments_paise')::bigint)
  on conflict (rider_id, period_start) where payee_type = 'rider' do update set
    period_end = excluded.period_end, order_count = excluded.order_count, gross_paise = excluded.gross_paise,
    cash_held_paise = excluded.cash_held_paise, net_paise = excluded.net_paise + p.adjustments_paise
    where p.status = 'generated'
  returning * into row;
  if row.id is null then
    select * into row from public.payouts where payee_type = 'rider' and rider_id = p_rider and period_start = p_start;
  end if;
  return row;
end
$$;

-- Adds a ± adjustment with a note to an unpaid statement and moves its net by the same amount.
create or replace function public.add_payout_adjustment(p_payout uuid, p_amount bigint, p_note text, p_admin uuid) returns public.payouts
language plpgsql volatile security definer set search_path = public as $$
declare
  row public.payouts;
begin
  if not (public.is_admin() or public.is_service_context()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  select * into row from public.payouts where id = p_payout for update;
  if row.id is null then raise exception 'statement not found' using errcode = 'P0002'; end if;
  if row.status <> 'generated' then raise exception 'paid statements cannot be changed' using errcode = '42501'; end if;
  insert into public.payout_adjustments (payout_id, amount_paise, note, created_by) values (p_payout, p_amount, p_note, p_admin);
  update public.payouts set adjustments_paise = adjustments_paise + p_amount, net_paise = net_paise + p_amount
    where id = p_payout returning * into row;
  return row;
end
$$;

-- Marks an unpaid statement as paid (one-way).
create or replace function public.mark_payout_paid(p_payout uuid) returns public.payouts
language plpgsql volatile security definer set search_path = public as $$
declare
  row public.payouts;
begin
  if not (public.is_admin() or public.is_service_context()) then
    raise exception 'not allowed' using errcode = '42501';
  end if;
  update public.payouts set status = 'paid', paid_at = now() where id = p_payout and status = 'generated' returning * into row;
  if row.id is null then
    if exists (select 1 from public.payouts where id = p_payout) then
      raise exception 'statement is already paid' using errcode = '42501';
    end if;
    raise exception 'statement not found' using errcode = 'P0002';
  end if;
  -- Cash netted off a rider's payout is settled: it leaves their floating cash like a deposit.
  if row.payee_type = 'rider' and row.cash_held_paise > 0 then
    insert into public.rider_cash_deposits (rider_id, amount_paise, reference)
      values (row.rider_id, row.cash_held_paise, 'PAYOUT-' || to_char(row.period_start, 'YYYY-MM-DD'));
    update public.riders set floating_cash_paise = greatest(floating_cash_paise - row.cash_held_paise, 0) where id = row.rider_id;
  end if;
  return row;
end
$$;

revoke execute on function public.rider_payout_statement(uuid, date, date) from public, anon;
grant execute on function public.rider_payout_statement(uuid, date, date) to authenticated, service_role;
revoke execute on function public.generate_rider_payout(uuid, date, date) from public, anon;
grant execute on function public.generate_rider_payout(uuid, date, date) to authenticated, service_role;
revoke execute on function public.add_payout_adjustment(uuid, bigint, text, uuid) from public, anon;
grant execute on function public.add_payout_adjustment(uuid, bigint, text, uuid) to authenticated, service_role;
revoke execute on function public.mark_payout_paid(uuid) from public, anon;
grant execute on function public.mark_payout_paid(uuid) to authenticated, service_role;

-- Admin inbox & rescue log lookups.
create index if not exists support_tickets_updated_idx on public.support_tickets (updated_at desc);
create index if not exists rescue_created_idx on public.food_rescue_listings (created_at desc);
create index if not exists donations_created_idx on public.donations (created_at desc);
create index if not exists admin_audit_action_idx on public.admin_audit_log (action text_pattern_ops);
