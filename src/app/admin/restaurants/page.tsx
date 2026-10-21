import { Store } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Restaurants" };

export default function AdminRestaurantsPage() {
  return (
    <>
      <PageHeader title="Restaurants" description="Approve, edit, suspend and set commission." />
      <EmptyState icon={Store} title="No restaurants yet" description="Restaurant applications and live outlets appear here." />
    </>
  );
}
