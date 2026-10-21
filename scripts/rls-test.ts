/**
 * Proves Row Level Security works end to end: signs in as each demo role through
 * Supabase Auth and checks what they can and cannot read or change.
 *   pnpm test:rls   (needs a seeded database + .env.local)
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !anonKey || !serviceKey) throw new Error("Missing Supabase env vars (see .env.example)");

const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failures++;
}
async function as(email: string): Promise<{ db: SupabaseClient; id: string }> {
  const db = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await db.auth.signInWithPassword({ email, password: "Demo@1234" });
  if (error || !data.user) throw new Error(`login ${email}: ${error?.message}`);
  return { db, id: data.user.id };
}

async function main() {
  const c1 = await as("customer@demo.in");
  const c2 = await as("customer2@demo.in");
  const owner = await as("owner@demo.in");
  const rider = await as("rider@demo.in");
  const adm = await as("admin@demo.in");
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });

  // Customers
  const own = await c1.db.from("orders").select("id, customer_id");
  check("customer reads own orders", (own.data?.length ?? 0) > 0 && own.data!.every((o) => o.customer_id === c1.id), `${own.data?.length} rows`);
  const theirs = await c1.db.from("orders").select("id").eq("customer_id", c2.id);
  check("customer cannot read another customer's orders", theirs.data?.length === 0, `${theirs.data?.length} rows`);
  const { data: c2Order } = await admin.from("orders").select("id").eq("customer_id", c2.id).limit(1).single();
  const items = await c1.db.from("order_items").select("id").eq("order_id", c2Order!.id);
  check("customer cannot read another customer's order items", items.data?.length === 0);
  const events = await c1.db.from("order_events").select("id").eq("order_id", c2Order!.id);
  check("customer cannot read another customer's order timeline", events.data?.length === 0);
  const addr = await c1.db.from("addresses").select("id").eq("user_id", c2.id);
  check("customer cannot read another customer's addresses", addr.data?.length === 0);
  const wallet = await c1.db.from("wallets").select("user_id, balance_paise");
  check("customer sees only own wallet", wallet.data?.length === 1 && wallet.data[0]!.user_id === c1.id);
  const profiles = await c1.db.from("profiles").select("id");
  check("customer sees only own profile", profiles.data?.length === 1);

  const { data: myOrder } = await c1.db.from("orders").select("id, status").limit(1).single();
  const upd = await c1.db.from("orders").update({ status: "DELIVERED", total_paise: 1 }).eq("id", myOrder!.id).select();
  check("customer cannot change order status or totals", (upd.data?.length ?? 0) === 0);
  const txn = await c1.db.from("wallet_transactions").insert({ user_id: c1.id, amount_paise: 100000, type: "topup", description: "free money", balance_after_paise: 100000 });
  check("customer cannot write wallet transactions", Boolean(txn.error));
  const rpc = await c1.db.rpc("wallet_apply", { p_user: c1.id, p_amount: 100000, p_type: "topup", p_description: "x" });
  check("customer cannot call wallet_apply", Boolean(rpc.error));
  const role = await c1.db.from("profiles").update({ role: "admin" }).eq("id", c1.id);
  check("customer cannot promote themselves to admin", Boolean(role.error));
  const coupon = await c1.db.from("coupons").insert({ code: "HACK", title: "x", discount_type: "flat", discount_value: 100000 });
  check("customer cannot create coupons", Boolean(coupon.error));

  // Restaurant owner
  const { data: myRestaurants } = await admin.from("restaurants").select("id").eq("owner_id", owner.id);
  const mine = new Set(myRestaurants!.map((r) => r.id));
  const ownerOrders = await owner.db.from("orders").select("restaurant_id");
  check("owner reads only their outlets' orders", (ownerOrders.data?.length ?? 0) > 0 && ownerOrders.data!.every((o) => mine.has(o.restaurant_id)), `${ownerOrders.data?.length} rows`);
  const privateRows = await owner.db.from("restaurant_private").select("restaurant_id");
  check("owner reads only their outlets' private details", privateRows.data!.every((r) => mine.has(r.restaurant_id)) && privateRows.data!.length === mine.size);
  const { data: otherItem } = await admin.from("menu_items").select("id, restaurant_id").not("restaurant_id", "in", `(${[...mine].join(",")})`).limit(1).single();
  const edit = await owner.db.from("menu_items").update({ price_paise: 1 }).eq("id", otherItem!.id).select();
  check("owner cannot edit another restaurant's menu", (edit.data?.length ?? 0) === 0);
  const approve = await owner.db.from("restaurants").update({ commission_pct: 1 }).in("id", [...mine]);
  check("owner cannot change their commission", Boolean(approve.error));

  // Rider
  const riderOrders = await rider.db.from("orders").select("rider_id");
  check("rider reads only assigned orders", (riderOrders.data?.length ?? 0) > 0 && riderOrders.data!.every((o) => o.rider_id === rider.id), `${riderOrders.data?.length} rows`);
  const riderAddr = await rider.db.from("addresses").select("id");
  check("rider cannot read customer address book", riderAddr.data?.length === 0);

  // Anonymous visitors
  const anonRestaurants = await anon.from("restaurants").select("status");
  check("visitors see approved restaurants only", (anonRestaurants.data?.length ?? 0) === 40 && anonRestaurants.data!.every((r) => r.status === "approved"));
  const anonOrders = await anon.from("orders").select("id");
  check("visitors cannot read orders", anonOrders.data?.length === 0);

  // Admin
  const { count: total } = await admin.from("orders").select("id", { count: "exact", head: true });
  const { count: adminCount } = await adm.db.from("orders").select("id", { count: "exact", head: true });
  check("admin reads every order", total === adminCount, `${adminCount}/${total}`);

  console.log(failures ? `\n${failures} check(s) failed` : "\nAll RLS checks passed");
  process.exit(failures ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
