import { ArrowLeft, ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CollectionRestaurantsEditor } from "@/components/admin/content/collection-restaurants-editor";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { assertAdmin } from "@/lib/admin/guard";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Collection" };

export default async function AdminCollectionPage({ params }: { params: Promise<{ id: string }> }) {
  await assertAdmin();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const db = getSupabaseAdminClient();
  const [{ data: c }, { data: restaurants }] = await Promise.all([
    db.from("collections").select("id, title, slug, description, collection_items(restaurant_id, sort)").eq("id", id).eq("is_curated", true).maybeSingle(),
    db.from("restaurants").select("id, name, locality, cuisines, cover_image_url, status").in("status", ["approved", "suspended"]).order("name"),
  ]);
  if (!c) notFound();
  const initial = [...c.collection_items].sort((a, b) => a.sort - b.sort).map((i) => i.restaurant_id);

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/content?tab=collections">
          <ArrowLeft /> Collections
        </Link>
      </Button>
      <PageHeader
        title={c.title}
        description={c.description ?? `Curated collection at /collections/${c.slug}`}
        actions={
          <Button asChild variant="outline">
            <Link href={`/collections/${c.slug}`} target="_blank">
              <ExternalLink /> View as customer
            </Link>
          </Button>
        }
      />
      <CollectionRestaurantsEditor key={initial.join()} collectionId={c.id} initial={initial} restaurants={restaurants ?? []} />
    </>
  );
}
