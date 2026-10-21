import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchExperience } from "@/components/search/search-experience";
import { Skeleton } from "@/components/ui/skeleton";
import { getSessionUser } from "@/lib/auth/session";
import { getPreferences } from "@/lib/preferences";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Search" };

const FALLBACK_TRENDING = ["biryani", "pizza", "paneer tikka", "momos", "misal pav", "healthy bowl", "dosa", "cake"];

export default async function SearchPage() {
  const [user, prefs] = await Promise.all([getSessionUser(), getPreferences()]);
  const supabase = await getSupabaseServerClient();
  const [{ data: trending }, recent] = await Promise.all([
    supabase.rpc("trending_searches", { days: 7, lim: 8 }),
    user
      ? supabase.from("search_history").select("query, created_at").order("created_at", { ascending: false }).limit(30).then((r) => r.data ?? [])
      : Promise.resolve([]),
  ]);
  const recentUnique = [...new Map(recent.map((r) => [r.query.toLowerCase(), r.query])).values()].slice(0, 8);
  const trendingList = trending?.length ? trending.map((t) => t.query) : FALLBACK_TRENDING;
  return (
    <Suspense fallback={<Skeleton className="h-12 w-full" />}>
      <SearchExperience recent={recentUnique} trending={trendingList} loggedIn={Boolean(user)} vegMode={prefs.vegMode} />
    </Suspense>
  );
}
