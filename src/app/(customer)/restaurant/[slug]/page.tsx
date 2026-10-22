import { BadgePercent, Clock, ExternalLink, MapPin, Phone, QrCode, Share2, ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GoldBadge, PureVegTag, RatingPill } from "@/components/catalog/badges";
import { FavouriteButton } from "@/components/catalog/favourite-button";
import { RestaurantMenu } from "@/components/menu/restaurant-menu";
import { InfoMap } from "@/components/restaurant/info-map";
import { RestaurantTabs } from "@/components/restaurant/restaurant-tabs";
import { ReviewsSection, type ReviewView } from "@/components/restaurant/reviews-section";
import { ViewTracker } from "@/components/restaurant/view-tracker";
import { FoodImage } from "@/components/shared/food-image";
import { ShareButton } from "@/components/shared/share-button";
import { Card } from "@/components/ui/card";
import { summarizeReviews } from "@/lib/ai/review-summary";
import { getSessionUser } from "@/lib/auth/session";
import { getMenu } from "@/lib/catalog/menu";
import { formatClock, getOpenState, isCategoryAvailable, type OpeningHours } from "@/lib/catalog/open-state";
import { estimateEtaMinutes, formatKm, haversineKm } from "@/lib/geo";
import { getPreferences } from "@/lib/preferences";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

const DAY_LABEL: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

async function loadRestaurant(slug: string) {
  if (!/^[a-z0-9-]{2,80}$/.test(slug)) return null;
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase.from("restaurants").select("*, restaurant_photos(id, url, caption, kind, sort), restaurant_offers(*)").eq("slug", slug).maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const r = await loadRestaurant((await params).slug);
  return r ? { title: `${r.name}, ${r.locality}`, description: r.description ?? undefined } : { title: "Restaurant" };
}

