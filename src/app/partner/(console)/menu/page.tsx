import { Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { MenuManager } from "@/components/partner/menu/menu-manager";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getPartnerContext } from "@/lib/partner/context";
import { loadPartnerMenu } from "@/lib/partner/menu-data";

export const metadata: Metadata = { title: "Menu" };

export default async function PartnerMenuPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { current } = await getPartnerContext("/partner/menu");
  const { view } = await searchParams;
  if (!current) {
    return (
      <>
        <PageHeader title="Menu" description="Categories, items, variants and stock." />
        <EmptyState
          icon={Store}
          title="No outlet yet"
          description="Register your restaurant to start building its menu."
          action={
            <Button asChild>
              <Link href="/partner/onboarding">Add your restaurant</Link>
            </Button>
          }
        />
      </>
    );
  }
  const { categories, items } = await loadPartnerMenu(current.id);
  return (
    <>
      <PageHeader title="Menu" description={`Categories, items, variants and stock for ${current.name}.`} />
      <MenuManager
        key={current.id}
        restaurant={{ id: current.id, name: current.name, slug: current.slug }}
        categories={categories}
        items={items}
        initialView={view === "inventory" ? "inventory" : "menu"}
      />
    </>
  );
}
