/**
 * Generates supabase/seed.sql deterministically from the data files in this folder.
 *   pnpm seed:generate   -> rewrite supabase/seed.sql
 *   pnpm seed            -> apply supabase/seed.sql to SUPABASE_DB_URL
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { img, type ImgKey } from "./images";
import { addonPresets, menus, variantPresets, type ItemDef, type MenuTemplate } from "./menus";
import { areas, pendingRestaurant, restaurants, type RestaurantDef } from "./restaurants";

// ---------- deterministic helpers ----------
let seed = 20261021;
function rand() {
  seed |= 0;
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const between = (a: number, b: number) => a + rand() * (b - a);
const int = (a: number, b: number) => Math.floor(between(a, b + 1));
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]!;
const chance = (p: number) => rand() < p;

function uid(key: string) {
  const h = createHash("md5").update(`thaali:${key}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
const slugify = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const paise = (rupees: number) => Math.round(rupees * 100);
const roundPrice = (r: number) => Math.max(9, Math.round(r / 10) * 10 - 1);

// ---------- SQL helpers ----------
type Raw = { raw: string };
const raw = (s: string): Raw => ({ raw: s });
const ago = (minutes: number) => raw(`now() - interval '${Math.round(minutes)} minutes'`);
type Val = string | number | boolean | null | undefined | Raw | string[] | Record<string, unknown> | unknown[];

function lit(v: Val): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "string") return `'${v.replace(/'/g, "''")}'`;
  if (typeof v === "object" && "raw" in (v as Raw) && typeof (v as Raw).raw === "string") return (v as Raw).raw;
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
    return v.length ? `array[${(v as string[]).map(lit).join(",")}]` : "'{}'";
  }
  return `${lit(JSON.stringify(v))}::jsonb`;
}

const out: string[] = [];
function insert(table: string, rows: Record<string, Val>[], suffix = "") {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]!);
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200);
    out.push(
      `insert into ${table} (${cols.join(", ")}) values\n` +
        chunk.map((r) => `  (${cols.map((c) => lit(r[c])).join(", ")})`).join(",\n") +
        `${suffix};`,
    );
  }
}

// ---------- people ----------
type Person = { key: string; email: string; name: string; role: string; phone: string };
const PASSWORD = "Demo@1234";
const people: Person[] = [
  { key: "admin", email: "admin@demo.in", name: "Kavya Rao", role: "admin", phone: "+919800000001" },
  { key: "owner1", email: "owner@demo.in", name: "Rohan Mehta", role: "restaurant_owner", phone: "+919800000011" },
  { key: "owner2", email: "owner2@demo.in", name: "Sameer Kulkarni", role: "restaurant_owner", phone: "+919800000012" },
  { key: "owner3", email: "owner3@demo.in", name: "Neha Joshi", role: "restaurant_owner", phone: "+919800000013" },
  { key: "newpartner", email: "newpartner@demo.in", name: "Farhan Shaikh", role: "restaurant_owner", phone: "+919800000014" },
  { key: "customer1", email: "customer@demo.in", name: "Priya Sharma", role: "customer", phone: "+919800000021" },
  { key: "customer2", email: "customer2@demo.in", name: "Rahul Deshpande", role: "customer", phone: "+919800000022" },
  { key: "customer3", email: "customer3@demo.in", name: "Ananya Iyer", role: "customer", phone: "+919800000023" },
  { key: "rider", email: "rider@demo.in", name: "Arjun Patil", role: "rider", phone: "+919800000031" },
  { key: "rider_applicant", email: "rider.applicant@demo.in", name: "Vikram Pawar", role: "rider", phone: "+919800000032" },
];
const simRiderNames = ["Sagar Jadhav", "Imran Khan", "Prakash Shinde", "Rakesh Yadav", "Manoj Gaikwad", "Salim Sheikh", "Deepak More"];
simRiderNames.forEach((name, i) =>
  people.push({ key: `sim${i + 1}`, email: `rider${i + 1}@seed.thaali.app`, name, role: "rider", phone: `+91980000010${i}` }),
);
const reviewerNames = [
  "Aditi Kulkarni", "Siddharth Rane", "Meera Nair", "Karan Malhotra", "Sneha Patwardhan",
  "Aman Verma", "Pooja Gokhale", "Nikhil Bhosale", "Tanvi Apte", "Varun Menon",
  "Ishita Sen", "Omkar Joshi",
];
reviewerNames.forEach((name, i) =>
  people.push({ key: `reviewer${i + 1}`, email: `foodie${i + 1}@seed.thaali.app`, name, role: "customer", phone: `+91981000${String(1000 + i)}` }),
);
const pid = (key: string) => uid(`user:${key}`);
const personByEmail = new Map(people.map((p) => [p.email, p]));

// ---------- header + cleanup ----------
out.push(`-- GENERATED by scripts/seed/generate.ts. Do not edit by hand; run \`pnpm seed:generate\`.
-- Demo data for Thaali (Pune). All demo passwords: ${PASSWORD}
set client_min_messages = warning;
begin;

-- Remove previous demo data so the seed can be re-run.
delete from public.donations where user_id in (select id from auth.users where email like '%@demo.in' or email like '%@seed.thaali.app');
delete from public.orders where customer_id in (select id from auth.users where email like '%@demo.in' or email like '%@seed.thaali.app')
  or restaurant_id in (select id from public.restaurants where slug = any (${lit([...restaurants, pendingRestaurant].map((r) => slugify(r.name)))}));
delete from public.restaurants where slug = any (${lit([...restaurants, pendingRestaurant].map((r) => slugify(r.name)))});
delete from auth.users where email like '%@demo.in' or email like '%@seed.thaali.app';
delete from public.coupons; delete from public.banners; delete from public.gold_plans; delete from public.events;
delete from public.fee_slabs; delete from public.delivery_zones; delete from public.collections where is_curated;
`);

// auth users (profiles + wallets are created by the on_auth_user_created trigger)
insert(
  "auth.users",
  people.map((p) => ({
    instance_id: "00000000-0000-0000-0000-000000000000",
    id: pid(p.key),
    aud: "authenticated",
    role: "authenticated",
    email: p.email,
    encrypted_password: raw(`extensions.crypt('${PASSWORD}', extensions.gen_salt('bf'))`),
    email_confirmed_at: raw("now()"),
    raw_app_meta_data: { provider: "email", providers: ["email"], role: p.role },
    raw_user_meta_data: { name: p.name, phone: p.phone },
    created_at: ago(60 * 24 * 90),
    updated_at: raw("now()"),
    confirmation_token: "",
    recovery_token: "",
    email_change_token_new: "",
    email_change: "",
    email_change_token_current: "",
    phone_change: "",
    phone_change_token: "",
    reauthentication_token: "",
    is_sso_user: false,
  })),
);
insert(
  "auth.identities",
  people.map((p) => ({
    id: uid(`identity:${p.key}`),
    provider_id: pid(p.key),
    user_id: pid(p.key),
    identity_data: { sub: pid(p.key), email: p.email, email_verified: true },
    provider: "email",
    last_sign_in_at: raw("now()"),
    created_at: raw("now()"),
    updated_at: raw("now()"),
  })),
);
out.push(`update public.profiles p set phone = u.raw_user_meta_data->>'phone' from auth.users u where u.id = p.id and u.email like any (array['%@demo.in', '%@seed.thaali.app']);`);
out.push(`update public.profiles set veg_mode = false, dietary_preference = 'none', last_lat = 18.5385, last_lng = 73.8925 where id = '${pid("customer1")}';`);
out.push(`update public.profiles set dietary_preference = 'veg', last_lat = 18.5612, last_lng = 73.7895 where id = '${pid("customer2")}';`);
out.push(`update public.profiles set healthy_mode = true, last_lat = 18.5665, last_lng = 73.9121 where id = '${pid("customer3")}';`);

// ---------- platform config ----------
out.push(`update public.platform_settings set max_delivery_km = 15, rider_search_km = 5;`);
insert("public.delivery_zones", [
  { id: uid("zone:pune"), name: "Pune Metro", center_lat: 18.5314, center_lng: 73.8446, radius_km: 20, is_active: true },
]);
insert(
  "public.fee_slabs",
  [[0, 2, 20], [2, 4, 30], [4, 6, 40], [6, 8, 55], [8, 11, 70], [11, 15, 90]].map(([a, b, f]) => ({
    id: uid(`slab:${a}`), min_km: a!, max_km: b!, fee_paise: paise(f!),
  })),
);
const feeFor = (km: number) => paise(km < 2 ? 20 : km < 4 ? 30 : km < 6 ? 40 : km < 8 ? 55 : km < 11 ? 70 : 90);

// ---------- restaurants & menus ----------
type SeededItem = { id: string; name: string; price: number; veg: boolean; restaurantId: string; temp: boolean; variants: { id: string; name: string; price: number }[] };
const restaurantRows: Record<string, Val>[] = [];
const privateRows: Record<string, Val>[] = [];
const photoRows: Record<string, Val>[] = [];
const categoryRows: Record<string, Val>[] = [];
const itemRows: Record<string, Val>[] = [];
const variantRows: Record<string, Val>[] = [];
const groupRows: Record<string, Val>[] = [];
const addonRows: Record<string, Val>[] = [];
const tableRows: Record<string, Val>[] = [];
const itemsByRestaurant = new Map<string, SeededItem[]>();
type SeededRestaurant = RestaurantDef & { id: string; slug: string; lat: number; lng: number };
const seededRestaurants: SeededRestaurant[] = [];

function healthyScore(n?: [number, number, number, number, number]) {
  if (!n) return null;
  const [cal, protein, , fat] = n;
  const proteinPer100 = (protein / cal) * 100;
  if (proteinPer100 >= 7.5 && fat / cal < 0.05) return "super";
  if (proteinPer100 >= 6) return "high";
  if (proteinPer100 >= 3.5) return "medium";
  return "low";
}

function mergeMenus(keys: string[], veg: boolean): MenuTemplate {
  const merged: MenuTemplate = [];
  for (const key of keys) {
    const tpl = menus[key];
    if (!tpl) throw new Error(`unknown menu ${key}`);
    for (const cat of tpl) {
      const items = cat.items.filter((it) => !veg || (it.v && !it.egg));
      if (!items.length) continue;
      const existing = merged.find((c) => c.name === cat.name);
      if (existing) existing.items.push(...items.filter((i) => !existing.items.some((e) => e.n === i.n)));
      else merged.push({ ...cat, items: [...items] });
    }
  }
  // Keep menus between 15 and 30 items: trim the largest categories first.
  let total = merged.reduce((s, c) => s + c.items.length, 0);
  while (total > 30) {
    const biggest = merged.reduce((a, b) => (b.items.length > a.items.length ? b : a));
    biggest.items.pop();
    total--;
  }
  return merged;
}

function seedRestaurant(def: RestaurantDef, index: number, status: "approved" | "pending") {
  const id = uid(`restaurant:${def.name}`);
  const slug = slugify(def.name);
  const a = areas[def.area];
  const lat = +(a.lat + between(-0.009, 0.009)).toFixed(6);
  const lng = +(a.lng + between(-0.009, 0.009)).toFixed(6);
  const owner = def.owner ? pid(personByEmail.get(def.owner)!.key) : null;
  const imgKey = (menus[def.menus[0]!]![0]!.items[0]!.i) as ImgKey;
  const cover = pick(img[imgKey]);
  const ratingCount = status === "approved" ? int(180, 4200) : 0;
  seededRestaurants.push({ ...def, id, slug, lat, lng });
  restaurantRows.push({
    id, owner_id: owner, name: def.name, slug, description: def.description, cuisines: def.cuisines,
    tags: [...(def.healthy ? ["healthy"] : []), ...(def.isNew ? ["new"] : [])],
    locality: def.area, address: `${int(3, 140)}, ${a.road}, ${def.area}, Pune ${a.pincode}`, city: "Pune", lat, lng,
    phone: `+9120${int(24000000, 27999999)}`, cover_image_url: cover, logo_url: null,
    cost_for_two_paise: paise(def.cft), is_pure_veg: Boolean(def.veg), is_online: !def.offline,
    auto_accept: false, status, commission_pct: def.gold ? 22 : 20,
    rating_delivery: def.rating, rating_dining: def.dining ? +(Math.min(4.9, def.rating + between(-0.2, 0.3))).toFixed(1) : 0,
    rating_count: ratingCount, dining_rating_count: def.dining ? int(80, 900) : 0,
    avg_prep_minutes: def.prep ?? 15, packaging_charge_paise: paise(def.cft >= 700 ? 30 : def.cft >= 400 ? 20 : 10),
    fssai: `1152${int(1000000000, 9999999999)}`,
    gold_partner: Boolean(def.gold), dining_enabled: Boolean(def.dining), outdoor_seating: Boolean(def.outdoor),
    serves_alcohol: Boolean(def.alcohol), is_healthy_partner: Boolean(def.healthy), is_featured: Boolean(def.featured),
    created_at: def.isNew ? ago(60 * 24 * 5) : ago(60 * 24 * int(120, 900)),
  });
  privateRows.push({
    restaurant_id: id, gst_number: `27AAB${String(index).padStart(4, "0")}C1Z${index % 10}`, pan_number: `AAB${String(index).padStart(5, "0")}C`,
    bank_account_name: def.name, bank_account_number_masked: `XXXXXX${int(1000, 9999)}`, bank_ifsc: "HDFC0001234",
    owner_name: def.owner ? personByEmail.get(def.owner)!.name : "Platform managed", owner_phone: null, owner_email: def.owner ?? null,
  });
  const photos = [cover, ...img.restaurant.slice(0, 3).map((u2) => u2), ...img[imgKey].filter((u2) => u2 !== cover)];
  photos.slice(0, 6).forEach((url, i) =>
    photoRows.push({ id: uid(`photo:${def.name}:${i}`), restaurant_id: id, url, caption: null, kind: i >= 1 && i <= 3 ? "ambience" : "food", sort: i }),
  );
  if (def.dining) {
    ["T1", "T2", "T3", "T4", "P1", "P2"].forEach((label, i) =>
      tableRows.push({
        id: uid(`table:${def.name}:${label}`), restaurant_id: id, label, section: label.startsWith("P") ? (def.outdoor ? "Patio" : "Private") : "Main",
        seats: [2, 4, 4, 6, 4, 8][i]!, qr_token: uid(`qr:${def.name}:${label}`).slice(0, 10).toUpperCase(), is_active: true,
      }),
    );
  }

  const priceFactor = def.cft >= 800 ? 1.25 : def.cft <= 300 ? 0.92 : 1;
  const menu = mergeMenus(def.menus, Boolean(def.veg));
  const seeded: SeededItem[] = [];
  menu.forEach((cat, ci) => {
    const catId = uid(`cat:${def.name}:${cat.name}`);
    categoryRows.push({
      id: catId, restaurant_id: id, name: cat.name, sort: ci,
      available_from: cat.from ?? null, available_to: cat.to ?? null,
    });
    cat.items.forEach((it: ItemDef, ii) => {
      const itemId = uid(`item:${def.name}:${it.n}`);
      const price = paise(roundPrice(it.p * priceFactor));
      const preset = it.variant ? variantPresets[it.variant] : null;
      const variants: SeededItem["variants"] = [];
      if (preset) {
        preset.options.forEach(([name, mult], vi) => {
          const vId = uid(`variant:${def.name}:${it.n}:${name}`);
          const vPrice = paise(roundPrice((it.p * priceFactor) * mult));
          variants.push({ id: vId, name, price: vPrice });
          variantRows.push({ id: vId, item_id: itemId, name, price_paise: vPrice, is_default: vi === 0, in_stock: true, sort: vi });
        });
      }
      for (const [gi, presetKey] of (it.addons ?? []).entries()) {
        const g = addonPresets[presetKey];
        const options = g.options.filter(([, , veg]) => !def.veg || veg);
        if (!options.length) continue;
        const gId = uid(`addon-group:${def.name}:${it.n}:${presetKey}`);
        groupRows.push({ id: gId, item_id: itemId, name: g.name, min_select: g.min, max_select: Math.min(g.max, options.length), sort: gi });
        options.forEach(([name, rupees, veg], oi) =>
          addonRows.push({ id: uid(`addon:${gId}:${name}`), group_id: gId, name, price_paise: paise(rupees), is_veg: veg, in_stock: true, sort: oi }),
        );
      }
      const hasRating = chance(0.7);
      itemRows.push({
        id: itemId, restaurant_id: id, category_id: catId, name: it.n, description: it.d || null, price_paise: price,
        is_veg: it.v, contains_egg: Boolean(it.egg), image_url: chance(0.85) ? pick(img[it.i]) : null,
        in_stock: true, stock_qty: null, bestseller: Boolean(it.b), tags: it.t ?? [],
        rating: hasRating ? +between(3.8, 4.8).toFixed(1) : null, rating_count: hasRating ? int(12, 640) : 0,
        calories: it.nut?.[0] ?? null, protein_g: it.nut?.[1] ?? null, carbs_g: it.nut?.[2] ?? null, fat_g: it.nut?.[3] ?? null,
        grams: it.nut?.[4] ?? null, healthy_score: healthyScore(it.nut), is_temperature_sensitive: Boolean(it.temp),
        variant_group_name: preset?.group ?? null, sort: ii,
      });
      seeded.push({ id: itemId, name: it.n, price: variants[0]?.price ?? price, veg: it.v, restaurantId: id, temp: Boolean(it.temp), variants });
    });
  });
  itemsByRestaurant.set(id, seeded);
}

restaurants.forEach((r, i) => seedRestaurant(r, i + 1, "approved"));
seedRestaurant(pendingRestaurant, 99, "pending");
insert("public.restaurants", restaurantRows);
insert("public.restaurant_private", privateRows);
insert("public.restaurant_photos", photoRows);
insert("public.menu_categories", categoryRows);
insert("public.menu_items", itemRows);
insert("public.item_variants", variantRows);
insert("public.addon_groups", groupRows);
insert("public.addons", addonRows);
insert("public.restaurant_tables", tableRows);

// a little live inventory for the stock demo
const saffron = seededRestaurants.find((r) => r.name === "Saffron Courtyard")!;
out.push(`update public.menu_items set stock_qty = 8, low_stock_threshold = 5 where restaurant_id = '${saffron.id}' and name in ('Paneer Tikka', 'Galouti Kebab');`);
out.push(`update public.menu_items set stock_qty = 3, low_stock_threshold = 5 where restaurant_id = '${saffron.id}' and name = 'Mutton Nihari';`);
out.push(`update public.menu_items set in_stock = false where restaurant_id = '${saffron.id}' and name = 'Rasmalai (2 pc)';`);
// late-night collection needs a few restaurants open late
out.push(`update public.restaurants set opening_hours = '{"mon":[["11:00","02:00"]],"tue":[["11:00","02:00"]],"wed":[["11:00","02:00"]],"thu":[["11:00","02:00"]],"fri":[["11:00","03:00"]],"sat":[["11:00","03:00"]],"sun":[["11:00","02:00"]]}' where slug in ('burger-republic','chinese-junction','roll-street','baner-biryani-house','momo-mantra','hinjewadi-biryani-co');`);
out.push(`update public.restaurants set opening_hours = '{"mon":[["07:00","22:30"]],"tue":[["07:00","22:30"]],"wed":[["07:00","22:30"]],"thu":[["07:00","22:30"]],"fri":[["07:00","22:30"]],"sat":[["07:00","23:00"]],"sun":[["07:00","23:00"]]}' where slug in ('udupi-upahar','idli-factory','dakshin-dosa-corner','the-breakfast-club');`);

// ---------- staff ----------
insert("public.restaurant_staff", [
  { id: uid("staff:1"), restaurant_id: saffron.id, user_id: null, email: "manager.saffron@demo.in", role: "manager", status: "invited" },
]);

// ---------- riders ----------
const riderSpots: [number, number][] = [
  [18.5372, 73.8952], [18.5601, 73.7851], [18.5089, 73.8102], [18.5662, 73.9161], [18.5898, 73.7411], [18.5421, 73.9013], [18.5155, 73.8231],
];
const riderRows: Record<string, Val>[] = [];
const riderPrivateRows: Record<string, Val>[] = [];
const vehicles = ["scooter", "motorcycle", "ev_scooter", "bicycle"] as const;
simRiderNames.forEach((name, i) => {
  const [lat, lng] = riderSpots[i]!;
  riderRows.push({
    id: pid(`sim${i + 1}`), name, phone: `+91980000010${i}`, photo_url: null, vehicle_type: vehicles[i % 3]!,
    vehicle_number: `MH12${pick(["AB", "CD", "EF", "GH", "JK"])}${int(1000, 9999)}`, status: "approved", is_online: true,
    is_simulated: true, current_lat: lat, current_lng: lng, last_seen_at: raw("now()"), rating: +between(4.5, 4.95).toFixed(1),
    rating_count: int(150, 2400), floating_cash_paise: 0,
  });
});
riderRows.push({
  id: pid("rider"), name: "Arjun Patil", phone: "+919800000031", photo_url: null, vehicle_type: "scooter", vehicle_number: "MH12QX4821",
  status: "approved", is_online: false, is_simulated: false, current_lat: 18.5401, current_lng: 73.8968, last_seen_at: ago(30),
  rating: 4.8, rating_count: 312, floating_cash_paise: paise(640),
});
riderRows.push({
  id: pid("rider_applicant"), name: "Vikram Pawar", phone: "+919800000032", photo_url: null, vehicle_type: "motorcycle", vehicle_number: "MH14BK2210",
  status: "pending", is_online: false, is_simulated: false, current_lat: null, current_lng: null, last_seen_at: null,
  rating: 5.0, rating_count: 0, floating_cash_paise: 0,
});
insert("public.riders", riderRows);
riderPrivateRows.push(
  { rider_id: pid("rider"), bank_account_name: "Arjun Patil", bank_account_number_masked: "XXXXXX4821", bank_ifsc: "SBIN0004567", driving_license_url: null, vehicle_rc_url: null },
  { rider_id: pid("rider_applicant"), bank_account_name: "Vikram Pawar", bank_account_number_masked: "XXXXXX9910", bank_ifsc: "ICIC0002211", driving_license_url: null, vehicle_rc_url: null },
);
insert("public.rider_private", riderPrivateRows);

// ---------- addresses ----------
type Addr = { id: string; user: string; label: string; line1: string; flat: string; landmark: string; area: string; lat: number; lng: number; instructions?: string; isDefault: boolean };
const addresses: Addr[] = [
  { id: uid("addr:c1:home"), user: "customer1", label: "Home", line1: "Lane 6, North Main Road, Koregaon Park", flat: "Flat 402, Silver Oak Apartments", landmark: "Near German Bakery", area: "Koregaon Park", lat: 18.5385, lng: 73.8925, instructions: "Ring the bell twice", isDefault: true },
  { id: uid("addr:c1:work"), user: "customer1", label: "Work", line1: "Weikfield IT Park, Nagar Road, Viman Nagar", flat: "Tower B, 5th floor", landmark: "Opp. Phoenix Mall", area: "Viman Nagar", lat: 18.5603, lng: 73.9062, isDefault: false },
  { id: uid("addr:c2:home"), user: "customer2", label: "Home", line1: "Pancard Club Road, Baner", flat: "B-1203, Rohan Leher", landmark: "Near Balewadi High Street", area: "Baner", lat: 18.5612, lng: 73.7895, isDefault: true },
  { id: uid("addr:c3:home"), user: "customer3", label: "Home", line1: "Clover Park, Viman Nagar", flat: "C-704, Kumar Primavera", landmark: "Behind Symbiosis", area: "Viman Nagar", lat: 18.5665, lng: 73.9121, isDefault: true },
];
insert("public.addresses", addresses.map((a) => ({
  id: a.id, user_id: pid(a.user), label: a.label, line1: a.line1, flat: a.flat, landmark: a.landmark, area: a.area, city: "Pune",
  pincode: null, lat: a.lat, lng: a.lng, instructions: a.instructions ?? null, is_default: a.isDefault,
})));

// ---------- order history ----------
const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
  const R = 6371, dLat = ((lat2 - lat1) * Math.PI) / 180, dLng = ((lng2 - lng1) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
};
const orderRows: Record<string, Val>[] = [];
const orderItemRows: Record<string, Val>[] = [];
const eventRows: Record<string, Val>[] = [];
const earningRows: Record<string, Val>[] = [];
const reviewRows: Record<string, Val>[] = [];
const reviewPhotoRows: Record<string, Val>[] = [];
const replyRows: Record<string, Val>[] = [];
let orderSeq = 0;

const steps = ["PLACED", "ACCEPTED", "PREPARING", "READY", "RIDER_ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"] as const;
const actorFor: Record<string, string> = {
  PLACED: "customer", ACCEPTED: "restaurant", PREPARING: "restaurant", READY: "restaurant",
  RIDER_ASSIGNED: "system", PICKED_UP: "rider", OUT_FOR_DELIVERY: "rider", DELIVERED: "rider",
};

function makeOrder(opts: {
  customerKey: string; customerName: string; phone: string; lat: number; lng: number; addressId: string | null; addressLabel: string; addressLine: string;
  restaurant: SeededRestaurant; minutesAgo: number; riderKey: string; status?: "DELIVERED" | "CANCELLED_BY_CUSTOMER"; gold?: boolean;
}) {
  const id = uid(`order:${orderSeq++}`);
  const menu = itemsByRestaurant.get(opts.restaurant.id)!;
  const lines = Array.from({ length: int(1, 3) }, () => pick(menu));
  const unique = [...new Map(lines.map((l) => [l.id, l])).values()];
  let itemTotal = 0;
  for (const l of unique) {
    const qty = int(1, 2);
    const variant = l.variants[0];
    const unit = variant?.price ?? l.price;
    itemTotal += unit * qty;
    orderItemRows.push({
      id: uid(`order-item:${id}:${l.id}`), order_id: id, menu_item_id: l.id, name: l.name, variant_name: variant?.name ?? null,
      addons: [], quantity: qty, unit_price_paise: unit, total_paise: unit * qty, is_veg: l.veg, added_by_name: null,
    });
  }
  const km = +haversine(opts.restaurant.lat, opts.restaurant.lng, opts.lat, opts.lng).toFixed(2);
  const freeDelivery = Boolean(opts.gold && opts.restaurant.gold && itemTotal >= paise(199));
  const delivery = freeDelivery ? 0 : feeFor(km);
  const platform = paise(10);
  const packaging = paise(opts.restaurant.cft >= 700 ? 30 : opts.restaurant.cft >= 400 ? 20 : 10);
  const discount = chance(0.3) ? Math.min(Math.round(itemTotal * 0.2), paise(100)) : 0;
  const gst = Math.round((itemTotal - discount) * 0.05);
  const tip = pick([0, 0, 0, paise(20), paise(30), paise(50)]);
  const total = itemTotal + delivery + platform + packaging + gst + tip - discount;
  const cancelled = opts.status === "CANCELLED_BY_CUSTOMER";
  const riderId = cancelled ? null : pid(opts.riderKey);
  const t0 = opts.minutesAgo;
  const prep = opts.restaurant.prep ?? 15;
  const times = [t0, t0 - 2, t0 - 2.5, t0 - prep, t0 - prep - 1, t0 - prep - 4, t0 - prep - 5, t0 - prep - 5 - Math.max(8, km * 4)];
  const method = pick(["razorpay", "razorpay", "razorpay", "cod"] as const);
  orderRows.push({
    id, customer_id: pid(opts.customerKey), restaurant_id: opts.restaurant.id, rider_id: riderId, address_id: opts.addressId,
    status: opts.status ?? "DELIVERED", source: "app", customer_name: opts.customerName, customer_phone: opts.phone,
    delivery_address: { label: opts.addressLabel, line1: opts.addressLine, lat: opts.lat, lng: opts.lng },
    delivery_instructions: {}, cooking_instructions: null, no_cutlery: chance(0.4), distance_km: km,
    eta_minutes: Math.round(prep + 8 + km * 4), prep_minutes: prep, scheduled_for: null,
    item_total_paise: itemTotal, delivery_fee_paise: delivery, platform_fee_paise: platform, packaging_fee_paise: packaging,
    gst_paise: gst, tip_paise: tip, discount_paise: discount, donation_paise: 0, total_paise: total, wallet_used_paise: 0,
    payable_paise: total, gold_savings_paise: freeDelivery ? feeFor(km) : 0, coupon_code: discount ? "TRYNEW" : null,
    payment_method: method, payment_method_detail: method === "cod" ? null : pick(["upi", "card", "upi", "netbanking"]),
    payment_status: cancelled ? "refunded" : method === "cod" ? "cod_collected" : "paid",
    razorpay_order_id: method === "razorpay" ? `order_seed${String(orderSeq).padStart(8, "0")}` : null,
    razorpay_payment_id: method === "razorpay" ? `pay_seed${String(orderSeq).padStart(8, "0")}` : null,
    refund_paise: cancelled ? total : 0, refund_to: cancelled ? "wallet" : null, refunded_at: cancelled ? ago(t0 - 3) : null,
    placed_at: ago(times[0]!), accepted_at: cancelled ? null : ago(times[1]!), ready_at: cancelled ? null : ago(times[3]!),
    rider_assigned_at: cancelled ? null : ago(times[4]!), rider_at_restaurant_at: cancelled ? null : ago(times[4]! - 1),
    picked_up_at: cancelled ? null : ago(times[5]!), out_for_delivery_at: cancelled ? null : ago(times[6]!),
    delivered_at: cancelled ? null : ago(times[7]!), cancelled_at: cancelled ? ago(t0 - 1) : null,
    cancel_reason: cancelled ? "Ordered by mistake" : null, is_gold_order: Boolean(opts.gold),
    created_at: ago(t0), updated_at: ago(cancelled ? t0 - 1 : times[7]!),
  });
  if (cancelled) {
    eventRows.push(
      { order_id: id, from_status: "PENDING_PAYMENT", to_status: "PLACED", actor_id: pid(opts.customerKey), actor_role: "customer", note: null, created_at: ago(t0) },
      { order_id: id, from_status: "PLACED", to_status: "CANCELLED_BY_CUSTOMER", actor_id: pid(opts.customerKey), actor_role: "customer", note: "Ordered by mistake", created_at: ago(t0 - 1) },
    );
  } else {
    steps.forEach((s, i) => eventRows.push({
      order_id: id, from_status: i === 0 ? "PENDING_PAYMENT" : steps[i - 1]!, to_status: s,
      actor_id: actorFor[s] === "customer" ? pid(opts.customerKey) : actorFor[s] === "rider" ? riderId : null,
      actor_role: actorFor[s]!, note: s === "ACCEPTED" ? `Prep time ${prep} min` : null, created_at: ago(times[i]!),
    }));
    const base = paise(25), distancePay = Math.round(km * 600), incentive = 0;
    earningRows.push({
      id: uid(`earning:${id}`), rider_id: riderId, order_id: id, kind: "delivery", base_pay_paise: base, distance_pay_paise: distancePay,
      tip_paise: tip, incentive_paise: incentive, total_paise: base + distancePay + tip + incentive, note: null, created_at: ago(times[7]!),
    });
  }
  return { id, total, cancelled, times };
}

const riderKeys = ["sim1", "sim2", "sim3", "sim4", "sim5", "sim6", "sim7", "rider"];
const nearest = (lat: number, lng: number, max = 9) =>
  seededRestaurants.filter((r) => r.name !== pendingRestaurant.name && haversine(lat, lng, r.lat, r.lng) <= max);

// Demo customers' own history
const demoCustomers = [
  { key: "customer1", name: "Priya Sharma", phone: "+919800000021", addr: addresses[0]!, gold: false, favourites: ["Saffron Courtyard", "Baner Biryani House", "Sweet Tooth Patisserie", "Napoli Fire Oven", "The Bombay Bowl"] },
  { key: "customer2", name: "Rahul Deshpande", phone: "+919800000022", addr: addresses[2]!, gold: true, favourites: ["Annapurna Thali", "Udupi Upahar", "Baner Biryani House", "Pasta La Vista"] },
  { key: "customer3", name: "Ananya Iyer", phone: "+919800000023", addr: addresses[3]!, gold: false, favourites: ["Green Bowl Co.", "The Breakfast Club", "Bao & Bowl", "Lucknowi Dastarkhwan"] },
];
const demoOrderIds: string[] = [];
for (const c of demoCustomers) {
  c.favourites.forEach((name, i) => {
    const r = seededRestaurants.find((x) => x.name === name)!;
    const o = makeOrder({
      customerKey: c.key, customerName: c.name, phone: c.phone, lat: c.addr.lat, lng: c.addr.lng, addressId: c.addr.id,
      addressLabel: c.addr.label, addressLine: `${c.addr.flat}, ${c.addr.line1}`, restaurant: r,
      minutesAgo: 60 * 24 * (i * 5 + int(1, 4)) + int(0, 600), riderKey: i === 0 ? "rider" : pick(riderKeys), gold: c.gold,
    });
    demoOrderIds.push(o.id);
  });
}
// one cancelled + refunded order for Priya
makeOrder({
  customerKey: "customer1", customerName: "Priya Sharma", phone: "+919800000021", lat: addresses[0]!.lat, lng: addresses[0]!.lng,
  addressId: addresses[0]!.id, addressLabel: "Home", addressLine: `${addresses[0]!.flat}, ${addresses[0]!.line1}`,
  restaurant: seededRestaurants.find((x) => x.name === "Dragon Wok")!, minutesAgo: 60 * 24 * 12, riderKey: "sim1", status: "CANCELLED_BY_CUSTOMER",
});

// Background order volume (last 30 days) so reports and admin charts have shape.
const reviewerAreas = ["Koregaon Park", "Baner", "Kothrud", "Viman Nagar", "Hinjewadi"] as const;
const comments: Record<"great" | "good" | "meh", string[]> = {
  great: [
    "Absolutely loved the {dish}. Arrived hot and well packed.",
    "Best {dish} I've had in Pune. Will order again!",
    "{dish} was spot on, generous portion. The rider was super polite too.",
    "Fresh, flavourful and on time. The {dish} is a must-try.",
    "Ordered for a family dinner and everyone loved it. {dish} was the star.",
    "Perfect comfort food after a long day. {dish} 10/10.",
  ],
  good: [
    "{dish} was good, a little less spicy than I like.",
    "Tasty food, delivery took slightly longer than shown.",
    "Good value for money. {dish} could use a bit more seasoning.",
    "Nice packaging and decent taste. Would try other dishes next time.",
  ],
  meh: [
    "{dish} was okay but arrived lukewarm.",
    "Portion size felt small for the price.",
    "Expected better. The {dish} was a bit oily.",
  ],
};
const foodTags = { great: ["Tasty", "Good quantity", "Well packed", "Fresh"], good: ["Tasty", "Value for money"], meh: ["Cold food", "Small portion", "Too oily"] };
const replyPool = [
  "Thank you so much! We're glad you enjoyed it. See you again soon.",
  "Thanks for the feedback. We've shared it with our kitchen team.",
  "We're sorry it wasn't perfect this time. Please DM us and we'll make it right.",
];

const approved = seededRestaurants.filter((r) => r.name !== pendingRestaurant.name);
const reviewCounts = new Map<string, number>();
let reviewCount = 0;
for (let n = 0; n < 340; n++) {
  const reviewerIdx = n % reviewerNames.length;
  const key = `reviewer${reviewerIdx + 1}`;
  const area = areas[reviewerAreas[reviewerIdx % 5]!];
  const lat = area.lat + between(-0.01, 0.01), lng = area.lng + between(-0.01, 0.01);
  const pool = nearest(lat, lng);
  // weight towards higher rated restaurants
  const r = pool.sort(() => rand() - 0.5).sort((a, b) => b.rating - a.rating + between(-0.6, 0.6))[0] ?? pick(approved);
  const minutesAgo = between(30, 60 * 24 * 30);
  const o = makeOrder({
    customerKey: key, customerName: reviewerNames[reviewerIdx]!, phone: `+91981000${1000 + reviewerIdx}`, lat, lng, addressId: null,
    addressLabel: "Home", addressLine: `${int(1, 300)}, ${reviewerAreas[reviewerIdx % 5]}, Pune`, restaurant: r, minutesAgo,
    riderKey: pick(riderKeys),
  });
  const rc = reviewCounts.get(r.id) ?? 0;
  if (reviewCount < 180 && rc < 12 && !o.cancelled) {
    reviewCounts.set(r.id, rc + 1);
    reviewCount++;
    const stars = Math.max(1, Math.min(5, Math.round(r.rating + between(-1.4, 0.9))));
    const band = stars >= 5 ? "great" : stars >= 4 ? (chance(0.6) ? "great" : "good") : stars === 3 ? "good" : "meh";
    const dish = (orderItemRows.findLast((x) => x.order_id === o.id)?.name as string) ?? "food";
    const reviewId = uid(`review:${o.id}`);
    reviewRows.push({
      id: reviewId, kind: "delivery", order_id: o.id, customer_id: pid(key), customer_name: reviewerNames[reviewerIdx]!,
      restaurant_id: r.id, rider_id: orderRows.find((x) => x.id === o.id)!.rider_id as string,
      food_rating: stars, delivery_rating: Math.min(5, stars + int(0, 1)), food_tags: foodTags[band].slice(0, int(1, 3)),
      delivery_tags: stars >= 4 ? ["On time", "Polite rider"].slice(0, int(1, 2)) : ["Late delivery"],
      comment: pick(comments[band]).replace("{dish}", dish), created_at: ago(o.times[7]! - 30),
    });
    if (chance(0.25)) {
      const key2 = (itemRows.find((x) => x.name === dish && x.restaurant_id === r.id)?.image_url as string) ?? pick(img.restaurant);
      reviewPhotoRows.push({ id: uid(`review-photo:${reviewId}`), review_id: reviewId, url: key2 });
    }
    if (chance(0.3)) {
      replyRows.push({
        id: uid(`reply:${reviewId}`), review_id: reviewId, author_id: r.owner ? pid(personByEmail.get(r.owner)!.key) : null,
        body: stars >= 4 ? replyPool[0]! : stars === 3 ? replyPool[1]! : replyPool[2]!, created_at: ago(o.times[7]! - 300),
      });
    }
  }
}

// Dining reviews for dine-in restaurants
for (const r of approved.filter((x) => x.dining)) {
  for (let i = 0; i < 2; i++) {
    const reviewerIdx = int(0, reviewerNames.length - 1);
    reviewRows.push({
      id: uid(`dining-review:${r.id}:${i}`), kind: "dining", order_id: null, customer_id: pid(`reviewer${reviewerIdx + 1}`),
      customer_name: reviewerNames[reviewerIdx]!, restaurant_id: r.id, rider_id: null, food_rating: int(4, 5), delivery_rating: null,
      food_tags: ["Great ambience", "Courteous staff"], delivery_tags: [],
      comment: pick(["Lovely ambience and quick service. Perfect for a weekend dinner.", "Great place for a family dinner, the staff were very attentive.", "Beautiful seating and the food matched the vibe."]),
      created_at: ago(between(60 * 24, 60 * 24 * 40)),
    });
  }
}

insert("public.orders", orderRows);
insert("public.order_items", orderItemRows);
insert("public.order_events", eventRows);
insert("public.rider_earnings", earningRows);
out.push("alter table public.reviews disable trigger reviews_refresh_ratings;");
insert("public.reviews", reviewRows);
out.push("alter table public.reviews enable trigger reviews_refresh_ratings;");
insert("public.review_photos", reviewPhotoRows);
insert("public.review_replies", replyRows);

// ---------- coupons, offers, ads ----------
const bbh = seededRestaurants.find((r) => r.name === "Baner Biryani House")!;
const napoli = seededRestaurants.find((r) => r.name === "Napoli Fire Oven")!;
const greenBowl = seededRestaurants.find((r) => r.name === "Green Bowl Co.")!;
insert("public.coupons", [
  { code: "WELCOME50", title: "50% off your first order", description: "Up to ₹100 off on orders above ₹199. First order only.", discount_type: "percent", discount_value: 50, max_discount_paise: paise(100), min_order_paise: paise(199), first_order_only: true, gold_only: false, payment_method: null, restaurant_id: null, per_user_limit: 1 },
  { code: "GOLD100", title: "Flat ₹100 off for Gold members", description: "On orders above ₹499.", discount_type: "flat", discount_value: paise(100), max_discount_paise: null, min_order_paise: paise(499), first_order_only: false, gold_only: true, payment_method: null, restaurant_id: null, per_user_limit: 5 },
  { code: "UPI20", title: "20% off with UPI", description: "Up to ₹75 off when you pay by UPI.", discount_type: "percent", discount_value: 20, max_discount_paise: paise(75), min_order_paise: paise(249), first_order_only: false, gold_only: false, payment_method: "upi", restaurant_id: null, per_user_limit: 3 },
  { code: "FLAT75", title: "Flat ₹75 off", description: "On orders above ₹399.", discount_type: "flat", discount_value: paise(75), max_discount_paise: null, min_order_paise: paise(399), first_order_only: false, gold_only: false, payment_method: null, restaurant_id: null, per_user_limit: 3 },
  { code: "FREEDEL", title: "Free delivery", description: "No delivery fee on orders above ₹249.", discount_type: "free_delivery", discount_value: 0, max_discount_paise: null, min_order_paise: paise(249), first_order_only: false, gold_only: false, payment_method: null, restaurant_id: null, per_user_limit: 5 },
  { code: "PARTY150", title: "₹150 off on big orders", description: "On orders above ₹999. Perfect for group orders.", discount_type: "flat", discount_value: paise(150), max_discount_paise: null, min_order_paise: paise(999), first_order_only: false, gold_only: false, payment_method: null, restaurant_id: null, per_user_limit: 2 },
  { code: "CARD15", title: "15% off with cards", description: "Up to ₹120 off on credit and debit cards.", discount_type: "percent", discount_value: 15, max_discount_paise: paise(120), min_order_paise: paise(399), first_order_only: false, gold_only: false, payment_method: "card", restaurant_id: null, per_user_limit: 2 },
  { code: "WEEKEND60", title: "60% off this weekend", description: "Up to ₹120 off on orders above ₹249.", discount_type: "percent", discount_value: 60, max_discount_paise: paise(120), min_order_paise: paise(249), first_order_only: false, gold_only: false, payment_method: null, restaurant_id: null, per_user_limit: 1 },
  { code: "TRYNEW", title: "40% off", description: "Up to ₹80 off on orders above ₹159.", discount_type: "percent", discount_value: 40, max_discount_paise: paise(80), min_order_paise: paise(159), first_order_only: false, gold_only: false, payment_method: null, restaurant_id: null, per_user_limit: 10 },
  { code: "BIRYANI99", title: "₹99 off at Baner Biryani House", description: "On orders above ₹449.", discount_type: "flat", discount_value: paise(99), max_discount_paise: null, min_order_paise: paise(449), first_order_only: false, gold_only: false, payment_method: null, restaurant_id: bbh.id, per_user_limit: 2 },
].map((c, i) => ({ id: uid(`coupon:${c.code}`), ...c, valid_until: raw("now() + interval '90 days'"), is_active: true, used_count: int(20, 900) + i })));

const margherita = itemsByRestaurant.get(napoli.id)!.find((i) => i.name === "Margherita")!;
const smoothie = itemsByRestaurant.get(greenBowl.id)!.find((i) => i.name === "Green Detox Smoothie")!;
insert("public.restaurant_offers", [
  { id: uid("offer:saffron20"), restaurant_id: saffron.id, title: "20% off up to ₹150", description: "On delivery and dine-in.", code: "SAFFRON20", discount_type: "percent", discount_value: 20, max_discount_paise: paise(150), min_order_paise: paise(499), bogo_item_id: null, free_item_id: null, target: "all", applies_to: "both" },
  { id: uid("offer:saffron-dining"), restaurant_id: saffron.id, title: "Flat 20% off on dining", description: "Pre-book a table and get 20% off the bill.", code: "DINE20", discount_type: "percent", discount_value: 20, max_discount_paise: paise(800), min_order_paise: 0, bogo_item_id: null, free_item_id: null, target: "all", applies_to: "dining" },
  { id: uid("offer:napoli-bogo"), restaurant_id: napoli.id, title: "Buy 1 Get 1 Margherita", description: "Add two Margheritas, pay for one.", code: "BOGOPIZZA", discount_type: "bogo", discount_value: 0, max_discount_paise: null, min_order_paise: 0, bogo_item_id: margherita.id, free_item_id: null, target: "all", applies_to: "delivery" },
  { id: uid("offer:greenbowl-free"), restaurant_id: greenBowl.id, title: "Free Green Detox Smoothie", description: "On orders above ₹599.", code: "FREESMOOTHIE", discount_type: "free_item", discount_value: 0, max_discount_paise: null, min_order_paise: paise(599), bogo_item_id: null, free_item_id: smoothie.id, target: "all", applies_to: "delivery" },
  { id: uid("offer:bbh-new"), restaurant_id: bbh.id, title: "₹125 off for new customers", description: "Your first order from us.", code: "NEWBBH", discount_type: "flat", discount_value: paise(125), max_discount_paise: null, min_order_paise: paise(399), bogo_item_id: null, free_item_id: null, target: "new_users", applies_to: "delivery" },
  // A standard delivery offer on roughly half the restaurants, so cards show realistic ribbons.
  ...approved
    .filter((r, i) => i % 2 === 0 && ![saffron.id, napoli.id, greenBowl.id, bbh.id].includes(r.id))
    .map((r, i) => {
      const pct = [20, 30, 40, 50, 15][i % 5]!;
      const cap = [80, 100, 120, 75, 150][i % 5]!;
      return {
        id: uid(`offer:std:${r.id}`), restaurant_id: r.id, title: `${pct}% OFF up to ₹${cap}`, description: `On orders above ₹${pct >= 40 ? 299 : 199}.`,
        code: `${r.slug.replace(/-/g, "").slice(0, 8).toUpperCase()}${pct}`, discount_type: "percent" as const, discount_value: pct, max_discount_paise: paise(cap),
        min_order_paise: paise(pct >= 40 ? 299 : 199), bogo_item_id: null, free_item_id: null, target: "all" as const, applies_to: "delivery" as const,
      };
    }),
].map((o) => ({ ...o, valid_until: raw("now() + interval '60 days'"), is_active: true })));

insert("public.ad_campaigns", [
  { id: uid("ad:saffron"), restaurant_id: saffron.id, name: "Weekend dinner push", daily_budget_paise: paise(500), starts_on: raw("current_date - 6"), ends_on: raw("current_date + 24"), status: "active", impressions: 18420, clicks: 1290, orders: 96, spend_paise: paise(2940) },
]);
out.push(`update public.restaurants set sponsored_until = now() + interval '24 days' where id = '${saffron.id}';`);

// ---------- banners, collections, gold, events ----------
insert("public.banners", [
  { title: "50% off your first order", subtitle: "Use code WELCOME50 · up to ₹100", cta_label: "Order now", link_url: "/?offers=1", theme: "saffron", image_url: img.biryani[0] },
  { title: "Thaali Gold", subtitle: "Free delivery, extra discounts and more", cta_label: "Join Gold", link_url: "/gold", theme: "gold", image_url: img.restaurant[1] },
  { title: "Healthy, but make it tasty", subtitle: "Bowls with full macros from ₹249", cta_label: "Explore", link_url: "/collections/healthy-and-happy", theme: "green", image_url: img.salad[0] },
  { title: "Book a table this weekend", subtitle: "Flat 20% off at partner restaurants", cta_label: "Dining out", link_url: "/dining", theme: "plum", image_url: img.restaurant[0] },
  { title: "Live in Pune", subtitle: "Jazz nights, stand-up and more", cta_label: "Get tickets", link_url: "/events", theme: "night", image_url: img.event[0] },
].map((b, i) => ({ id: uid(`banner:${i}`), ...b, sort: i, is_active: true })));

const collections: { slug: string; title: string; description: string; image: string; pick: (r: SeededRestaurant) => boolean }[] = [
  { slug: "late-night-cravings", title: "Late night cravings", description: "Open till 2am and later", image: img.burger[0]!, pick: (r) => ["Burger Republic", "Chinese Junction", "Roll Street", "Baner Biryani House", "Momo Mantra", "Hinjewadi Biryani Co."].includes(r.name) },
  { slug: "best-biryani-in-pune", title: "Best biryani in Pune", description: "Dum, kacchi and Awadhi", image: img.biryani[0]!, pick: (r) => r.cuisines.includes("Biryani") },
  { slug: "budget-eats", title: "Budget eats", description: "Great food for two under ₹300", image: img.street[0]!, pick: (r) => r.cft <= 300 && !r.offline },
  { slug: "healthy-and-happy", title: "Healthy & happy", description: "Bowls, salads and smoothies with macros", image: img.salad[0]!, pick: (r) => Boolean(r.healthy) },
  { slug: "pure-veg-favourites", title: "Pure veg favourites", description: "100% vegetarian kitchens", image: img.thali[0]!, pick: (r) => Boolean(r.veg) },
  { slug: "date-night-dining", title: "Date night dining", description: "Beautiful places to book a table", image: img.restaurant[2]!, pick: (r) => Boolean(r.dining) && r.cft >= 700 },
];
insert("public.collections", collections.map((c, i) => ({
  id: uid(`collection:${c.slug}`), owner_id: pid("admin"), title: c.title, description: c.description, image_url: c.image,
  slug: c.slug, is_curated: true, is_public: true, share_code: c.slug.slice(0, 8).toUpperCase(), sort: i,
})));
insert("public.collection_items", collections.flatMap((c) =>
  approved.filter(c.pick).map((r, i) => ({ collection_id: uid(`collection:${c.slug}`), restaurant_id: r.id, sort: i })),
));

insert("public.gold_plans", [
  { id: uid("gold:3m"), name: "Gold · 3 months", duration_months: 3, price_paise: paise(149), original_price_paise: paise(299), is_active: true, sort: 0 },
  { id: uid("gold:12m"), name: "Gold · 12 months", duration_months: 12, price_paise: paise(399), original_price_paise: paise(999), is_active: true, sort: 1 },
]);
insert("public.gold_memberships", [
  { id: uid("gold-member:c2"), user_id: pid("customer2"), plan_id: uid("gold:12m"), starts_at: ago(60 * 24 * 40), ends_at: raw("now() + interval '325 days'"), status: "active", amount_paid_paise: paise(399), payment_method: "razorpay", razorpay_order_id: "order_seedgold0001", razorpay_payment_id: "pay_seedgold0001" },
]);

insert("public.events", [
  { title: "Koregaon Park Jazz Night", slug: "kp-jazz-night", description: "An evening of live jazz with the city's finest quartet, under the stars.", category: "Music", venue: "The Courtyard, Koregaon Park", starts_at: raw("date_trunc('day', now()) + interval '9 days 20 hours'"), image_url: img.event[0], tiers: [{ id: "ga", name: "General", price_paise: paise(799), capacity: 200 }, { id: "vip", name: "VIP lounge", price_paise: paise(1999), capacity: 40 }] },
  { title: "Stand-up Saturday: Pune Edition", slug: "standup-saturday-pune", description: "Four comics, one mic, zero chill. 18+.", category: "Comedy", venue: "Black Box Theatre, Baner", starts_at: raw("date_trunc('day', now()) + interval '5 days 19 hours'"), image_url: img.event[1], tiers: [{ id: "std", name: "Standard", price_paise: paise(499), capacity: 150 }, { id: "front", name: "Front rows", price_paise: paise(899), capacity: 30 }] },
  { title: "Indie Sundowner at Baner Hill", slug: "indie-sundowner", description: "Indie bands, food trucks and a sunset view.", category: "Festival", venue: "Baner Hill Amphitheatre", starts_at: raw("date_trunc('day', now()) + interval '16 days 17 hours'"), image_url: img.event[2], tiers: [{ id: "early", name: "Early bird", price_paise: paise(599), capacity: 300 }, { id: "ga", name: "General", price_paise: paise(899), capacity: 600 }] },
].map((e) => ({ id: uid(`event:${e.slug}`), ...e, city: "Pune", is_active: true })));

// ---------- engagement for demo customers ----------
insert("public.favourites", demoCustomers.flatMap((c) =>
  c.favourites.slice(0, 3).map((name) => ({ user_id: pid(c.key), restaurant_id: seededRestaurants.find((r) => r.name === name)!.id })),
));
const trending = ["biryani", "pizza", "paneer tikka", "momos", "misal pav", "healthy bowl", "dosa", "cake", "butter chicken", "shake"];
insert("public.search_history", Array.from({ length: 90 }, (_, i) => ({
  id: uid(`search:${i}`), user_id: pid(`reviewer${(i % reviewerNames.length) + 1}`), query: trending[Math.floor(Math.pow(rand(), 1.6) * trending.length)]!,
  created_at: ago(between(10, 60 * 24 * 6)),
})));
out.push(`select public.wallet_apply('${pid("customer1")}', ${paise(250)}, 'topup', 'Added money to wallet', null);`);
out.push(`select public.wallet_apply('${pid("customer1")}', ${paise(150)}, 'cashback', 'Cashback on your order', null);`);
out.push(`select public.wallet_apply('${pid("customer3")}', ${paise(500)}, 'topup', 'Added money to wallet', null);`);
out.push(`select public.wallet_apply('${pid("customer2")}', ${paise(100)}, 'referral_bonus', 'Referral reward: Ananya joined', null);`);
out.push(`update public.profiles set referred_by = '${pid("customer2")}' where id = '${pid("customer3")}';`);
insert("public.referrals", [
  { id: uid("ref:c2c3"), referrer_id: pid("customer2"), referee_id: pid("customer3"), status: "rewarded", reward_paise: paise(100), rewarded_at: ago(60 * 24 * 20) },
]);
insert("public.notifications", [
  { id: uid("notif:1"), user_id: pid("customer1"), type: "offer", title: "WEEKEND60 is live", body: "60% off up to ₹120 this weekend. Treat yourself!", link: "/search?offers=1", read_at: null, created_at: ago(90) },
  { id: uid("notif:2"), user_id: pid("customer1"), type: "info", title: "Welcome to Thaali", body: "Use WELCOME50 on your first order.", link: "/", read_at: ago(60 * 24), created_at: ago(60 * 24 * 30) },
]);
insert("public.table_bookings", [
  { id: uid("booking:1"), booking_code: "TBK7Q2MX", user_id: pid("customer1"), restaurant_id: saffron.id, table_id: uid(`table:Saffron Courtyard:T2`), offer_id: uid("offer:saffron-dining"), booking_date: raw("current_date + 2"), time_slot: "20:00", guests: 4, status: "pending", special_request: "Anniversary dinner, window seat if possible", customer_name: "Priya Sharma", customer_phone: "+919800000021" },
  { id: uid("booking:2"), booking_code: "TBR3W8KP", user_id: pid("customer2"), restaurant_id: saffron.id, table_id: uid(`table:Saffron Courtyard:T4`), offer_id: null, booking_date: raw("current_date + 1"), time_slot: "13:30", guests: 6, status: "confirmed", special_request: null, customer_name: "Rahul Deshpande", customer_phone: "+919800000022" },
]);
const ticketId = uid("ticket:1");
insert("public.support_tickets", [
  { id: ticketId, user_id: pid("customer1"), order_id: demoOrderIds[1]!, subject: "Missing raita in my order", category: "order", status: "open", created_at: ago(60 * 5) },
]);
insert("public.support_messages", [
  { id: uid("smsg:1"), ticket_id: ticketId, sender_id: null, sender_role: "bot", body: "Hi Priya! I'm sorry something went wrong. An agent will reply here shortly.", created_at: ago(60 * 5) },
  { id: uid("smsg:2"), ticket_id: ticketId, sender_id: pid("customer1"), sender_role: "customer", body: "The burani raita I paid for wasn't in the bag.", created_at: ago(60 * 5 - 1) },
]);
insert("public.donations", Array.from({ length: 40 }, (_, i) => ({
  id: uid(`donation:${i}`), user_id: pid(`reviewer${(i % reviewerNames.length) + 1}`), order_id: null, amount_paise: paise(pick([1, 2, 3, 5])), created_at: ago(between(60, 60 * 24 * 30)),
})));
insert("public.analytics_events", approved.flatMap((r) => {
  const rows: Record<string, Val>[] = [];
  const views = int(60, 260);
  for (let i = 0; i < views; i++) {
    const t = between(10, 60 * 24 * 30);
    rows.push({ restaurant_id: r.id, user_id: null, event: "menu_view", created_at: ago(t) });
    if (chance(0.35)) rows.push({ restaurant_id: r.id, user_id: null, event: "add_to_cart", created_at: ago(t - 2) });
  }
  return rows;
}));

out.push(`-- recompute ratings from seeded reviews, keeping the curated headline rating where reviews are few
update public.riders r set rating_count = greatest(r.rating_count, (select count(*) from public.reviews v where v.rider_id = r.id));
commit;`);

const file = path.resolve(__dirname, "../../supabase/seed.sql");
writeFileSync(file, out.join("\n\n") + "\n");
console.log(`wrote ${file}: ${restaurants.length} restaurants, ${itemRows.length} menu items, ${orderRows.length} orders, ${reviewRows.length} reviews`);
