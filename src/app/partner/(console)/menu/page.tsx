import { UtensilsCrossed } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Menu" };

export default function PartnerMenuPage() {
  return (
    <>
      <PageHeader title="Menu" description="Categories, items, variants and stock." />
      <EmptyState icon={UtensilsCrossed} title="Your menu is empty" description="Add categories and items, or upload your menu." />
    </>
  );
}
