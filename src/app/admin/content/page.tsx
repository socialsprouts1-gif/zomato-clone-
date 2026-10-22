import type { Metadata } from "next";
import { BannersManager } from "@/components/admin/content/banners-manager";
import { CollectionsManager } from "@/components/admin/content/collections-manager";
import { ContentTabs } from "@/components/admin/content/content-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { assertAdmin } from "@/lib/admin/guard";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Banners & collections" };

export default async function AdminContentPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  await assertAdmin();
  const { tab } = await searchParams;
  const db = getSupabaseAdminClient();
  const now = new Date().toISOString();
  const [{ data: banners }, { data: collections }, { data: restaurants }, { data: coupons }] = await Promise.all([
    db.from("banners").select("*").order("sort").order("created_at"),
    db.from("collections").select("id, title, slug, description, image_url, sort, created_at, collection_items(restaurant_id)").eq("is_curated", true).order("sort").order("created_at"),
    db.from("restaurants").select("slug, name").eq("status", "approved").order("name"),
    db.from("coupons").select("code, title").eq("is_active", true).or(`valid_until.is.null,valid_until.gt.${now}`).order("code"),
  ]);
  const list = (collections ?? []).map(({ collection_items, ...c }) => ({ ...c, count: collection_items.length }));
  const options = {
    restaurants: restaurants ?? [],
    collections: list.filter((c) => c.slug).map((c) => ({ slug: c.slug!, title: c.title })),
    coupons: coupons ?? [],
  };

  return (
    <>
      <PageHeader title="Banners & collections" description="What customers see first: the home carousel and curated collections." />
      <ContentTabs
        tab={tab === "collections" ? "collections" : "banners"}
        counts={{ banners: banners?.length ?? 0, collections: list.length }}
        banners={<BannersManager banners={banners ?? []} options={options} />}
        collections={<CollectionsManager collections={list} />}
      />
    </>
  );
}
