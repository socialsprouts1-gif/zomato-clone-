import { Bike } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Riders" };

export default function AdminRidersPage() {
  return (
    <>
      <PageHeader title="Riders" description="Approve, suspend and see live locations." />
      <EmptyState icon={Bike} title="No riders yet" description="Rider applications and online riders appear here." />
    </>
  );
}
