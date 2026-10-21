import { Store } from "lucide-react";
import { LiveOrdersBoard } from "@/components/partner/live-orders-board";
import { OutletStatusControls } from "@/components/partner/outlet-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { getPartnerContext } from "@/lib/partner/context";
import { loadLiveOrders } from "@/lib/partner/orders";

export default async function PartnerLiveOrdersPage() {
  const { current } = await getPartnerContext("/partner");
  if (!current) {
    return (
      <>
        <PageHeader title="Live orders" />
        <EmptyState icon={Store} title="No outlet yet" description="Register your restaurant to start receiving orders." />
      </>
    );
  }
  if (current.status !== "approved") {
    return (
      <>
        <PageHeader title="Live orders" description={current.name} />
        <EmptyState icon={Store} title="Your restaurant is under review" description="Our team usually approves new restaurants within a day. You'll be notified as soon as you go live." />
      </>
    );
  }
  const orders = await loadLiveOrders(current.id);
  return (
    <>
      <PageHeader title="Live orders" description={`${current.name} · ${current.locality}`} actions={<OutletStatusControls outlet={current} />} />
      <LiveOrdersBoard key={current.id} restaurantId={current.id} restaurantName={current.name} initial={orders} />
    </>
  );
}
