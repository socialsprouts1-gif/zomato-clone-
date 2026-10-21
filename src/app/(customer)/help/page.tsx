import { ChevronRight, LifeBuoy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { NewTicketButton } from "@/components/support/new-ticket";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Help & support" };

const FAQ = [
  ["Where is my order?", "Open the order from the Orders tab to see the live map, rider location and ETA. You'll also get a notification at every step."],
  ["How do I cancel an order?", "You can cancel for free until the restaurant accepts. After that the food is already being cooked, so the order isn't refundable; it's offered nearby at a discount through Food Rescue instead of being wasted."],
  ["When will I get my refund?", "Refunds to your Thaali wallet are instant. Refunds to your bank or card take 3–5 working days."],
  ["What is the delivery OTP?", "A 4-digit code shown on your tracking screen. Share it with the rider only when they're at your door; it confirms the order reached you."],
  ["How does Thaali Gold work?", "Gold members get free delivery above ₹199 at Gold partner restaurants, extra discounts and dining offers. See the Gold page for plans."],
  ["Something was missing or wrong", "Start a chat below, pick the order and tell us what happened. We'll make it right."],
];

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ order?: string }> }) {
  const [user, { order }] = await Promise.all([requireUser("/help"), searchParams]);
  const supabase = await getSupabaseServerClient();
  const [{ data: orders }, { data: tickets }] = await Promise.all([
    supabase.from("orders").select("id, order_number, created_at, restaurants(name)").eq("customer_id", user.id).neq("status", "PENDING_PAYMENT").order("created_at", { ascending: false }).limit(10),
    supabase.from("support_tickets").select("id, subject, status, updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(20),
  ]);
  const options = (orders ?? []).map((o) => ({ id: o.id, label: `#${o.order_number} · ${o.restaurants?.name} · ${new Date(o.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` }));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title="Help & support" description="We're here 24×7." actions={<NewTicketButton orders={options} defaultOrderId={order} autoOpen={Boolean(order)} />} />
      {tickets?.length ? (
        <section>
          <h2 className="mb-2 font-semibold">Your conversations</h2>
          <Card className="divide-y">
            {tickets.map((t) => (
              <Link key={t.id} href={`/help/tickets/${t.id}`} className="flex items-center gap-3 p-4 hover:bg-accent/40">
                <LifeBuoy className="size-5 text-primary" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.subject}</span>
                  <span className="text-xs text-muted-foreground">Updated {new Date(t.updated_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                </span>
                <Badge variant={t.status === "resolved" ? "success" : t.status === "pending" ? "default" : "secondary"}>{t.status === "pending" ? "Support replied" : t.status}</Badge>
                <ChevronRight className="size-4 text-muted-foreground" />
              </Link>
            ))}
          </Card>
        </section>
      ) : null}
      <section>
        <h2 className="mb-2 font-semibold">Frequently asked questions</h2>
        <Card className="divide-y">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group p-4">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                {q} <ChevronRight className="size-4 transition group-open:rotate-90" />
              </summary>
              <p className="mt-2 text-sm text-muted-foreground">{a}</p>
            </details>
          ))}
        </Card>
      </section>
    </div>
  );
}
