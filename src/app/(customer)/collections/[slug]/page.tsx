import { Share2 } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RestaurantCard } from "@/components/catalog/restaurant-card";
import { ShareButton } from "@/components/shared/share-button";
import { FoodImage } from "@/components/shared/food-image";
import { getSessionUser } from "@/lib/auth/session";
import { getNearbyRestaurants } from "@/lib/catalog/restaurants";
import { getPreferences } from "@/lib/preferences";
import { getSupabaseServerClient } from "@/lib/supabase/server";

async function load(slug: string) {
  if (!/^[a-z0-9-]{2,80}$/i.test(slug)) return null;
  const supabase = await getSupabaseServerClient();
  const { data } = await supabase
    .from("collections")
    .select("id, title, description, image_url, is_curated, share_code, owner_id, collection_items(restaurant_id, sort)")
    .or(`slug.eq.${slug},share_code.eq.${slug.toUpperCase()}`)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const c = await load((await params).slug);
  return { title: c?.title ?? "Collection" };
}

export default async function CollectionPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [collection, prefs, user] = await Promise.all([load(slug), getPreferences(), getSessionUser()]);
  if (!collection) notFound();
  const nearby = await getNearbyRestaurants(prefs);
  const order = new Map(collection.collection_items.map((i) => [i.restaurant_id, i.sort]));
  const list = nearby.filter((r) => order.has(r.id)).sort((a, b) => Number(b.open.open) - Number(a.open.open) || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
  const supabase = await getSupabaseServerClient();
  const favs = user ? new Set(((await supabase.from("favourites").select("restaurant_id")).data ?? []).map((f) => f.restaurant_id)) : new Set<string>();

  return (
    <div className="space-y-6">
      <header className="relative h-48 overflow-hidden rounded-3xl md:h-64">
        <FoodImage src={collection.image_url} alt="" name={collection.title} sizes="100vw" priority className="absolute inset-0" emojiClassName="text-7xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-black/10" />
        <div className="absolute inset-x-5 bottom-5 flex items-end justify-between gap-3 text-white">
          <div>
            <p className="text-xs font-semibold tracking-wide uppercase opacity-80">{collection.is_curated ? "Thaali collection" : "Shared collection"}</p>
            <h1 className="font-display text-3xl font-extrabold">{collection.title}</h1>
            {collection.description ? <p className="text-sm opacity-85">{collection.description}</p> : null}
            <p className="mt-1 text-sm font-semibold">{list.length} places deliver to you</p>
          </div>
          <ShareButton title={collection.title} path={`/collections/${slug}`} className="bg-white/20 text-white hover:bg-white/30">
            <Share2 /> Share
          </ShareButton>
        </div>
      </header>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((r) => (
          <RestaurantCard key={r.id} r={r} favourite={favs.has(r.id)} />
        ))}
      </div>
    </div>
  );
}
