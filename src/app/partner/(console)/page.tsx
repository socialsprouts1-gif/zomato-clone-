import { Store } from "lucide-react";
import Link from "next/link";
import { LiveOrdersBoard } from "@/components/partner/live-orders-board";
import { PendingReview } from "@/components/partner/onboarding/pending-review";
import { OutletStatusControls } from "@/components/partner/outlet-controls";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getPartnerContext } from "@/lib/partner/context";
import { loadLiveOrders } from "@/lib/partner/orders";

export default async function PartnerLiveOrdersPage() {
  const { current, user } = await getPartnerContext("/partner");
  if (!current) {
    return (
      <>
        <PageHeader title="Live orders" />
        <EmptyState
          icon={Store}
          title="No outlet yet"
          description="Register your restaurant to start receiving orders."
          action={
            <Button asChild>
              <Link href="/partner/onboarding">Register your restaurant</Link>
            </Button>
          }
        />
      </>
    );
  }
  if (current.status !== "approved") {
    return (
      <>
        <PageHeader title="Live orders" description={current.name} />
        <PendingReview outlets={[current]} />
      </>
    );
  }
  const orders = await loadLiveOrders(current.id);
  return (
    <>
      <PageHeader title="Live orders" description={`${current.name} · ${current.locality}`} actions={<OutletStatusControls outlet={current} />} />
      <LiveOrdersBoard key={current.id} restaurantId={current.id} restaurantName={current.name} initial={orders} me={user.id} />
    </>
  );
}
