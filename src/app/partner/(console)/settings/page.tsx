import { Eye, Store } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { HolidaysSection, KitchenForm, OpeningHoursEditor, OutletProfileForm } from "@/components/partner/settings/outlet-forms";
import { StaffSection, type StaffView } from "@/components/partner/settings/staff-section";
import { StatusSection } from "@/components/partner/settings/status-section";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getOutletRole, getPartnerContext } from "@/lib/partner/context";
import type { HoursInput } from "@/lib/partner/ops-actions";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Settings" };

function Section({ id, title, description, children }: { id: string; title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24 space-y-4 p-5" aria-labelledby={`${id}-title`} role="region">
      <div>
        <h2 id={`${id}-title`} className="font-display text-lg font-bold">
          {title}
        </h2>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {children}
    </Card>
  );
}

const ROLE_NOTE = { owner: "Owner", manager: "Manager", order_taker: "Order taker", admin: "Admin" } as const;

export default async function PartnerSettingsPage() {
  const { current, user } = await getPartnerContext("/partner/settings");
  if (!current) {
    return (
      <>
        <PageHeader title="Settings" />
        <EmptyState
          icon={Store}
          title="No outlet yet"
          description="Register your restaurant to manage its settings."
          action={
            <Button asChild>
              <Link href="/partner/onboarding">Register your restaurant</Link>
            </Button>
          }
        />
      </>
    );
  }
  const supabase = await getSupabaseServerClient();
  const [{ data: r }, { data: staffRows }, role] = await Promise.all([
    supabase
      .from("restaurants")
      .select("id, name, owner_id, is_online, busy_until, auto_accept, holidays, opening_hours, avg_prep_minutes, packaging_charge_paise, phone, description, dining_enabled")
      .eq("id", current.id)
      .single(),
    supabase.from("restaurant_staff").select("id, email, role, status, user_id").eq("restaurant_id", current.id).neq("status", "removed").order("created_at"),
    getOutletRole(user.id, user.profile.role, current.id),
  ]);
  if (!r || !role) {
    return (
      <>
        <PageHeader title="Settings" />
        <EmptyState icon={Store} title="Outlet unavailable" description="You no longer have access to this outlet. Pick another outlet from the switcher." />
      </>
    );
  }
  // Staff names: profiles are private to their owner, so read them with the service role after the team check above.
  const ids = [r.owner_id, ...(staffRows ?? []).map((s) => s.user_id)].filter((x): x is string => Boolean(x));
  const { data: people } = ids.length ? await getSupabaseAdminClient().from("profiles").select("id, name").in("id", ids) : { data: [] };
  const nameOf = (id: string | null) => (id ? (people ?? []).find((p) => p.id === id)?.name ?? null : null);
  const staff: StaffView[] = (staffRows ?? []).map((s) => ({ id: s.id, email: s.email, role: s.role, status: s.status, name: nameOf(s.user_id) }));
  const readOnly = role === "order_taker";

  return (
    <>
      <PageHeader title="Settings" description={`${current.name} · You're signed in as ${ROLE_NOTE[role].toLowerCase()}.`} />
      {readOnly ? (
        <p className="mb-4 flex items-center gap-2 rounded-2xl border border-dashed bg-secondary/40 p-3 text-sm">
          <Eye className="size-4 shrink-0 text-primary" aria-hidden /> Order takers can switch the outlet online, busy or auto-accept. Other settings are view-only; ask the owner or a manager to change them.
        </p>
      ) : null}
      <nav aria-label="Settings sections" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 text-sm [scrollbar-width:none] md:mx-0 md:px-0">
        {[
          ["status", "Status"],
          ["holidays", "Holidays"],
          ["hours", "Opening hours"],
          ["kitchen", "Kitchen"],
          ["profile", "Outlet profile"],
          ["staff", "Staff"],
        ].map(([id, label]) => (
          <a key={id} href={`#${id}`} className="shrink-0 rounded-full border bg-card px-3 py-1 font-medium text-muted-foreground hover:text-foreground">
            {label}
          </a>
        ))}
      </nav>
      <div className="grid gap-5 xl:grid-cols-2">
        <Section id="status" title="Outlet status" description="Go offline, pause orders for a while, or auto-accept new orders.">
          <StatusSection key={`${r.is_online}-${r.busy_until}-${r.auto_accept}`} restaurantId={r.id} isOnline={r.is_online} busyUntil={r.busy_until} autoAccept={r.auto_accept} />
        </Section>
        <Section id="holidays" title="Holidays" description="Customers see you as closed on these days.">
          <HolidaysSection restaurantId={r.id} holidays={r.holidays} readOnly={readOnly} />
        </Section>
        <div className="xl:col-span-2">
          <Section id="hours" title="Opening hours" description="Up to two shifts a day, for example lunch and dinner.">
            <OpeningHoursEditor restaurantId={r.id} initial={(r.opening_hours ?? {}) as Partial<HoursInput>} readOnly={readOnly} />
          </Section>
        </div>
        <Section id="kitchen" title="Kitchen">
          <KitchenForm key={`${r.avg_prep_minutes}-${r.packaging_charge_paise}`} restaurantId={r.id} prepMinutes={r.avg_prep_minutes} packagingPaise={r.packaging_charge_paise} readOnly={readOnly} />
        </Section>
        <Section id="profile" title="Outlet profile" description="Shown on your restaurant page.">
          <OutletProfileForm restaurantId={r.id} phone={r.phone ?? ""} description={r.description ?? ""} diningEnabled={r.dining_enabled} readOnly={readOnly} />
        </Section>
        <div className="xl:col-span-2">
          <Section id="staff" title="Staff" description="People who can use the partner app for this outlet.">
            <StaffSection restaurantId={r.id} staff={staff} ownerName={nameOf(r.owner_id) ?? "Owner"} canManage={role === "owner" || role === "admin"} />
          </Section>
        </div>
      </div>
    </>
  );
}
