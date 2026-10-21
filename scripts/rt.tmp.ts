import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!, anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
async function main() {
  const db = createClient(url, anon);
  await db.auth.signInWithPassword({ email: "owner@demo.in", password: "Demo@1234" });
  const { data: r } = await db.from("restaurants").select("id").eq("slug", "saffron-courtyard").single();
  db.channel("t1").on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${r!.id}` }, (p) => console.log("EVENT", p.eventType)).subscribe((s) => console.log("status", s));
  await new Promise((res) => setTimeout(res, 1500));
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: o } = await admin.from("orders").select("id").eq("restaurant_id", r!.id).limit(1).single();
  await admin.from("orders").update({ cooking_instructions: "rt " + Date.now() }).eq("id", o!.id);
  await new Promise((res) => setTimeout(res, 2500));
  process.exit(0);
}
main();
