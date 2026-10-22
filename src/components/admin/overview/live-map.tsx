"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Map, type MapMarker } from "@/components/maps/map";
import { OrderStatusBadge } from "@/components/admin/orders/status-badge";
import type { LiveOrderPin, MapRestaurant, MapRider } from "@/lib/admin/overview";
import { formatPaise } from "@/lib/utils";

const PUNE = { lat: 18.535, lng: 73.86 };

/** City map: restaurants with live orders, their customers, online riders and other open restaurants. */
export function LiveMap({ live, riders, restaurants }: { live: LiveOrderPin[]; riders: MapRider[]; restaurants: MapRestaurant[] }) {
  const markers = useMemo<MapMarker[]>(() => {
    const busyRestaurants = new Set(live.map((o) => o.restaurant?.id).filter(Boolean));
    const out: MapMarker[] = [];
    for (const r of restaurants) if (!busyRestaurants.has(r.id)) out.push({ id: `r-${r.id}`, kind: "dot", lat: r.lat, lng: r.lng, label: r.name });
    const seen = new Set<string>();
    for (const o of live) {
      if (o.restaurant && !seen.has(o.restaurant.id)) {
        seen.add(o.restaurant.id);
        out.push({ id: `lr-${o.restaurant.id}`, kind: "restaurant", lat: o.restaurant.lat, lng: o.restaurant.lng, label: o.restaurant.name });
      }
      if (o.dest) out.push({ id: `d-${o.id}`, kind: "home", lat: o.dest.lat, lng: o.dest.lng, label: `Order #${o.order_number}` });
    }
    for (const r of riders) out.push({ id: `rd-${r.id}`, kind: "rider", lat: r.lat, lng: r.lng, label: `${r.name}${r.busy ? " · on a delivery" : " · free"}` });
    return out;
  }, [live, riders, restaurants]);

  return (
    <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]" aria-labelledby="live-map-title">
      <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="live-map-title" className="font-display text-lg font-semibold">Live city map</h2>
          <p className="text-xs text-muted-foreground" data-testid="map-counts">
            {live.length} live {live.length === 1 ? "order" : "orders"} · {riders.length} riders online
          </p>
        </div>
        <Map center={PUNE} zoom={12} markers={markers} fit className="h-72 sm:h-96" />
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Map legend">
          <li><span aria-hidden>🍽️</span> Restaurant with live orders</li>
          <li><span aria-hidden className="mr-1 inline-block size-2.5 rounded-full bg-primary align-middle" />Open restaurant</li>
          <li><span aria-hidden>🏠</span> Customer</li>
          <li><span aria-hidden>🛵</span> Online rider</li>
        </ul>
      </div>
      <div className="rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
        <h2 className="font-display text-lg font-semibold">Live orders</h2>
        {live.length === 0 ? (
          <p className="mt-6 text-center text-sm text-muted-foreground">No orders in progress right now.</p>
        ) : (
          <ul className="mt-2 max-h-96 divide-y overflow-y-auto" data-testid="live-orders">
            {live.slice(0, 30).map((o) => (
              <li key={o.id}>
                <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-primary">
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold">#{o.order_number}</span>
                    <span className="block truncate text-xs text-muted-foreground">{o.restaurant?.name ?? "Restaurant"} · {formatPaise(o.total_paise)}</span>
                  </span>
                  <OrderStatusBadge status={o.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
