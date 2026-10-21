import { Search } from "lucide-react";
import Link from "next/link";
import { brand } from "@/config/brand";

const cuisines = [
  { name: "Biryani", emoji: "🍛" },
  { name: "Pizza", emoji: "🍕" },
  { name: "Burger", emoji: "🍔" },
  { name: "Thali", emoji: "🍱" },
  { name: "Chinese", emoji: "🥡" },
  { name: "Dosa", emoji: "🥞" },
  { name: "Rolls", emoji: "🌯" },
  { name: "Cake", emoji: "🍰" },
  { name: "North Indian", emoji: "🍲" },
  { name: "South Indian", emoji: "🍚" },
  { name: "Healthy", emoji: "🥗" },
  { name: "Desserts", emoji: "🍨" },
];

export default function CustomerHomePage() {
  return (
    <div className="space-y-8">
      <section aria-labelledby="hero-title" className="rounded-3xl bg-gradient-to-br from-primary to-orange-600 p-6 text-primary-foreground md:p-10">
        <h1 id="hero-title" className="font-display text-3xl font-extrabold tracking-tight md:text-4xl">
          Hungry? {brand.tagline}
        </h1>
        <p className="mt-2 max-w-xl text-primary-foreground/85">{brand.description}</p>
        <Link
          href="/search"
          className="mt-6 flex max-w-xl items-center gap-3 rounded-2xl bg-card px-4 py-3.5 text-sm text-muted-foreground shadow-lg"
        >
          <Search className="size-5 text-primary" aria-hidden />
          Search for a restaurant, dish or cuisine
        </Link>
      </section>

      <section aria-labelledby="mind-title">
        <h2 id="mind-title" className="font-display mb-4 text-xl font-bold">
          What&apos;s on your mind?
        </h2>
        <ul className="-mx-4 flex gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-6 md:overflow-visible md:px-0">
          {cuisines.map((c) => (
            <li key={c.name} className="shrink-0">
              <Link
                href={`/search?q=${encodeURIComponent(c.name)}`}
                className="flex w-20 flex-col items-center gap-2 rounded-2xl p-1 text-center md:w-full"
              >
                <span className="flex size-20 items-center justify-center rounded-full bg-card text-4xl shadow-sm ring-1 ring-border">
                  {c.emoji}
                </span>
                <span className="text-xs font-semibold">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
