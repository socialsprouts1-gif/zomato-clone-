"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FoodImage } from "@/components/shared/food-image";
import { useT } from "@/lib/i18n/client";

export type RecentItem = { slug: string; name: string; image: string | null; cuisine: string };
const KEY = "thaali.recentlyViewed";

export function readRecent(): RecentItem[] {
  try {
    return JSON.parse(window.localStorage.getItem(KEY) ?? "[]") as RecentItem[];
  } catch {
    return [];
  }
}

export function pushRecent(item: RecentItem) {
  try {
    const list = [item, ...readRecent().filter((r) => r.slug !== item.slug)].slice(0, 12);
    window.localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // storage unavailable (private mode) — the strip just stays empty
  }
}

export function RecentlyViewed() {
  const { t } = useT();
  const [items, setItems] = useState<RecentItem[]>([]);
  useEffect(() => setItems(readRecent()), []);
  if (!items.length) return null;
  return (
    <section aria-label={t("home.recentlyViewed")}>
      <h2 className="font-display mb-3 text-xl font-bold">{t("home.recentlyViewed")}</h2>
      <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none]">
        {items.map((r) => (
          <li key={r.slug} className="shrink-0">
            <Link href={`/restaurant/${r.slug}`} className="flex w-56 items-center gap-3 rounded-2xl border bg-card p-2 pr-3 hover:border-primary">
              <FoodImage src={r.image} alt="" name={r.cuisine} sizes="56px" className="size-14 shrink-0 rounded-xl" emojiClassName="text-2xl" />
              <span className="min-w-0">
                <span className="line-clamp-1 text-sm font-semibold">{r.name}</span>
                <span className="line-clamp-1 text-xs text-muted-foreground">{r.cuisine}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function TrackRecentlyViewed({ item }: { item: RecentItem }) {
  useEffect(() => pushRecent(item), [item]);
  return null;
}
