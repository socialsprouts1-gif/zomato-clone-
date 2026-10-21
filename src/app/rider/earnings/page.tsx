import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Earnings" };

export default function RiderEarningsPage() {
  return (
    <>
      <PageHeader title="Earnings" description="Today, this week and this month." />
      <EmptyState icon={Wallet} title="No earnings yet" description="Complete deliveries to see your per-order breakdown and incentives." />
    </>
  );
}
