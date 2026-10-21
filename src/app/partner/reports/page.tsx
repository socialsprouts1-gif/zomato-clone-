import { BarChart3 } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Business reports" };

export default function PartnerReportsPage() {
  return (
    <>
      <PageHeader title="Business reports" description="Sales, orders, top dishes and peak hours." />
      <EmptyState icon={BarChart3} title="No data yet" description="Reports fill in as orders come in." />
    </>
  );
}
