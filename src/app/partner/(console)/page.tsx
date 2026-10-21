import { ClipboardList } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

const tabs = ["New", "Preparing", "Ready", "Picked up", "Past orders"];

export default function PartnerLiveOrdersPage() {
  return (
    <>
      <PageHeader title="Live orders" description="New orders ring here. Accept, prepare and hand over to the rider." />
      <div role="tablist" aria-label="Order status" className="mb-4 flex gap-2 overflow-x-auto">
        {tabs.map((t, i) => (
          <span
            key={t}
            role="tab"
            aria-selected={i === 0}
            className={
              i === 0
                ? "rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-primary-foreground"
                : "rounded-full border bg-card px-4 py-1.5 text-sm font-medium text-muted-foreground"
            }
          >
            {t}
          </span>
        ))}
      </div>
      <EmptyState icon={ClipboardList} title="No new orders" description="You'll hear a chime when a customer places an order." />
    </>
  );
}
