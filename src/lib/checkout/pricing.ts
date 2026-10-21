import "server-only";

import { getOpenState, isCategoryAvailable } from "@/lib/catalog/open-state";
import { estimateEtaMinutes, haversineKm } from "@/lib/geo";
import { getSupabaseAdminClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { quoteInputSchema, type Bill, type CouponView, type PricedLine, type Quote, type QuoteInput } from "./types";

type Db = ReturnType<typeof getSupabaseAdminClient>;
type Coupon = Tables<"coupons">;
type Offer = Tables<"restaurant_offers">;

const IST_HOUR = (d: Date) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", hour: "2-digit", hour12: false }).format(d)) % 24;

export async function isGoldMember(db: Db, userId: string | null) {
  if (!userId) return false;
  const { data } = await db.from("gold_memberships").select("id").eq("user_id", userId).eq("status", "active").gt("ends_at", new Date().toISOString()).limit(1);
  return Boolean(data?.length);
}

function slabFee(slabs: { min_km: number; max_km: number; fee_paise: number }[], km: number) {
  const s = slabs.find((x) => km >= Number(x.min_km) && km < Number(x.max_km)) ?? slabs.at(-1);
  return s?.fee_paise ?? 4000;
}

type Ctx = {
  userId: string | null;
  itemTotal: number;
  deliveryFee: number;
  restaurantId: string;
  isGold: boolean;
  paymentMethod: string;
  priorOrders: number;
  priorOrdersHere: number;
  lines: PricedLine[];
  bogoItemPrice: (itemId: string) => { qty: number; unit: number } | null;
};

/** Discount for a coupon/offer in this context, or a reason it doesn't apply. */
function evaluate(c: Coupon | Offer, kind: "platform" | "restaurant", ctx: Ctx, redemptionsByUser: number): { ok: boolean; reason?: string; discount: number; freeDelivery?: boolean; freeItemId?: string } {
  const now = new Date();
  if (!c.is_active) return { ok: false, reason: "This offer is no longer active", discount: 0 };
  if (c.valid_from && new Date(c.valid_from) > now) return { ok: false, reason: "This offer hasn't started yet", discount: 0 };
  if (c.valid_until && new Date(c.valid_until) < now) return { ok: false, reason: "This offer has expired", discount: 0 };
  if (ctx.itemTotal < c.min_order_paise) return { ok: false, reason: `Add items worth ₹${Math.ceil((c.min_order_paise - ctx.itemTotal) / 100)} more to use this`, discount: 0 };
  if (kind === "platform") {
    const p = c as Coupon;
    if (p.restaurant_id && p.restaurant_id !== ctx.restaurantId) return { ok: false, reason: "Not valid at this restaurant", discount: 0 };
    if (p.first_order_only && ctx.priorOrders > 0) return { ok: false, reason: "Only for your first order", discount: 0 };
    if (p.gold_only && !ctx.isGold) return { ok: false, reason: "Only for Gold members", discount: 0 };
    if (p.payment_method && p.payment_method !== ctx.paymentMethod) return { ok: false, reason: `Pay with ${p.payment_method.toUpperCase()} to use this`, discount: 0 };
    if (redemptionsByUser >= p.per_user_limit) return { ok: false, reason: "You've already used this offer", discount: 0 };
    if (p.total_limit !== null && p.used_count >= p.total_limit) return { ok: false, reason: "This offer is fully redeemed", discount: 0 };
  } else {
    const o = c as Offer;
    if (o.restaurant_id !== ctx.restaurantId) return { ok: false, reason: "Not valid at this restaurant", discount: 0 };
    if (o.applies_to === "dining") return { ok: false, reason: "Only for dine-in bills", discount: 0 };
    if (o.target === "new_users" && ctx.priorOrdersHere > 0) return { ok: false, reason: "Only for your first order here", discount: 0 };
    if (o.target === "gold" && !ctx.isGold) return { ok: false, reason: "Only for Gold members", discount: 0 };
  }
  switch (c.discount_type) {
    case "percent": {
      const raw = Math.floor((ctx.itemTotal * c.discount_value) / 100);
      return { ok: true, discount: c.max_discount_paise ? Math.min(raw, c.max_discount_paise) : raw };
    }
    case "flat":
      return { ok: true, discount: Math.min(c.discount_value, ctx.itemTotal) };
    case "free_delivery":
      return ctx.deliveryFee > 0 ? { ok: true, discount: ctx.deliveryFee, freeDelivery: true } : { ok: false, reason: "Delivery is already free", discount: 0 };
    case "bogo": {
      const itemId = (c as Offer).bogo_item_id;
      const b = itemId ? ctx.bogoItemPrice(itemId) : null;
      if (!b || b.qty < 2) return { ok: false, reason: "Add 2 of the offer item to use this", discount: 0 };
      return { ok: true, discount: Math.floor(b.qty / 2) * b.unit };
    }
    case "free_item": {
      const id = (c as Offer).free_item_id;
      return id ? { ok: true, discount: 0, freeItemId: id } : { ok: false, reason: "Offer item unavailable", discount: 0 };
    }
    default:
      return { ok: false, reason: "Unsupported offer", discount: 0 };
  }
}

/**
 * Computes the full bill on the server. Never trusts client prices.
 * Returns errors (e.g. out-of-stock) alongside the best-effort bill so the cart can explain them.
 */
export async function computeQuote(rawInput: QuoteInput, userId: string | null): Promise<Quote & { coupons: CouponView[] }> {
  const input = quoteInputSchema.parse(rawInput);
  const db = getSupabaseAdminClient();
  const errors: string[] = [];
  const now = new Date();
  const when = input.scheduledFor ? new Date(input.scheduledFor) : now;

  const [{ data: r }, { data: settings }, { data: slabs }, { data: items }, { data: cats }] = await Promise.all([
    db.from("restaurants").select("*").eq("id", input.restaurantId).single(),
    db.from("platform_settings").select("*").single(),
    db.from("fee_slabs").select("min_km, max_km, fee_paise").order("min_km"),
    db
      .from("menu_items")
      .select("id, category_id, name, price_paise, is_veg, in_stock, stock_qty, is_deleted, restaurant_id, item_variants(id, name, price_paise, in_stock), addon_groups(id, name, min_select, max_select, addons(id, name, price_paise, in_stock))")
      .in("id", [...new Set(input.lines.map((l) => l.itemId))]),
    db.from("menu_categories").select("id, available_from, available_to, available_days").eq("restaurant_id", input.restaurantId),
  ]);
  if (!r || r.status !== "approved") throw new Error("This restaurant isn't available");
  if (!settings) throw new Error("Platform settings missing");

  // Delivery location
  let dest = input.location ?? null;
  if (input.addressId && userId) {
    const { data: a } = await db.from("addresses").select("lat, lng, user_id").eq("id", input.addressId).single();
    if (a && a.user_id === userId) dest = { lat: a.lat, lng: a.lng };
  }
  const distanceKm = dest ? haversineKm(dest.lat, dest.lng, r.lat, r.lng) : 0;
  if (dest && distanceKm > Number(settings.max_delivery_km)) errors.push(`${r.name} doesn't deliver this far (${distanceKm.toFixed(1)} km). Choose a closer address.`);

  const open = getOpenState(r, when).open;
  if (!open && !input.scheduledFor) errors.push(`${r.name} is closed right now. Schedule your order for later.`);

  // Lines
  const catMap = new Map((cats ?? []).map((c) => [c.id, c]));
  const itemMap = new Map((items ?? []).map((i) => [i.id, i]));
  const lines: PricedLine[] = [];
  for (const l of input.lines) {
    const it = itemMap.get(l.itemId);
    if (!it || it.restaurant_id !== r.id || it.is_deleted) {
      errors.push("An item in your cart is no longer on the menu. Please remove it.");
      continue;
    }
    if (!it.in_stock) errors.push(`${it.name} is out of stock.`);
    const qtyOfItem = input.lines.filter((x) => x.itemId === it.id).reduce((s, x) => s + x.qty, 0);
    if (it.stock_qty !== null && qtyOfItem > it.stock_qty) errors.push(`Only ${it.stock_qty} × ${it.name} left.`);
    const cat = catMap.get(it.category_id);
    if (cat && !isCategoryAvailable(cat, when)) errors.push(`${it.name} isn't available at this time.`);
    let base = it.price_paise;
    let variantName: string | null = null;
    let variantId: string | null = null;
    if (it.item_variants.length) {
      const v = it.item_variants.find((x) => x.id === l.variantId);
      if (!v) errors.push(`Choose an option for ${it.name}.`);
      else if (!v.in_stock) errors.push(`${it.name} (${v.name}) is out of stock.`);
      if (v) {
        base = v.price_paise;
        variantName = v.name;
        variantId = v.id;
      }
    }
    const allAddons = it.addon_groups.flatMap((g) => g.addons.map((a) => ({ ...a, groupId: g.id })));
    const chosen = l.addonIds.map((id) => allAddons.find((a) => a.id === id)).filter((a): a is NonNullable<typeof a> => Boolean(a));
    if (chosen.length !== l.addonIds.length) errors.push(`Some add-ons for ${it.name} are no longer available.`);
    for (const g of it.addon_groups) {
      const n = chosen.filter((a) => a.groupId === g.id).length;
      if (n < g.min_select || n > g.max_select) errors.push(`Check the “${g.name}” choices for ${it.name}.`);
    }
    if (chosen.some((a) => !a.in_stock)) errors.push(`An add-on for ${it.name} is out of stock.`);
    const unit = base + chosen.reduce((s, a) => s + a.price_paise, 0);
    lines.push({
      itemId: it.id, name: it.name, isVeg: it.is_veg, variantId, variantName, addons: chosen.map((a) => ({ id: a.id, name: a.name, price_paise: a.price_paise })),
      qty: l.qty, unitPaise: unit, totalPaise: unit * l.qty, addedByName: l.addedByName,
    });
  }
  const itemTotal = lines.reduce((s, l) => s + l.totalPaise, 0);

  // Customer context
  const isGold = await isGoldMember(db, userId);
  const [{ count: priorOrders }, { count: priorOrdersHere }, { data: wallet }] = await Promise.all([
    userId ? db.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", userId).eq("status", "DELIVERED") : Promise.resolve({ count: 0 }),
    userId ? db.from("orders").select("id", { count: "exact", head: true }).eq("customer_id", userId).eq("restaurant_id", r.id).eq("status", "DELIVERED") : Promise.resolve({ count: 0 }),
    userId ? db.from("wallets").select("balance_paise").eq("user_id", userId).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  // Fees
  const slabFeePaise = slabFee(slabs ?? [], distanceKm);
  const lateNight = settings.surge_late_night && (IST_HOUR(when) >= 23 || IST_HOUR(when) < 6);
  const surge = settings.surge_rain || lateNight ? settings.surge_fee_paise : 0;
  const goldFreeDelivery = isGold && r.gold_partner && itemTotal >= settings.gold_free_delivery_min_paise;
  let deliveryFee = goldFreeDelivery ? 0 : slabFeePaise + surge;
  let goldSavings = goldFreeDelivery ? slabFeePaise + surge : 0;
  const goldDiscount = isGold && r.gold_partner ? Math.min(Math.floor((itemTotal * Number(settings.gold_extra_discount_pct)) / 100), 7500) : 0;
  goldSavings += goldDiscount;

  // Coupons
  const [{ data: coupons }, { data: offers }, { data: myRedemptions }] = await Promise.all([
    db.from("coupons").select("*").eq("is_active", true).or(`restaurant_id.is.null,restaurant_id.eq.${r.id}`),
    db.from("restaurant_offers").select("*").eq("restaurant_id", r.id).eq("is_active", true),
    userId ? db.from("coupon_redemptions").select("coupon_id, restaurant_offer_id").eq("user_id", userId) : Promise.resolve({ data: [] as { coupon_id: string | null; restaurant_offer_id: string | null }[] }),
  ]);
  const payMethod = input.paymentMethod === "wallet_app" ? "wallet" : input.paymentMethod;
  const ctx: Ctx = {
    userId, itemTotal, deliveryFee, restaurantId: r.id, isGold, paymentMethod: payMethod, priorOrders: priorOrders ?? 0, priorOrdersHere: priorOrdersHere ?? 0, lines,
    bogoItemPrice: (itemId) => {
      const ls = lines.filter((l) => l.itemId === itemId);
      if (!ls.length) return null;
      return { qty: ls.reduce((s, l) => s + l.qty, 0), unit: Math.min(...ls.map((l) => l.unitPaise)) };
    },
  };
  const couponViews: CouponView[] = [
    ...(coupons ?? []).map((c) => {
      const e = evaluate(c, "platform", ctx, (myRedemptions ?? []).filter((x) => x.coupon_id === c.id).length);
      return { code: c.code, title: c.title, description: c.description, source: "platform" as const, eligible: e.ok, reason: e.reason, savingsPaise: e.discount };
    }),
    ...(offers ?? [])
      .filter((o) => o.applies_to !== "dining")
      .map((o) => {
        const e = evaluate(o, "restaurant", ctx, 0);
        return { code: o.code, title: o.title, description: o.description, source: "restaurant" as const, eligible: e.ok, reason: e.reason, savingsPaise: e.discount };
      }),
  ].sort((a, b) => Number(b.eligible) - Number(a.eligible) || b.savingsPaise - a.savingsPaise);

  let discount = goldDiscount;
  const couponState: Quote["coupon"] = { applied: false, code: input.couponCode ?? null, message: null, couponId: null, offerId: null };
  if (input.couponCode) {
    const c = (coupons ?? []).find((x) => x.code === input.couponCode);
    const o = (offers ?? []).find((x) => x.code.toUpperCase() === input.couponCode);
    const e = c
      ? evaluate(c, "platform", ctx, (myRedemptions ?? []).filter((x) => x.coupon_id === c.id).length)
      : o
        ? evaluate(o, "restaurant", ctx, 0)
        : { ok: false, reason: "That code isn't valid", discount: 0 };
    if (e.ok) {
      couponState.applied = true;
      couponState.couponId = c?.id ?? null;
      couponState.offerId = o?.id ?? null;
      if (e.freeDelivery) {
        couponState.message = `Free delivery applied. You save ₹${Math.round(e.discount / 100)}`;
        deliveryFee = 0;
      } else if (e.freeItemId) {
        const { data: fi } = await db.from("menu_items").select("id, name, is_veg, price_paise").eq("id", e.freeItemId).single();
        if (fi) {
          lines.push({ itemId: fi.id, name: fi.name, isVeg: fi.is_veg, variantId: null, variantName: null, addons: [], qty: 1, unitPaise: 0, totalPaise: 0, free: true });
          couponState.message = `${fi.name} added free (worth ₹${Math.round(fi.price_paise / 100)})`;
        }
      } else {
        discount += e.discount;
        couponState.message = `You save ₹${Math.round(e.discount / 100)} with ${input.couponCode}`;
      }
    } else {
      couponState.message = e.reason ?? "Not applicable";
    }
  }
  discount = Math.min(discount, itemTotal);

  const gst = Math.round(((itemTotal - discount) * Number(settings.gst_pct)) / 100);
  const packaging = r.packaging_charge_paise;
  const platform = settings.platform_fee_paise;
  const tip = input.tipPaise;
  const donation = input.donationPaise;
  const total = Math.max(0, itemTotal + deliveryFee + platform + packaging + gst + tip + donation - discount);
  const balance = wallet?.balance_paise ?? 0;
  const walletUsed = input.useWallet || input.paymentMethod === "wallet_app" ? Math.min(balance, total) : 0;
  if (input.paymentMethod === "cod" && total - walletUsed > 200000) errors.push("Cash on delivery is available for orders up to ₹2,000.");

  const bill: Bill = {
    item_total_paise: itemTotal,
    delivery_fee_paise: deliveryFee,
    platform_fee_paise: platform,
    packaging_fee_paise: packaging,
    gst_paise: gst,
    tip_paise: tip,
    discount_paise: discount,
    donation_paise: donation,
    total_paise: total,
    wallet_used_paise: walletUsed,
    payable_paise: total - walletUsed,
    gold_savings_paise: goldSavings,
    coupon_code: couponState.applied ? input.couponCode ?? null : null,
    surge_fee_paise: goldFreeDelivery ? 0 : surge,
  };

  return {
    ok: errors.length === 0,
    errors: [...new Set(errors)],
    lines,
    bill,
    distanceKm,
    etaMinutes: estimateEtaMinutes(distanceKm, r.avg_prep_minutes),
    isGold,
    goldPartner: r.gold_partner,
    restaurantOpen: open,
    walletBalancePaise: balance,
    coupon: couponState,
    coupons: couponViews,
  };
}
