import { BadgePercent, Clock } from "lucide-react";
import Link from "next/link";
import { FoodImage } from "@/components/shared/food-image";
import { formatKm } from "@/lib/geo";
import type { RestaurantCardData } from "@/lib/catalog/restaurants";
import { cn, formatPaise } from "@/lib/utils";
import { GoldBadge, PureVegTag, RatingPill } from "./badges";
import { FavouriteButton } from "./favourite-button";

export function RestaurantCard({
  r,
  favourite = false,
  compact = false,
  priority = false,
}: {
  r: RestaurantCardData;
  favourite?: boolean;
  compact?: boolean;
  priority?: boolean;
}) {
  const closed = !r.open.open;
  return (
    <article className={cn("group relative", compact ? "w-64 shrink-0" : "")} data-testid="restaurant-card">
      <Link
        href={`/restaurant/${r.slug}`}
        className="block overflow-hidden rounded-2xl border bg-card shadow-sm transition hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`${r.name}, rated ${r.rating.toFixed(1)}, ${r.etaMin} minutes${closed ? `, ${r.open.label}` : ""}`}
      >
        <div className="relative">
          <FoodImage
            src={r.cover_image_url}
            alt=""
            name={r.cuisines[0] ?? r.name}
            sizes={compact ? "256px" : "(max-width: 768px) 100vw, 33vw"}
            priority={priority}
            className={cn(compact ? "h-36" : "h-48", closed && "grayscale")}
            emojiClassName="text-6xl"
          />
          <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 to-transparent" />
          {r.offer ? (
            <span className="absolute bottom-2 left-2 flex items-center gap-1 text-sm font-extrabold tracking-tight text-white drop-shadow">
              <BadgePercent className="size-4" aria-hidden /> {r.offer}
            </span>
          ) : null}
          <div className="absolute top-2 left-2 flex flex-wrap gap-1">
            {r.sponsored ? <span className="rounded-md bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">Promoted</span> : null}
            {r.isNew ? <span className="rounded-md bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">NEW</span> : null}
          </div>
          {closed ? (
            <div className="absolute inset-0 flex items-center justify-center bg-black/45">
              <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-foreground">
                {r.open.opensSoon ? "Opening soon · " : ""}
                {r.open.label}
              </span>
            </div>
          ) : null}
        </div>
        <div className={cn("space-y-1 p-3", closed && "opacity-70")}>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display line-clamp-1 text-base font-bold">{r.name}</h3>
            <RatingPill rating={r.rating} />
          </div>
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <p className="line-clamp-1">{r.cuisines.join(", ")}</p>
            <p className="shrink-0">{formatPaise(r.cost_for_two_paise)} for two</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <span className="flex items-center gap-1 font-semibold">
              <Clock className="size-3.5 text-success" aria-hidden /> {r.etaMin}–{r.etaMin + 5} min
            </span>
            <span className="text-muted-foreground">{formatKm(r.distanceKm)}</span>
            {r.gold_partner ? <GoldBadge /> : null}
            {r.is_pure_veg ? <PureVegTag /> : null}
          </div>
        </div>
      </Link>
      <FavouriteButton restaurantId={r.id} name={r.name} initial={favourite} className="absolute top-2 right-2" />
    </article>
  );
}
