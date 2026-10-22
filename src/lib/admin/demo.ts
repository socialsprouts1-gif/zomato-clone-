import "server-only";

import { finalizePaidOrder } from "@/lib/checkout/finalize";
import { computeQuote } from "@/lib/checkout/pricing";
import { isDemoMode } from "@/lib/env";
import { acceptOrder } from "@/lib/orders/actions-core";
import { tickOrders } from "@/lib/orders/simulation";
import { transition } from "@/lib/orders/state-machine";
import type { OrderStatus } from "@/lib/orders/status";
import { getSupabaseAdminClient } from "@/lib/supabase/server";

/**
 * "Run full demo": a real order for the demo customer at a seeded restaurant, walked through every
 * status by the same code paths the apps use (computeQuote → finalizePaidOrder → acceptOrder →
 * transition → tickOrders / simulated riders). Only the restaurant's role is played by the
 * driver here: it accepts after a few seconds and marks the food ready shortly after.
 *
 * Opening hours are bypassed for the demo order only (a presenter may run it at any hour):
 * the "closed right now" and time-of-day category errors from computeQuote are ignored.
 */
export const DEMO_CUSTOMER_EMAIL = "customer@demo.in";
export const DEMO_RESTAURANT_SLUG = "saffron-courtyard";
const PREFERRED_ITEMS = ["Hara Bhara Kebab", "Paneer Tikka", "Dal Makhani"];

/** Seconds the order waits on the partner board before the demo "restaurant" accepts it. */
const ACCEPT_AFTER_S = 6;
/** Seconds of "cooking" after acceptance before the food is marked ready. */
const READY_AFTER_S = 15;

const OPEN_HOURS_ERRORS = /closed right now|isn't available at this time/;
const DEMO_ACTIVE: OrderStatus[] = ["PLACED", "ACCEPTED", "PREPARING", "READY", "RIDER_ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY"];

const secondsSince = (iso: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 1000 : 0);

export class DemoError extends Error {}

