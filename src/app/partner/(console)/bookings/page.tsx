import { Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BookingsBoard, type BookingView } from "@/components/partner/bookings/bookings-board";
import { istToday } from "@/components/partner/bookings/format";
import { TablesManager, type TableView } from "@/components/partner/bookings/tables-manager";
import { PendingReview } from "@/components/partner/onboarding/pending-review";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getOutletRole, getPartnerContext } from "@/lib/partner/context";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Table bookings" };

export default async function PartnerBookingsPage() {
  const { current, user } = await getPartnerContext("/partner/bookings");
  if (!current) {
    return (
      <>
        <PageHeader title="Table bookings" />
        <EmptyState
          icon={Store}
          title="No outlet yet"
          description="Register your restaurant to take dine-in bookings."
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
        <PageHeader title="Table bookings" description={current.name} />
        <PendingReview outlets={[current]} />
      </>
    );
  }

  const supabase = await getSupabaseServerClient();
  const today = istToday();
  const since = istToday(new Date(Date.now() - 30 * 86400000));
  const [{ data: bookings }, { data: tables }, { data: outlet }, role] = await Promise.all([
    supabase
      .from("table_bookings")
      .select("id, booking_code, booking_date, time_slot, guests, status, special_request, customer_name, customer_phone, decline_reason, table_id, created_at")
      .eq("restaurant_id", current.id)
      .gte("booking_date", since)
      .order("booking_date")
      .order("time_slot"),
    supabase.from("restaurant_tables").select("id, label, section, seats, qr_token, is_active").eq("restaurant_id", current.id).order("section").order("label"),
    supabase.from("restaurants").select("dining_enabled").eq("id", current.id).single(),
    getOutletRole(user.id, user.profile.role, current.id),
  ]);

  return (
    <>
      <PageHeader title="Table bookings" description={`${current.name} · Confirm or decline dine-in bookings and manage your tables.`} />
      {outlet && !outlet.dining_enabled ? (
        <p className="mb-4 rounded-2xl border border-dashed bg-secondary/40 p-3 text-sm">
          Table booking is switched off for customers.{" "}
          <Link href="/partner/settings#profile" className="font-semibold text-primary underline-offset-2 hover:underline">
            Turn on dining in settings
          </Link>
        </p>
      ) : null}
      <div className="space-y-10">
        <BookingsBoard key={current.id} restaurantId={current.id} today={today} bookings={(bookings ?? []) as BookingView[]} tables={(tables ?? []) as TableView[]} />
        <TablesManager key={`t-${current.id}`} restaurantId={current.id} slug={current.slug} restaurantName={current.name} tables={(tables ?? []) as TableView[]} canEdit={role !== "order_taker" && role !== null} />
      </div>
    </>
  );
}
