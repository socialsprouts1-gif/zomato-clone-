"use client";

import { ArrowLeft, Clock, Loader2, Mic, MicOff, Search, Store, TrendingUp, X } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { RatingPill, VegDot } from "@/components/catalog/badges";
import { useAddToCart } from "@/components/menu/use-add-to-cart";
import { EmptyState } from "@/components/shared/empty-state";
import { FoodImage } from "@/components/shared/food-image";
import { Button } from "@/components/ui/button";
import { clearSearchHistory, logSearch } from "@/lib/catalog/actions";
import type { SearchResults } from "@/lib/catalog/search";
import { formatKm } from "@/lib/geo";
import { cn, formatPaise } from "@/lib/utils";

const LOCAL_KEY = "thaali.recentSearches";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

export function SearchExperience({ recent: serverRecent, trending, loggedIn, vegMode }: { recent: string[]; trending: string[]; loggedIn: boolean; vegMode: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") ?? "");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [recent, setRecent] = useState<string[]>(serverRecent);
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const { add, ui } = useAddToCart(vegMode);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loggedIn) {
      try {
        setRecent(JSON.parse(localStorage.getItem(LOCAL_KEY) ?? "[]") as string[]);
      } catch {
        setRecent([]);
      }
    }
  }, [loggedIn]);

  // Debounced search; remembered once the user pauses.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const term = q.trim();
    const url = term ? `/search?q=${encodeURIComponent(term)}` : "/search";
    window.history.replaceState(null, "", url);
    if (term.length < 2) {
      setResults(null);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(false);
    const t = setTimeout(() => {
      fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal })
        .then((r) => {
          if (!r.ok) throw new Error("search failed");
          return r.json() as Promise<SearchResults>;
        })
        .then((data) => {
          setResults(data);
          setLoading(false);
        })
        .catch((e: unknown) => {
          if (e instanceof Error && e.name === "AbortError") return;
          setError(true);
          setLoading(false);
        });
    }, 250);
    const remember = setTimeout(() => {
      if (term.length < 3) return;
      if (loggedIn) void logSearch(term);
      setRecent((list) => {
        const next = [term, ...list.filter((x) => x.toLowerCase() !== term.toLowerCase())].slice(0, 8);
        if (!loggedIn) {
          try {
            localStorage.setItem(LOCAL_KEY, JSON.stringify(next));
          } catch {
            // ignore
          }
        }
        return next;
      });
    }, 1500);
    return () => {
      clearTimeout(t);
      clearTimeout(remember);
      ctrl.abort();
    };
  }, [q, loggedIn, attempt]);

  function voice() {
    const W = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) return void toast.error("Voice search isn't supported in this browser. Try Chrome, or type instead.");
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.onresult = (e) => {
      const text = Array.from(e.results).map((r) => r[0]?.transcript ?? "").join(" ");
      setQ(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => {
      setListening(false);
      toast.error("Didn't catch that. Please try again.");
    };
    recognition.current = rec;
    setListening(true);
    rec.start();
  }

  const empty = results && !results.restaurants.length && !results.dishes.length && !results.cuisines.length;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Go back" className="md:hidden">
          <ArrowLeft />
        </Button>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-primary" />
          <input
            ref={inputRef}
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search restaurants, dishes or cuisines"
            aria-label="Search"
            className="h-12 w-full rounded-2xl border bg-card pr-20 pl-11 text-base shadow-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30"
          />
          <div className="absolute top-1/2 right-2 flex -translate-y-1/2 items-center gap-1">
            {q ? (
              <button type="button" onClick={() => { setQ(""); inputRef.current?.focus(); }} aria-label="Clear search" className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent">
                <X className="size-4" />
              </button>
            ) : null}
            <button
              type="button"
              onClick={voice}
              aria-label={listening ? "Stop voice search" : "Search by voice"}
              aria-pressed={listening}
              className={cn("rounded-lg p-1.5 text-primary hover:bg-accent", listening && "animate-pulse bg-secondary")}
            >
              {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
            </button>
          </div>
        </div>
      </div>

      {!q.trim() ? (
        <div className="space-y-6">
          {recent.length ? (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">Recent searches</h2>
                <button
                  type="button"
                  className="text-sm font-semibold text-primary"
                  onClick={() => {
                    setRecent([]);
                    if (loggedIn) void clearSearchHistory();
                    else localStorage.removeItem(LOCAL_KEY);
                  }}
                >
                  Clear
                </button>
              </div>
              <ul className="flex flex-wrap gap-2">
                {recent.map((r) => (
                  <li key={r}>
                    <button type="button" onClick={() => setQ(r)} className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm">
                      <Clock className="size-3.5 text-muted-foreground" /> {r}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <section>
            <h2 className="mb-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">Trending searches</h2>
            <ul className="flex flex-wrap gap-2">
              {trending.map((r) => (
                <li key={r}>
                  <button type="button" onClick={() => setQ(r)} className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-1.5 text-sm capitalize">
                    <TrendingUp className="size-3.5 text-primary" /> {r}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : loading && !results ? (
        <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="size-5 animate-spin" /> Searching…
        </div>
      ) : error ? (
        <EmptyState icon={Search} title="Search isn't working right now" description="Check your connection and try again." action={<Button onClick={() => setAttempt((a) => a + 1)}>Try again</Button>} />
      ) : empty ? (
        <EmptyState icon={Search} title={`No results for “${q.trim()}”`} description="Check the spelling or try a broader term like “pizza” or “thali”." />
      ) : results ? (
        <div className={cn("space-y-8", loading && "opacity-70")}>
          {results.cuisines.length ? (
            <section aria-label="Cuisines">
              <h2 className="mb-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">Cuisines</h2>
              <ul className="flex flex-wrap gap-2">
                {results.cuisines.map((c) => (
                  <li key={c}>
                    <Link href={`/?cuisines=${encodeURIComponent(c)}#restaurants`} className="block rounded-full border border-primary/40 bg-secondary px-3 py-1.5 text-sm font-semibold text-secondary-foreground">
                      {c}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {results.restaurants.length ? (
            <section aria-label="Restaurants">
              <h2 className="mb-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">Restaurants</h2>
              <ul className="grid gap-2">
                {results.restaurants.map((r) => (
                  <li key={r.id}>
                    <Link href={`/restaurant/${r.slug}`} className="flex items-center gap-3 rounded-2xl border bg-card p-2 pr-4 hover:border-primary">
                      <FoodImage src={r.cover_image_url} alt="" name={r.cuisines[0] ?? r.name} sizes="64px" className={cn("size-16 shrink-0 rounded-xl", !r.open && "grayscale")} emojiClassName="text-3xl" />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 font-semibold">
                          <Store className="size-4 text-muted-foreground" /> {r.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {r.cuisines.join(", ")} · {r.locality} · {formatKm(r.distanceKm)}
                          {!r.open ? " · Closed now" : ""}
                        </span>
                      </span>
                      <RatingPill rating={r.rating} />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {results.dishes.length ? (
            <section aria-label="Dishes">
              <h2 className="mb-2 text-sm font-bold tracking-wide text-muted-foreground uppercase">Dishes</h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {results.dishes.map((d) => {
                  const from = d.item_variants.length ? Math.min(...d.item_variants.map((v) => v.price_paise)) : d.price_paise;
                  return (
                    <li key={d.id} className="flex gap-3 rounded-2xl border bg-card p-3" data-testid="dish-result">
                      <FoodImage src={d.image_url} alt={d.name} name={d.name} sizes="80px" className="size-20 shrink-0 rounded-xl" emojiClassName="text-3xl" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 font-semibold">
                          <VegDot veg={d.is_veg} className="size-3.5" /> <span className="truncate">{d.name}</span>
                        </p>
                        <Link href={`/restaurant/${d.restaurant.slug}`} className="block truncate text-xs text-muted-foreground hover:underline">
                          {d.restaurant.name} · {d.restaurant.locality}
                        </Link>
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-sm font-semibold">{formatPaise(from)}</span>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={!d.in_stock}
                            className="border-primary/40 font-extrabold text-primary uppercase"
                            aria-label={`Add ${d.name} from ${d.restaurant.name}`}
                            onClick={() => add(d, { id: d.restaurant.id, slug: d.restaurant.slug, name: d.restaurant.name, locality: d.restaurant.locality, image: d.restaurant.cover_image_url })}
                          >
                            {d.in_stock ? "Add" : "Sold out"}
                          </Button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}
      {ui}
    </div>
  );
}
