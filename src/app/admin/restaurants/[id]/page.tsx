import { ArrowLeft, ExternalLink, FileText, ImageIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDate, fmtDateTime, statusBadge } from "@/components/admin/restaurants/list-controls";
import { CollectionsMembership, CommissionForm, RestaurantCoreForm, RestaurantStatusActions } from "@/components/admin/restaurants/restaurant-panels";
import { FoodImage } from "@/components/shared/food-image";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { assertAdmin } from "@/lib/admin/guard";
import { signedDocUrl } from "@/lib/storage/private-docs";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "Restaurant" };

const DOC_LABELS: Record<string, string> = { fssai_licence: "FSSAI licence", gst_certificate: "GST certificate", cancelled_cheque: "Cancelled cheque" };
const ACTION_LABELS: Record<string, string> = {
  "restaurant.approve": "Approved",
  "restaurant.reject": "Rejected",
  "restaurant.suspend": "Suspended",
  "restaurant.unsuspend": "Suspension lifted",
  "restaurant.commission": "Commission changed",
  "restaurant.update": "Details edited",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{value || "–"}</dd>
    </div>
  );
}

export default async function AdminRestaurantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  await assertAdmin();
  const supabase = await getSupabaseServerClient();
  const { data: r } = await supabase.from("restaurants").select("*").eq("id", id).maybeSingle();
  if (!r) notFound();

  const [{ data: priv }, { data: photos }, { data: collections }, { data: history }, { count: orders }, { data: delivered }] = await Promise.all([
    supabase.from("restaurant_private").select("*").eq("restaurant_id", id).maybeSingle(),
    supabase.from("restaurant_photos").select("id, url, caption, kind").eq("restaurant_id", id).order("sort").limit(12),
    supabase.from("collections").select("id, title, sort, collection_items(restaurant_id)").eq("is_curated", true).order("sort"),
    supabase.from("admin_audit_log").select("id, action, details, created_at").eq("entity_type", "restaurant").eq("entity_id", id).order("created_at", { ascending: false }).limit(10),
    supabase.from("orders").select("id", { count: "exact", head: true }).eq("restaurant_id", id),
    supabase.from("orders").select("total_paise").eq("restaurant_id", id).eq("status", "DELIVERED").limit(5000),
  ]);
  const docs = Object.entries((priv?.documents ?? {}) as Record<string, string>);
  const signedDocs = await Promise.all(docs.map(async ([k, v]) => ({ key: k, label: DOC_LABELS[k] ?? k, url: await signedDocUrl("restaurant-docs", v) })));
  const gmv = (delivered ?? []).reduce((s, o) => s + o.total_paise, 0);
  const b = statusBadge[r.status]!;
  const lastReason = (history ?? []).find((h) => h.action === "restaurant.reject" || h.action === "restaurant.suspend");

  return (
    <>
      <Link href="/admin/restaurants" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Restaurants
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="relative size-14 shrink-0 overflow-hidden rounded-2xl border">
            <FoodImage src={r.logo_url ?? r.cover_image_url} alt="" name={r.name} sizes="56px" className="absolute inset-0" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-bold tracking-tight">{r.name}</h1>
              <Badge variant={b.variant} data-testid="restaurant-status">
                {b.label}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              {r.locality}, {r.city} · {r.cuisines.join(", ")} · joined {fmtDate(r.created_at)}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {r.status === "approved" ? (
            <Button asChild variant="outline">
              <Link href={`/restaurant/${r.slug}`} target="_blank">
                <ExternalLink aria-hidden /> View on app
              </Link>
            </Button>
          ) : null}
          <RestaurantStatusActions id={r.id} name={r.name} status={r.status} />
        </div>
      </div>

      {lastReason && (r.status === "rejected" || r.status === "suspended") ? (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span className="font-semibold">{r.status === "rejected" ? "Rejection" : "Suspension"} reason:</span> {String((lastReason.details as { reason?: string })?.reason ?? "")}
        </p>
      ) : null}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Orders", value: String(orders ?? 0) },
          { label: "Delivered GMV", value: formatPaise(gmv) },
          { label: "Rating", value: r.rating_count ? `${Number(r.rating_delivery).toFixed(1)} (${r.rating_count})` : "No ratings" },
          { label: "Commission", value: `${Number(r.commission_pct)}%` },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="font-display text-lg font-bold tabular-nums">{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">Edit outlet</h2>
            <RestaurantCoreForm
              id={r.id}
              defaults={{
                name: r.name,
                cuisines: r.cuisines,
                locality: r.locality,
                cost_for_two_paise: r.cost_for_two_paise,
                is_pure_veg: r.is_pure_veg,
                is_featured: r.is_featured,
                gold_partner: r.gold_partner,
                dining_enabled: r.dining_enabled,
              }}
            />
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">Onboarding details</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Owner" value={priv?.owner_name} />
              <Field label="Owner email" value={priv?.owner_email} />
              <Field label="Owner phone" value={priv?.owner_phone} />
              <Field label="Outlet phone" value={r.phone} />
              <Field label="GSTIN" value={priv?.gst_number} />
              <Field label="PAN" value={priv?.pan_number} />
              <Field label="FSSAI" value={r.fssai} />
              <Field label="Bank account" value={priv ? [priv.bank_account_name, priv.bank_account_number_masked].filter(Boolean).join(" · ") : null} />
              <Field label="IFSC" value={priv?.bank_ifsc} />
              <Field label="Address" value={r.address} />
            </dl>
          </Card>

          <Card className="p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">Documents & photos</h2>
            {signedDocs.length ? (
              <ul className="mb-4 flex flex-wrap gap-2">
                {signedDocs.map((d) => (
                  <li key={d.key}>
                    {d.url ? (
                      <Button asChild variant="outline" size="sm">
                        <a href={d.url} target="_blank" rel="noreferrer">
                          <FileText aria-hidden /> {d.label}
                        </a>
                      </Button>
                    ) : (
                      <span className="text-sm text-muted-foreground">{d.label} (file missing)</span>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-4 text-sm text-muted-foreground">No documents uploaded.</p>
            )}
            {[r.cover_image_url, ...(photos ?? []).map((p) => p.url)].filter(Boolean).length ? (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {r.cover_image_url ? (
                  <li className="relative aspect-square overflow-hidden rounded-xl border">
                    <FoodImage src={r.cover_image_url} alt="Cover photo" name={r.name} sizes="160px" className="absolute inset-0" />
                    <span className="absolute bottom-1 left-1 rounded bg-black/60 px-1.5 text-[10px] text-white">Cover</span>
                  </li>
                ) : null}
                {(photos ?? []).map((p) => (
                  <li key={p.id} className="relative aspect-square overflow-hidden rounded-xl border">
                    <FoodImage src={p.url} alt={p.caption ?? `${p.kind} photo`} name={r.name} sizes="160px" className="absolute inset-0" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <ImageIcon className="size-4" aria-hidden /> No photos yet.
              </p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-3 font-display text-lg font-semibold">Commission</h2>
            <CommissionForm id={r.id} pct={Number(r.commission_pct)} />
          </Card>
          <Card className="p-5">
            <h2 className="mb-1 font-display text-lg font-semibold">Curated collections</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Feature this outlet in home collections. Create or reorder collections in <Link href="/admin/content" className="underline">Content</Link>.
            </p>
            {collections?.length ? (
              <CollectionsMembership
                id={r.id}
                collections={collections.map((c) => ({ id: c.id, title: c.title, count: c.collection_items.length, member: c.collection_items.some((i) => i.restaurant_id === r.id) }))}
              />
            ) : (
              <p className="text-sm text-muted-foreground">No curated collections yet.</p>
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
