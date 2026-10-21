import { History } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Trip history" };

export default function RiderHistoryPage() {
  return (
    <>
      <PageHeader title="Trip history" description="Every delivery you've completed." />
      <EmptyState icon={History} title="No trips yet" description="Your completed deliveries will be listed here." />
    </>
  );
}
