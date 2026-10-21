import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { RateOrderForm } from "@/components/orders/rate-order-form";
import { PageHeader } from "@/components/shared/page-header";
import { requireUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Rate your order" };

export default async function RateOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/orders/${id}/rate`);
  const supabase = await getSupabaseServerClient();
  const { data: o } = await supabase.from("orders").select("id, status, order_number, rider_id, restaurants(name), reviews(id)").eq("id", id).maybeSingle();
  if (!o) notFound();
  if (o.status !== "DELIVERED" || o.reviews) redirect(`/orders/${id}`);
  // Rider name comes from the order's event log (riders aren't visible once the delivery is over).
  const { data: ev } = await supabase.from("order_events").select("note").eq("order_id", id).like("note", "%rider%:%").limit(1).maybeSingle();
  const riderName = o.rider_id ? (ev?.note?.split(":")[1]?.trim() ?? "your delivery partner") : null;
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Rate your order" description={`Order #${o.order_number}`} />
      <RateOrderForm orderId={o.id} userId={user.id} restaurantName={o.restaurants?.name ?? "the restaurant"} riderName={riderName} />
    </div>
  );
}
