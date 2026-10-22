import { ArrowLeft, Receipt, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { fmtDate, fmtDateTime } from "@/components/admin/restaurants/list-controls";
import { ROLE_LABEL } from "@/components/admin/users/roles";
import { BlockControls, CreditWalletDialog } from "@/components/admin/users/user-panels";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { assertAdmin } from "@/lib/admin/guard";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { cn, formatPaise } from "@/lib/utils";

export const metadata: Metadata = { title: "User" };

const TXN_LABEL: Record<string, string> = {
  topup: "Top-up",
  order_payment: "Order payment",
  refund: "Refund",
  referral_bonus: "Referral bonus",
  admin_credit: "Admin credit",
  cashback: "Cashback",
  gold_purchase: "Gold membership",
  event_ticket: "Event ticket",
  dining_bill: "Dining bill",
  ad_budget: "Ad budget",
  adjustment: "Adjustment",
};
const ACTION_LABELS: Record<string, string> = { "user.block": "Blocked", "user.unblock": "Unblocked", "wallet.credit": "Wallet credit" };

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium break-words">{value || "–"}</dd>
    </div>
  );
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const admin = await assertAdmin();
  const supabase = await getSupabaseServerClient();
  const { data: u } = await supabase.from("profiles").select("*").eq("id", id).maybeSingle();
  if (!u) notFound();

  const [{ data: wallet }, { data: txns }, { data: orders, count: orderCount }, { data: owned }, { data: rider }, { data: history }] = await Promise.all([
    supabase.from("wallets").select("balance_paise").eq("user_id", id).maybeSingle(),
    supabase.from("wallet_transactions").select("id, amount_paise, type, description, balance_after_paise, created_at").eq("user_id", id).order("created_at", { ascending: false }).limit(20),
    supabase
      .from("orders")
      .select("id, order_number, status, total_paise, created_at, restaurants(name)", { count: "exact" })
      .eq("customer_id", id)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("restaurants").select("id, name, status").eq("owner_id", id),
    supabase.from("riders").select("id, status").eq("id", id).maybeSingle(),
    supabase.from("admin_audit_log").select("id, action, details, created_at").eq("entity_type", "user").eq("entity_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  const name = u.name || u.email || "this user";
  const blockReason = u.is_blocked ? (history ?? []).find((h) => h.action === "user.block") : undefined;

  return (
    <>
      <Link href="/admin/users" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> Users
      </Link>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold tracking-tight">{u.name || "Unnamed user"}</h1>
            <Badge variant="secondary">{ROLE_LABEL[u.role]}</Badge>
            {u.is_blocked ? (
              <Badge variant="destructive" data-testid="user-blocked">
                Blocked
              </Badge>
            ) : null}
            {u.deleted_at ? <Badge variant="outline">Deleted account</Badge> : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {[u.email, u.phone].filter(Boolean).join(" · ") || "No contact details"} · joined {fmtDate(u.created_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <CreditWalletDialog id={u.id} name={name} />
          {u.id !== admin.id && u.role !== "admin" ? <BlockControls id={u.id} name={name} blocked={u.is_blocked} /> : null}
        </div>
      </div>

      {blockReason ? (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
          <span className="font-semibold">Block reason:</span> {String((blockReason.details as { reason?: string })?.reason ?? "")}
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-6">
          <Card className="p-0">
            <h2 className="flex items-center gap-2 px-5 pt-5 pb-3 font-display text-lg font-semibold">
              <Receipt className="size-5 text-primary" aria-hidden /> Orders <span className="text-sm font-normal text-muted-foreground">({orderCount ?? 0})</span>
            </h2>
            {orders?.length ? (
              <ul className="divide-y border-t" aria-label="Orders">
                {orders.map((o) => (
                  <li key={o.id}>
                    <Link href={`/admin/orders/${o.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-muted/30">
                      <span className="min-w-0">
                        <span className="font-semibold">#{o.order_number}</span> · {(o.restaurants as { name: string } | null)?.name ?? "Restaurant"}
                        <span className="block text-xs text-muted-foreground">{fmtDateTime(o.created_at)}</span>
                      </span>
                      <span className="text-right">
                        <span className="block font-semibold tabular-nums">{formatPaise(o.total_paise)}</span>
                        <span className="block text-xs text-muted-foreground">{o.status.replaceAll("_", " ").toLowerCase()}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-5 text-sm text-muted-foreground">No orders yet.</p>
            )}
          </Card>

          <Card className="p-0">
            <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-3">
              <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                <Wallet className="size-5 text-primary" aria-hidden /> Wallet
              </h2>
              <p className="font-display text-xl font-bold tabular-nums" data-testid="wallet-balance">
                {formatPaise(Number(wallet?.balance_paise ?? 0))}
              </p>
            </div>
            {txns?.length ? (
              <ul className="divide-y border-t" aria-label="Wallet transactions">
                {txns.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm" data-testid="wallet-txn">
                    <span className="min-w-0">
                      <span className="font-medium">{t.description}</span>
                      <span className="block text-xs text-muted-foreground">
                        {TXN_LABEL[t.type] ?? t.type} · {fmtDateTime(t.created_at)}
                      </span>
                    </span>
                    <span className="text-right tabular-nums">
                      <span className={cn("block font-semibold", Number(t.amount_paise) > 0 ? "text-success" : "")}>
                        {Number(t.amount_paise) > 0 ? "+" : "−"}
                        {formatPaise(Math.abs(Number(t.amount_paise)))}
                      </span>
                      <span className="block text-xs text-muted-foreground">Bal {formatPaise(Number(t.balance_after_paise))}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 pb-5 text-sm text-muted-foreground">No wallet activity yet.</p>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <h2 className="mb-4 font-display text-lg font-semibold">Profile</h2>
            <dl className="grid gap-4">
              <Field label="Email" value={u.email} />
              <Field label="Phone" value={u.phone} />
              <Field label="Diet" value={u.dietary_preference === "none" ? "No preference" : u.dietary_preference.replace("_", "-")} />
              <Field label="Language" value={u.language === "hi" ? "Hindi" : "English"} />
              <Field label="Referral code" value={u.referral_code} />
            </dl>
            {owned?.length || rider ? (
              <div className="mt-5 space-y-2">
                <h3 className="text-sm font-semibold">Linked</h3>
                <div className="flex flex-wrap gap-2">
                  {(owned ?? []).map((r) => (
                    <Button key={r.id} asChild variant="outline" size="sm">
                      <Link href={`/admin/restaurants/${r.id}`}>{r.name}</Link>
                    </Button>
                  ))}
                  {rider ? (
                    <Button asChild variant="outline" size="sm">
                      <Link href={`/admin/riders/${rider.id}`}>Rider profile</Link>
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
          </Card>
          <Card className="p-5">
            <h2 className="mb-3 font-display text-lg font-semibold">Admin history</h2>
            {history?.length ? (
              <ol className="space-y-2 text-sm">
                {history.map((h) => {
                  const d = h.details as { reason?: string; note?: string; amount_paise?: number };
                  return (
                    <li key={h.id}>
                      <span className="font-medium">
                        {ACTION_LABELS[h.action] ?? h.action}
                        {d?.amount_paise ? ` · ${formatPaise(d.amount_paise)}` : ""}
                      </span>
                      <span className="text-muted-foreground"> · {fmtDateTime(h.created_at)}</span>
                      {d?.reason || d?.note ? <p className="text-xs text-muted-foreground">{d.reason ?? d.note}</p> : null}
                    </li>
                  );
                })}
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
