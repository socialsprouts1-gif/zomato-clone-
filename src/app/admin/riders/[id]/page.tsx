import { ArrowLeft, FileText } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDate, fmtDateTime, statusBadge } from "@/components/admin/restaurants/list-controls";
import { RiderLiveMap, RiderStatusActions } from "@/components/admin/riders/rider-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { assertAdmin } from "@/lib/admin/guard";
import { fetchRiderPosition } from "@/lib/admin/riders-actions";
import { signedDocUrl } from "@/lib/storage/private-docs";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Rider" };

const VEHICLE: Record<string, string> = { bicycle: "Bicycle", scooter: "Scooter", motorcycle: "Motorcycle", ev_scooter: "EV scooter" };
const ACTION_LABELS: Record<string, string> = { "rider.approve": "Approved", "rider.reject": "Rejected", "rider.suspend": "Suspended", "rider.unsuspend": "Suspension lifted" };

/** Start of today and of this week (Monday) in India time, as ISO strings. */
function istBoundaries() {
  const ist = new Date(Date.now() + 5.5 * 3600000);
  const day = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - 5.5 * 3600000;
  const week = day - ((ist.getUTCDay() + 6) % 7) * 86400000;
  return { today: new Date(day).toISOString(), week: new Date(week).toISOString() };
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{value || "–"}</dd>
    </div>
  );
}

export default async function AdminRiderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  await assertAdmin();
  const supabase = await getSupabaseServerClient();
  const { data: r } = await supabase.from("riders").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();

  const { today, week } = istBoundaries();
  const [{ data: priv }, { data: profile }, { data: earnings }, { count: trips }, { data: recent }, { data: history }, position] = await Promise.all([
    supabase.from("rider_private").select("*").eq("rider_id", id).maybeSingle(),
    supabase.from("profiles").select("email, is_blocked").eq("id", id).maybeSingle(),
    supabase.from("rider_earnings").select("total_paise, tip_paise, created_at").eq("rider_id", id).limit(10000),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("rider_id", id).eq("status", "DELIVERED"),
    supabase
      .from("orders")
      .select("id, order_number, status, delivered_at, created_at, distance_km, restaurants(name)")
      .eq("rider_id", id)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase.from("admin_audit_log").select("id, action, details, created_at").eq("entity_type", "rider").eq("entity_id", id).order("created_at", { ascending: false }).limit(10),
    fetchRiderPosition(id),
  ]);
  const [dl, rc] = await Promise.all([signedDocUrl("rider-docs", priv?.driving_license_url), signedDocUrl("rider-docs", priv?.vehicle_rc_url)]);
  const sum = (from?: string) => (earnings ?? []).filter((e) => !from || e.created_at >= from).reduce((s, e) => s + e.total_paise, 0);
  const tips = (earnings ?? []).reduce((s, e) => s + e.tip_paise, 0);
  const b = statusBadge[r.status]!;
  const lastReason = (history ?? []).find((h) => h.action === "rider.reject" || h.action === "rider.suspend");

  return (
    <>
      <Link href="/admin/riders" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Riders
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">{r.name}</h1>
            <Badge variant={b.variant} data-testid="rider-status">
              {r.status === "pending" ? "Applicant" : b.label}
            </Badge>
            {profile?.is_blocked ? <Badge variant="destructive">Account blocked</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {VEHICLE[r.vehicle_type]}
            {r.vehicle_number ? ` · ${r.vehicle_number}` : ""} · applied {fmtDate(r.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`/admin/users/${r.id}`}>User account</Link>
          </Button>
          <RiderStatusActions id={r.id} name={r.name} status={r.status} />
        </div>
      </div>

      {lastReason && (r.status === "rejected" || r.status === "suspended") ? (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span className="font-semibold">{r.status === "rejected" ? "Rejection" : "Suspension"} reason:</span> {String((lastReason.details as { reason?: string })?.reason ?? "")}
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5" aria-label="Trips and earnings">
        {[
          { label: "Trips delivered", value: String(trips ?? 0) },
          { label: "Earned today", value: formatPaise(sum(today)) },
          { label: "Earned this week", value: formatPaise(sum(week)) },
          { label: "Lifetime earnings", value: formatPaise(sum()) },
          { label: "Cash in hand", value: formatPaise(Number(r.floating_cash_paise)) },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="font-display text-lg font-bold tabular-nums">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 font-display text-lg font-semibold">Live location</h2>
            <RiderLiveMap riderId={r.id} initial={position} />
          </Card>
          <Card className="p-0">
            <h2 className="px-5 pt-5 pb-3 font-display text-lg font-semibold">Recent trips</h2>
            {recent?.length ? (
              <ul className="divide-y border-t">
                {recent.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-muted/30">
                      <span>
                        <span className="font-semibold">#{o.order_number}</span> · {(o.restaurants as { name: string } | null)?.name ?? "Restaurant"}
                        <span className="block text-xs text-muted-foreground">
                          {fmtDateTime(o.delivered_at ?? o.created_at)}
                          {o.distance_km ? ` · ${Number(o.distance_km).toFixed(1)} km` : ""}
                        </span>
                      </span>
                      <Badge variant={o.status === "DELIVERED" ? "success" : "outline"}>{o.status.replaceAll("_", " ").toLowerCase()}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-5 text-sm text-muted-foreground">No trips yet.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">Application</h2>
            <dl className="grid gap-4">
              <Field label="Phone" value={r.phone} />
              <Field label="Email" value={profile?.email} />
              <Field label="Bank account" value={priv ? [priv.bank_account_name, priv.bank_account_number_masked].filter(Boolean).join(" · ") : null} />
              <Field label="IFSC" value={priv?.bank_ifsc} />
              <Field label="Rating" value={r.rating_count ? `${Number(r.rating).toFixed(1)} from ${r.rating_count} ratings` : "No ratings yet"} />
              <Field label="Tips received" value={formatPaise(tips)} />
            </dl>
            <h3 className="mt-5 mb-2 text-sm font-semibold">Documents</h3>
            {dl || rc ? (
              <div className="flex flex-wrap gap-2">
                {dl ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={dl} target="_blank" rel="noreferrer">
                      <FileText aria-hidden /> Driving licence
                    </a>
                  </Button>
                ) : null}
                {rc ? (
                  <Button asChild variant="outline" size="sm">
                    <a href={rc} target="_blank" rel="noreferrer">
                      <FileText aria-hidden /> Vehicle RC
                    </a>
                  </Button>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No documents uploaded.</p>
            )}
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-display text-lg font-semibold">Admin history</h2>
            {history?.length ? (
              <ol className="space-y-2 text-sm">
                {history.map((h) => (
                  <li key={h.id}>
                    <span className="font-medium">{ACTION_LABELS[h.action] ?? h.action}</span>
                    <span className="text-muted-foreground"> · {fmtDateTime(h.created_at)}</span>
                    {(h.details as { reason?: string })?.reason ? <p className="text-xs text-muted-foreground">{(h.details as { reason: string }).reason}</p> : null}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">No admin actions yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
