import { Settings } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Settings" };

export default function PartnerSettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Outlet status, timings, staff and auto-accept." />
      <EmptyState icon={Settings} title="Outlet not set up" description="Register your restaurant to manage its settings." />
    </>
  );
}
