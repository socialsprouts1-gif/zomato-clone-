import { OverviewDashboard } from "@/components/admin/overview/overview-dashboard";
import { PageHeader } from "@/components/shared/page-header";
import { currentDemoOrderId } from "@/lib/admin/demo";
import { fetchOverview } from "@/lib/admin/overview";
import { requireRole } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage() {
  await requireRole(["admin"], "/admin");
  const [overview, demoOrderId] = await Promise.all([fetchOverview(14), isDemoMode ? currentDemoOrderId() : Promise.resolve(null)]);
  return (
    <>
      <PageHeader title="Overview" description="Live view of orders, riders and restaurants across the platform." />
      <OverviewDashboard initial={overview} demo={{ enabled: isDemoMode, orderId: demoOrderId }} />
    </>
  );
}
