import { Compass } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Zones & fees" };

export default function AdminSettingsPage() {
  return (
    <>
      <PageHeader title="Zones & fees" description="Delivery radius, fee slabs, platform fee and surge." />
      <EmptyState icon={Compass} title="Zones not configured" description="Set delivery zones and fee slabs for the city." />
    </>
  );
}