/** The demo order still in flight (started in the last 20 minutes), if any. */
export async function currentDemoOrderId(): Promise<string | null> {
  const db = getSupabaseAdminClient();
  const { data } = await db
    .from("orders")
    .select("id")
    .eq("is_demo", true)
    .eq("source", "demo")
    .in("status", DEMO_ACTIVE)
    .gte("created_at", new Date(Date.now() - 20 * 60000).toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

/** Places the demo order (cash on delivery) and returns its id. Resumes a demo already in flight. */
export async function startDemoOrder(): Promise<{ orderId: string; resumed: boolean }> {
  if (!isDemoMode) throw new DemoError("The full demo runs only in demo mode.");
  const running = await currentDemoOrderId();
  if (running) return { orderId: running, resumed: true };

  const db = getSupabaseAdminClient();
  const [{ data: customer }, { data: restaurant }] = await Promise.all([
    db.from("profiles").select("id, name, phone, is_blocked").eq("email", DEMO_CUSTOMER_EMAIL).maybeSingle(),
    db.from("restaurants").select("id, name").eq("slug", DEMO_RESTAURANT_SLUG).eq("status", "approved").maybeSingle(),
  ]);
  if (!customer || customer.is_blocked) throw new DemoError(`The demo customer (${DEMO_CUSTOMER_EMAIL}) isn't available.`);
  if (!restaurant) throw new DemoError("The demo restaurant isn't available.");

  const [{ data: addresses }, { data: items }] = await Promise.all([
    db.from("addresses").select("*").eq("user_id", customer.id).order("is_default", { ascending: false }).order("created_at", { ascending: true }),
    db
      .from("menu_items")
      .select("id, name, price_paise, in_stock, stock_qty, is_deleted, item_variants(id), addon_groups(min_select)")
      .eq("restaurant_id", restaurant.id)
      .eq("is_deleted", false)
      .eq("in_stock", true)
      .order("price_paise"),
  ]);
  const address = addresses?.[0];
  if (!address) throw new DemoError("The demo customer has no saved address.");
  // Simple dishes only: no variant to choose and no required add-ons.
  const simple = (items ?? []).filter((i) => i.item_variants.length === 0 && i.addon_groups.every((g) => g.min_select === 0) && (i.stock_qty === null || i.stock_qty >= 2));
  const picked = PREFERRED_ITEMS.map((n) => simple.find((i) => i.name === n)).find(Boolean) ?? simple[0];
  if (!picked) throw new DemoError(`${restaurant.name} has no dish available for the demo.`);

  const input = { restaurantId: restaurant.id, lines: [{ itemId: picked.id, variantId: null, addonIds: [], qty: 2 }], addressId: address.id, paymentMethod: "cod" as const, tipPaise: 0, donationPaise: 0, useWallet: false };
  const quote = await computeQuote(input, customer.id);
  const blocking = quote.errors.filter((e) => !OPEN_HOURS_ERRORS.test(e));
  if (blocking.length) throw new DemoError(blocking[0]!);

  const b = quote.bill;
  const { data: order, error } = await db
    .from("orders")
    .insert({
      customer_id: customer.id,
      restaurant_id: restaurant.id,
      address_id: address.id,
      status: "PENDING_PAYMENT",
      source: "demo",
      is_demo: true,
      customer_name: customer.name,
      customer_phone: customer.phone,
      delivery_address: { label: address.custom_label || address.label, line1: [address.flat, address.line1].filter(Boolean).join(", "), landmark: address.landmark, area: address.area, lat: address.lat, lng: address.lng },
      delivery_instructions: address.instructions ? { directions: address.instructions } : {},
      distance_km: Number(quote.distanceKm.toFixed(2)),
      eta_minutes: quote.etaMinutes,
      item_total_paise: b.item_total_paise,
      delivery_fee_paise: b.delivery_fee_paise,
      platform_fee_paise: b.platform_fee_paise,
      packaging_fee_paise: b.packaging_fee_paise,
      gst_paise: b.gst_paise,
      tip_paise: b.tip_paise,
      discount_paise: b.discount_paise,
      donation_paise: b.donation_paise,
      total_paise: b.total_paise,
      wallet_used_paise: b.wallet_used_paise,
      payable_paise: b.payable_paise,
      gold_savings_paise: b.gold_savings_paise,
      payment_method: "cod",
      payment_status: "pending",
      is_gold_order: quote.isGold,
    })
    .select("*")
    .single();
  if (error || !order) throw new DemoError(error?.message ?? "Couldn't create the demo order");

  const { error: itemsError } = await db.from("order_items").insert(
    quote.lines.map((l) => ({ order_id: order.id, menu_item_id: l.itemId, name: l.name, variant_id: l.variantId, variant_name: l.variantName, addons: l.addons, quantity: l.qty, unit_price_paise: l.unitPaise, total_paise: l.totalPaise, is_veg: l.isVeg })),
  );
  if (itemsError) {
    await db.from("orders").delete().eq("id", order.id);
    throw new DemoError(`Couldn't save the demo items (${itemsError.message})`);
  }
  await db.from("order_events").insert({ order_id: order.id, from_status: null, to_status: "PENDING_PAYMENT", actor_id: null, actor_role: "system", note: "Run full demo · cash on delivery (opening hours bypassed)" });
  await finalizePaidOrder(order.id, null, { cod: true });
  return { orderId: order.id, resumed: false };
}

export type DemoProgress = {
  orderId: string;
  orderNumber: number;
  status: OrderStatus;
  restaurantName: string;
  riderName: string | null;
  createdAt: string;
  deliveredAt: string | null;
  steps: { status: OrderStatus; at: string }[];
};

/**
 * Plays the restaurant for the demo order (accept, then ready) and advances dispatch and the
 * simulated rider. Safe to call from several tabs at once: every step is a compare-and-set transition.
 */
export async function advanceDemo(orderId: string): Promise<DemoProgress | null> {
  const db = getSupabaseAdminClient();
  const { data: o } = await db.from("orders").select("id, status, is_demo, placed_at, accepted_at, restaurant_id, restaurants(avg_prep_minutes)").eq("id", orderId).maybeSingle();
  if (!o || !o.is_demo) return null;
  try {
    if (o.status === "PLACED" && secondsSince(o.placed_at) >= ACCEPT_AFTER_S) {
      await acceptOrder(o.id, o.restaurants?.avg_prep_minutes ?? 20, { role: "system", id: null }, "Demo: restaurant accepted");
    } else if (o.status === "PREPARING" && secondsSince(o.accepted_at) >= READY_AFTER_S) {
      await transition(o.id, "READY", { role: "system", id: null }, { note: "Demo: food packed", expectFrom: ["PREPARING"] });
    }
  } catch {
    // Someone (the partner tab, another poll) moved it first; the next poll continues.
  }
  await tickOrders(o.id);
  return demoProgress(o.id);
}

const DRIVER_KEY = Symbol.for("thaali.demoDrivers");
type DriverRegistry = Set<string>;

/**
 * Drives the demo order from the server every 2 s until it finishes (at most 5 minutes), so it
 * completes even if no screen is polling. Screens that poll (/api/admin/demo/tick, /api/sim/tick)
 * just make it smoother; every step is idempotent. On serverless hosts the loop may be cut short,
 * and then the polling screens carry it on.
 */
export function driveDemoInBackground(orderId: string) {
  const g = globalThis as unknown as Record<symbol, DriverRegistry | undefined>;
  const running = (g[DRIVER_KEY] ??= new Set<string>());
  if (running.has(orderId)) return;
  running.add(orderId);
  const deadline = Date.now() + 5 * 60000;
  const step = async () => {
    try {
      const p = await advanceDemo(orderId);
      if (!p || !DEMO_ACTIVE.includes(p.status) || Date.now() > deadline) {
        running.delete(orderId);
        return;
      }
    } catch {
      // transient database error: try again on the next beat
    }
    setTimeout(() => void step(), 2000);
  };
  setTimeout(() => void step(), 2000);
}

export async function demoProgress(orderId: string): Promise<DemoProgress | null> {
  const db = getSupabaseAdminClient();
  const [{ data: o }, { data: events }] = await Promise.all([
    db.from("orders").select("id, order_number, status, created_at, delivered_at, is_demo, restaurants(name), riders!orders_rider_id_fkey(name)").eq("id", orderId).maybeSingle(),
    db.from("order_events").select("to_status, from_status, created_at").eq("order_id", orderId).order("created_at"),
  ]);
  if (!o || !o.is_demo) return null;
  const steps = (events ?? []).filter((e) => e.from_status !== e.to_status).map((e) => ({ status: e.to_status, at: e.created_at }));
  return {
    orderId: o.id,
    orderNumber: o.order_number,
    status: o.status,
    restaurantName: o.restaurants?.name ?? "Restaurant",
    riderName: o.riders?.name ?? null,
    createdAt: o.created_at,
    deliveredAt: o.delivered_at,
    steps,
  };
}
