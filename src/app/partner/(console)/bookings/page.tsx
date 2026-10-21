import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";

export const metadata: Metadata = { title: "Table bookings" };

export default function PartnerBookingsPage() {
  return (
    <>
      <PageHeader title="Table bookings" description="Confirm or decline dine-in bookings." />
      <EmptyState icon={CalendarCheck} title="No bookings yet" description="Dine-in bookings from customers show up here." />
    </>
  );
}
