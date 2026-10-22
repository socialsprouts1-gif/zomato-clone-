import type { Metadata } from "next";
import { CouponsManager, type CouponUsage } from "@/components/admin/coupons/coupons-manager";
import { ListToolbar, Pager } from "@/components/admin/coupons/list-toolbar";
import { PageHeader } from "@/components/shared/page-header";
import { assertAdmin } from "@/lib/admin/guard";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Coupons" };

const PAGE_SIZE = 20;
const FILTERS = [
  { value: "", label: "All coupons" },
  { value: "active", label: "Active" },
  { value: "inactive", label: "Inactive" },
  { value: "expired", label: "Expired" },
];

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminCouponsPage({ searchParams }: { searchParams: SP }) {
  await assertAdmin();
  const sp = await searchParams;
  const q = one(sp.q).trim().slice(0, 40);
  const status = one(sp.status);
  const page = Math.max(1, Number.parseInt(one(sp.page), 10) || 1);
  const db = getSupabaseAdminClient();
  const now = new Date().toISOString();

  let query = db.from("coupons").select("*", { count: "exact" });
  if (q) {
    const safe = q.replace(/[%,()*]/g, " ");
    query = query.or(`code.ilike.%${safe}%,title.ilike.%${safe}%`);
  }
  if (status === "active") query = query.eq("is_active", true).or(`valid_until.is.null,valid_until.gt.${now}`);
  if (status === "inactive") query = query.eq("is_active", false);
  if (status === "expired") query = query.lt("valid_until", now);
  const [{ data: coupons, count }, { data: restaurants }] = await Promise.all([
    query.order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1),
    db.from("restaurants").select("id, name").order("name"),
  ]);

  const ids = (coupons ?? []).map((c) => c.id);
  const { data: redemptions } = ids.length ? await db.from("coupon_redemptions").select("coupon_id, discount_paise").in("coupon_id", ids) : { data: [] };
  const usage: Record<string, CouponUsage> = {};
  for (const r of redemptions ?? []) {
    if (!r.coupon_id) continue;
    const u = (usage[r.coupon_id] ??= { orders: 0, discountPaise: 0 });
    u.orders += 1;
    u.discountPaise += r.discount_paise;
  }

  return (
    <>
      <PageHeader title="Coupons" description="Platform-wide coupons customers can apply at checkout." />
      <ListToolbar placeholder="Search by code or title" searchLabel="Search coupons" filters={FILTERS} />
      <CouponsManager coupons={coupons ?? []} usage={usage} restaurants={restaurants ?? []} hasFilters={Boolean(q || status)} />
      <Pager page={page} pageSize={PAGE_SIZE} total={count ?? 0} params={{ q, status }} />
    </>
  );
}
