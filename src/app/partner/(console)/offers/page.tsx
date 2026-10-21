import { Megaphone } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Offers & ads" };

export default function PartnerOffersPage() {
  return (
    <>
      <PageHeader title="Offers & ads" description="Discounts and sponsored listings." />
      <EmptyState icon={Megaphone} title="No offers running" description="Create a discount or a sponsored listing to bring in more orders." />
    </>
  );
}