export default async function RestaurantPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ table?: string }> }) {
  const { slug } = await params;
  const { table: tableToken } = await searchParams;
  const [r, prefs, user] = await Promise.all([loadRestaurant(slug), getPreferences(), getSessionUser()]);
  if (!r) notFound();
  const supabase = await getSupabaseServerClient();
  const [{ categories, items }, { data: reviews }, fav, { data: table }] = await Promise.all([
    getMenu(r.id),
    supabase
      .from("reviews")
      .select("id, kind, customer_name, food_rating, delivery_rating, food_tags, delivery_tags, comment, created_at, review_photos(id, url), review_replies(body, created_at)")
      .eq("restaurant_id", r.id)
      .order("created_at", { ascending: false })
      .limit(100),
    user ? supabase.from("favourites").select("restaurant_id").eq("restaurant_id", r.id).maybeSingle() : Promise.resolve({ data: null }),
    // Dine-in QR (partner Tables & QR codes): /restaurant/<slug>?table=<qr_token>
    tableToken && /^[A-Za-z0-9-]{4,40}$/.test(tableToken)
      ? supabase.from("restaurant_tables").select("label, section").eq("restaurant_id", r.id).eq("qr_token", tableToken).eq("is_active", true).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const now = new Date();
  const open = getOpenState(r, now);
  const distance = haversineKm(prefs.location.lat, prefs.location.lng, r.lat, r.lng);
  const eta = estimateEtaMinutes(distance, r.avg_prep_minutes);
  const offers = r.restaurant_offers.filter((o) => o.is_active && (!o.valid_until || new Date(o.valid_until) > now));
  const unavailable: Record<string, string> = {};
  for (const c of categories) {
    if (!isCategoryAvailable(c, now)) unavailable[c.id] = c.available_from && c.available_to ? `Available ${formatClock(c.available_from)} – ${formatClock(c.available_to)}` : "Not available today";
  }
  const reviewList = (reviews ?? []) as ReviewView[];
  const summary = await summarizeReviews(r.id, reviewList.map((x) => ({ ...x, delivery_tags: [] })), items.map((i) => i.name));
  const photos = [...r.restaurant_photos].sort((a, b) => a.sort - b.sort);
  const hours = r.opening_hours as OpeningHours;
  const cartRestaurant = { id: r.id, slug: r.slug, name: r.name, locality: r.locality, image: r.cover_image_url };

  return (
    <div className="space-y-5" data-testid="restaurant-page">
      <ViewTracker restaurantId={r.id} recent={{ slug: r.slug, name: r.name, image: r.cover_image_url, cuisine: r.cuisines.slice(0, 2).join(", ") }} />

      <div className="-mx-4 grid h-52 grid-cols-3 gap-1 overflow-hidden md:mx-0 md:h-72 md:rounded-3xl">
        <FoodImage src={photos[0]?.url ?? r.cover_image_url} alt={`${r.name}`} name={r.cuisines[0] ?? r.name} sizes="(max-width: 768px) 100vw, 66vw" priority className="col-span-3 md:col-span-2" emojiClassName="text-7xl" />
        <div className="hidden grid-rows-2 gap-1 md:grid">
          {photos.slice(1, 3).map((p) => (
            <FoodImage key={p.id} src={p.url} alt={p.caption ?? ""} name={r.name} sizes="33vw" />
          ))}
        </div>
      </div>

      {table ? (
        <p className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-secondary/60 p-3 text-sm" data-testid="table-banner">
          <QrCode className="size-5 shrink-0 text-primary" aria-hidden />
          <span>
            <span className="font-semibold">You&apos;re at Table {table.label}</span> · {table.section}. Browse the menu and tell your server when you&apos;re ready to order.
          </span>
        </p>
      ) : null}

      <Card className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-extrabold md:text-3xl">{r.name}</h1>
            <p className="text-sm text-muted-foreground">{r.cuisines.join(", ")}</p>
            <p className="text-sm text-muted-foreground">
              {r.locality} · {formatKm(distance)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <div className="flex gap-2">
              <ShareButton title={r.name} path={`/restaurant/${r.slug}`} className="size-9 rounded-full p-0">
                <Share2 aria-label="Share restaurant" />
              </ShareButton>
              <FavouriteButton restaurantId={r.id} name={r.name} initial={Boolean(fav.data)} className="bg-secondary text-foreground hover:bg-accent" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <span className="flex items-center gap-2">
            <RatingPill rating={Number(r.rating_delivery)} count={r.rating_count} /> <span className="text-xs text-muted-foreground">Delivery</span>
          </span>
          {r.dining_enabled ? (
            <span className="flex items-center gap-2">
              <RatingPill rating={Number(r.rating_dining)} count={r.dining_rating_count} kind="dining" /> <span className="text-xs text-muted-foreground">Dining</span>
            </span>
          ) : null}
          <span className="flex items-center gap-1 font-semibold">
            <Clock className="size-4 text-success" /> {eta}–{eta + 5} min
          </span>
          <span className="text-muted-foreground">{formatPaise(r.cost_for_two_paise)} for two</span>
          {r.gold_partner ? <GoldBadge /> : null}
          {r.is_pure_veg ? <PureVegTag /> : null}
        </div>
        <p className={`text-sm font-semibold ${open.open ? "text-success" : "text-destructive"}`}>
          {open.open ? "Open now" : `${open.label}. You can still schedule an order for later.`}
        </p>
        {offers.length ? (
          <ul className="-mx-5 flex gap-3 overflow-x-auto px-5 pt-1 pb-1 [scrollbar-width:none]" aria-label="Offers">
            {offers.map((o) => (
              <li key={o.id} className="flex w-60 shrink-0 items-center gap-3 rounded-2xl border border-dashed border-primary/50 bg-secondary/40 p-3">
                <BadgePercent className="size-6 shrink-0 text-primary" />
                <div className="min-w-0">
                  <p className="text-sm font-bold">{o.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.applies_to === "dining" ? "Dining · " : ""}Use {o.code}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      <RestaurantTabs
        reviewCount={reviewList.length}
        order={
          <RestaurantMenu
            restaurant={cartRestaurant}
            categories={categories}
            items={items}
            unavailableCategories={unavailable}
            healthyMode={prefs.healthyMode}
            vegMode={prefs.vegMode}
          />
        }
        reviews={
          <ReviewsSection
            reviews={reviewList}
            summary={summary.text}
            aiSummary={summary.ai}
            ratingDelivery={Number(r.rating_delivery)}
            ratingDining={Number(r.rating_dining)}
            deliveryCount={r.rating_count}
            diningCount={r.dining_rating_count}
          />
        }
        photos={
          <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
            {[...photos, ...reviewList.flatMap((x) => x.review_photos.map((p) => ({ id: p.id, url: p.url, caption: `From ${x.customer_name}`, kind: "review", sort: 99 })))].map((p) => (
              <figure key={p.id} className="space-y-1">
                <FoodImage src={p.url} alt={p.caption ?? r.name} name={r.name} sizes="33vw" className="aspect-square rounded-2xl" />
                <figcaption className="text-xs text-muted-foreground capitalize">{p.caption ?? p.kind}</figcaption>
              </figure>
            ))}
          </div>
        }
        info={
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-4">
              <InfoMap lat={r.lat} lng={r.lng} name={r.name} home={prefs.location} />
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${r.lat},${r.lng}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl border bg-card p-3 text-sm font-semibold text-primary"
              >
                <ExternalLink className="size-4" /> Get directions
              </a>
            </div>
            <Card className="space-y-4 p-5 text-sm">
              {r.description ? <p>{r.description}</p> : null}
              <p className="flex gap-2">
                <MapPin className="size-4 shrink-0 text-primary" /> {r.address}
              </p>
              {r.phone ? (
                <p className="flex gap-2">
                  <Phone className="size-4 shrink-0 text-primary" /> {r.phone}
                </p>
              ) : null}
              <div>
                <p className="mb-1 font-semibold">Opening hours</p>
                <ul className="grid gap-0.5 text-muted-foreground">
                  {Object.keys(DAY_LABEL).map((d) => (
                    <li key={d} className="flex justify-between">
                      <span>{DAY_LABEL[d]}</span>
                      <span>{(hours[d as keyof OpeningHours] ?? []).map(([o, c]) => `${formatClock(o)} – ${formatClock(c)}`).join(", ") || "Closed"}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                {r.outdoor_seating ? <span className="rounded-full bg-muted px-2 py-1">Outdoor seating</span> : null}
                {r.serves_alcohol ? <span className="rounded-full bg-muted px-2 py-1">Serves alcohol</span> : null}
                {r.dining_enabled ? <span className="rounded-full bg-muted px-2 py-1">Table booking</span> : null}
              </div>
              {r.fssai ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <ShieldCheck className="size-4" /> FSSAI Lic. No. {r.fssai}
                </p>
              ) : null}
            </Card>
          </div>
        }
      />
    </div>
  );
}
