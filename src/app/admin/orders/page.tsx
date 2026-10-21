import { ListChecks } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Orders" };

export default function AdminOrdersPage() {
  return (
    <>
      <PageHeader title="Orders" description="Search, inspect, reassign and refund." />
      <EmptyState icon={ListChecks} title="No orders yet" description="Orders across the platform appear here." />
    </>
  );
}
