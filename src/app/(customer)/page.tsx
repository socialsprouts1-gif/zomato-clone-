import { Search, UtensilsCrossed } from "lucide-react";
import Link from "next/link";
import { BannerCarousel } from "@/components/catalog/banner-carousel";
import { FilterBar } from "@/components/catalog/filter-bar";
import { ModeToggles } from "@/components/catalog/mode-toggles";
import { Rail } from "@/components/catalog/rail";
import { RecentlyViewed } from "@/components/catalog/recently-viewed";
import { RestaurantCard } from "@/components/catalog/restaurant-card";
import { EmptyState } from "@/components/shared/empty-state";
import { FoodImage } from "@/components/shared/food-image";
import { Button } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { hasActiveFilters, MIND_CUISINES, parseFilters } from "@/lib/catalog/filters";
import { allCuisines, applyFilters, getHomeSections, getNearbyRestaurants } from "@/lib/catalog/restaurants";
import { getT } from "@/lib/i18n/server";
import { getPreferences } from "@/lib/preferences";

export default async function CustomerHomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [prefs, user, sp, { t }] = await Promise.all([getPreferences(), getSessionUser(), searchParams, getT()]);
  const filters = parseFilters(sp);
  const nearby = await getNearbyRestaurants(prefs);
  const sections = await getHomeSections(nearby, user?.id ?? null);
  const filtered = applyFilters(nearby, filters);
  const filtering = hasActiveFilters(filters);
  const cuisines = allCuisines(nearby);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <Link
          href="/search"
          className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3.5 text-sm text-muted-foreground shadow-sm transition hover:border-primary"
        >
          <Search className="size-5 text-primary" aria-hidden />
          {t("home.search")}
        </Link>
        <ModeToggles vegMode={prefs.vegMode} healthyMode={prefs.healthyMode} />
      </div>

      {!filtering ? <BannerCarousel banners={sections.banners} /> : null}

      <section aria-labelledby="mind-title">
        <h2 id="mind-title" className="font-display mb-4 text-xl font-bold">
          {t("home.mind")}
        </h2>
        <ul className="-mx-4 grid auto-cols-[5.5rem] grid-flow-col grid-rows-2 gap-x-3 gap-y-4 overflow-x-auto px-4 pb-2 [scrollbar-width:none] md:mx-0 md:grid-flow-row md:grid-cols-7 md:grid-rows-none md:px-0">
          {MIND_CUISINES.map((c) => {
            const active = filters.cuisines.includes(c.cuisine);
            return (
              <li key={c.label}>
                <Link
                  href={active ? "/#restaurants" : `/?cuisines=${encodeURIComponent(c.cuisine)}#restaurants`}
                  scroll={false}
                  aria-pressed={active}
                  className="flex flex-col items-center gap-2 rounded-2xl p-1 text-center"
                >
                  <span className={`flex size-20 items-center justify-center rounded-full bg-card text-4xl shadow-sm ring-1 ring-border transition ${active ? "ring-2 ring-primary" : ""}`}>
                    {c.emoji}
                  </span>
                  <span className="text-xs font-semibold">{c.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {!filtering ? (
        <>
          <RecentlyViewed />
          {sections.recommended.length ? (
            <Rail title={t("home.recommended")} subtitle={user ? "Based on what you've ordered" : "Popular picks near you"} testId="rail-recommended">
              {sections.recommended.map((r) => (
                <RestaurantCard key={r.id} r={r} compact favourite={sections.favourites.has(r.id)} />
              ))}
            </Rail>
          ) : null}
          {sections.topRated.length ? (
            <Rail title={t("home.topRated")} href="/?sort=rating&rating4=1#restaurants" testId="rail-top-rated">
              {sections.topRated.map((r) => (
                <RestaurantCard key={r.id} r={r} compact favourite={sections.favourites.has(r.id)} />
              ))}
            </Rail>
          ) : null}
          {sections.trending.length ? (
            <Rail title={t("home.trending")} subtitle="Most ordered in the last 7 days" testId="rail-trending">
              {sections.trending.map((r) => (
                <RestaurantCard key={r.id} r={r} compact favourite={sections.favourites.has(r.id)} />
              ))}
            </Rail>
          ) : null}
          {sections.collections.length ? (
            <Rail title={t("home.collections")} subtitle="Hand-picked lists from our food team" testId="rail-collections">
              {sections.collections.map((c) => (
                <Link
                  key={c.id}
                  href={`/collections/${c.slug}`}
                  className="relative block h-44 w-40 shrink-0 overflow-hidden rounded-2xl focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <FoodImage src={c.image_url} alt="" name={c.title} sizes="160px" className="absolute inset-0" emojiClassName="text-5xl" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <span className="absolute inset-x-3 bottom-3 text-white">
                    <span className="font-display block leading-tight font-bold">{c.title}</span>
                    <span className="text-xs text-white/80">{c.count} places</span>
                  </span>
                </Link>
              ))}
            </Rail>
          ) : null}
        </>
      ) : null}

      <section id="restaurants" aria-labelledby="all-title" className="scroll-mt-20">
        <h2 id="all-title" className="font-display text-xl font-bold">
          {filtering ? `${filtered.length} restaurants` : t("home.restaurantsAround", { count: nearby.length })}
        </h2>
        <FilterBar cuisines={cuisines} resultCount={filtered.length} />
        {filtered.length ? (
          <div className="mt-3 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((r, i) => (
              <RestaurantCard key={r.id} r={r} favourite={sections.favourites.has(r.id)} priority={i < 2} />
            ))}
          </div>
        ) : (
          <EmptyState
            className="mt-3"
            icon={UtensilsCrossed}
            title={nearby.length ? "No restaurants match these filters" : "No restaurants deliver here yet"}
            description={nearby.length ? "Try removing a filter or two." : "Try another location in Pune."}
            action={
              nearby.length ? (
                <Button asChild variant="outline">
                  <Link href="/#restaurants">Clear filters</Link>
                </Button>
              ) : undefined
            }
          />
        )}
      </section>
    </div>
  );
}
