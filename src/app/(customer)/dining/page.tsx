import { UtensilsCrossed } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Dining out" };

export default function DiningPage() {
  return (
    <>
      <PageHeader title="Dining out" description="Book a table at the best places in town." />
      <EmptyState icon={UtensilsCrossed} title="Find a table" description="Dine-in restaurants and table booking appear here once the menu data is loaded." />
    </>
  );
}
