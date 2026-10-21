import { ShoppingBag } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Your orders" };

export default function OrdersPage() {
  return (
    <>
      <PageHeader title="Your orders" description="Track live orders and see past ones." />
      <EmptyState icon={ShoppingBag} title="No orders yet" description="When you place an order, you can track it live from here." />
    </>
  );
}
