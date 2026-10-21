-- Phase 8: partner offers & ad campaigns.
-- Ad metrics are simulated: each page load "ticks" active campaigns forward from last_ticked_at
-- (see tickCampaign in src/app/partner/(console)/offers/data.ts), so paused time never accrues spend.

alter table public.ad_campaigns add column if not exists last_ticked_at timestamptz not null default now();
alter table public.ad_campaigns add column if not exists updated_at timestamptz not null default now();

drop trigger if exists ad_campaigns_touch on public.ad_campaigns;
create trigger ad_campaigns_touch before update on public.ad_campaigns for each row execute function public.touch_updated_at();

alter table public.ad_campaigns drop constraint if exists ad_campaigns_dates_check;
alter table public.ad_campaigns add constraint ad_campaigns_dates_check check (ends_on is null or ends_on >= starts_on);

-- Team members can create campaigns for their own outlet (select + update policies already exist).
drop policy if exists "ads: team insert" on public.ad_campaigns;
create policy "ads: team insert" on public.ad_campaigns for insert
  with check (public.is_restaurant_member(restaurant_id) or public.is_admin());

-- Offer codes are matched case-insensitively at checkout; keep them uppercase alphanumerics.
alter table public.restaurant_offers drop constraint if exists restaurant_offers_code_format;
alter table public.restaurant_offers add constraint restaurant_offers_code_format check (code ~ '^[A-Z0-9]{3,20}$') not valid;

create index if not exists reviews_restaurant_rating_idx on public.reviews (restaurant_id, food_rating);
