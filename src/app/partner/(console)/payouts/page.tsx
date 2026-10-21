import { Wallet } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Payouts" };

export default function PartnerPayoutsPage() {
  return (
    <>
      <PageHeader title="Payouts" description="Weekly statements after commission." />
      <EmptyState icon={Wallet} title="No payouts yet" description="Your first weekly statement appears after your first delivered order." />
    </>
  );
}
