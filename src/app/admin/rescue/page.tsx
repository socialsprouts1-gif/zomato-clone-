import type { Metadata } from "next";
import Link from "next/link";
import { parsePage, type ListParams } from "@/components/admin/restaurants/list-controls";
import { DonationsPanel } from "@/components/admin/rescue/donations-panel";
import { EventsPanel } from "@/components/admin/rescue/events-panel";
import { RescueLog } from "@/components/admin/rescue/rescue-log";
import { PageHeader } from "@/components/shared/page-header";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Food Rescue & events" };

const TABS = [
  { value: "rescue", label: "Food Rescue" },
  { value: "donations", label: "Donations" },
  { value: "events", label: "Events" },
] as const;
type Tab = (typeof TABS)[number]["value"];

export default async function AdminRescuePage({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; status?: string; page?: string }> }) {
  const sp = await searchParams;
  const tab: Tab = TABS.some((t) => t.value === sp.tab) ? (sp.tab as Tab) : "rescue";
  const page = parsePage(sp.page);
  const db = await getSupabaseServerClient();
  const params: ListParams = { tab: tab === "rescue" ? undefined : tab, q: sp.q?.trim().slice(0, 60) || undefined, status: sp.status, page: sp.page };

  return (
    <>
      <PageHeader title="Food Rescue & events" description="Rescued meals, Feeding India donations and event listings." />
      <nav aria-label="Section" className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <ul className="inline-flex gap-1 rounded-2xl bg-muted p-1">
          {TABS.map((t) => (
            <li key={t.value}>
              <Link
                href={t.value === "rescue" ? "/admin/rescue" : `/admin/rescue?tab=${t.value}`}
                aria-current={tab === t.value ? "page" : undefined}
                className={cn("inline-flex rounded-xl px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-muted-foreground transition focus-visible:ring-2 focus-visible:ring-ring", tab === t.value && "bg-card text-foreground shadow-sm")}
              >
                {t.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {tab === "rescue" ? <RescueLog db={db} params={params} page={page} /> : null}
      {tab === "donations" ? <DonationsPanel db={db} params={params} page={page} /> : null}
      {tab === "events" ? <EventsPanel db={db} /> : null}
    </>
  );
}
