import { Ticket } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Coupons & banners" };

export default function AdminCouponsPage() {
  return (
    <>
      <PageHeader title="Coupons & banners" description="Platform coupons, home banners and collections." />
      <EmptyState icon={Ticket} title="No coupons yet" description="Create platform-wide coupons and manage the home carousel." />
    </>
  );
}
