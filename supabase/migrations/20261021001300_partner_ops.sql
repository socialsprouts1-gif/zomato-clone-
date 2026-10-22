-- Phase 8 partner ops: onboarding documents and staff invite activation.

-- Optional onboarding documents (FSSAI licence, GST certificate, cancelled cheque), visible to the team and admins only.
alter table public.restaurant_private add column if not exists documents jsonb not null default '{}'::jsonb;

-- A new account whose email has a pending staff invite becomes restaurant staff and joins the outlet(s).
create or replace function public.profiles_staff_invite_role() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'customer' and new.email is not null and exists (
    select 1 from public.restaurant_staff where lower(email) = lower(new.email) and status = 'invited'
  ) then
    new.role := 'restaurant_staff';
  end if;
  return new;
end $$;

create or replace function public.profiles_staff_invite_link() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.email is not null then
    update public.restaurant_staff set user_id = new.id, status = 'active'
    where lower(email) = lower(new.email) and status = 'invited';
  end if;
  return new;
end $$;

drop trigger if exists profiles_staff_invite_role on public.profiles;
create trigger profiles_staff_invite_role before insert on public.profiles
  for each row execute function public.profiles_staff_invite_role();
drop trigger if exists profiles_staff_invite_link on public.profiles;
create trigger profiles_staff_invite_link after insert on public.profiles
  for each row execute function public.profiles_staff_invite_link();
