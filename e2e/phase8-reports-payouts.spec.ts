import { readFile } from "node:fs/promises";
import { expect as baseExpect, test, type Page } from "@playwright/test";
import { formatPaise } from "../src/lib/utils";
import { query } from "./db";
import { BASE, loginAs } from "./helpers";

test.describe.configure({ mode: "serial", timeout: 180_000 });
// The shared dev machine compiles pages on first hit; give UI assertions room.
const expect = baseExpect.configure({ timeout: 15_000 });
test.use({ navigationTimeout: 60_000, actionTimeout: 20_000 });

const SAFFRON = "saffron-courtyard";
let rid = "";
let lastWeek = { start: "", end: "" };
let rescueOrderId: string | null = null;

const IST_WINDOW = `created_at >= ($2::date)::timestamp at time zone 'Asia/Kolkata' and created_at < ($3::date + 1)::timestamp at time zone 'Asia/Kolkata'`;

/** The report KPIs computed straight from the orders table (independent of public.partner_report). */
async function expectedKpis(from: string, to: string) {
  const [k] = await query<{ placed: string; delivered: string; gross: string; rejected: string; cancelled: string }>(
    `select count(*) placed,
            count(*) filter (where status = 'DELIVERED') delivered,
            coalesce(sum(item_total_paise) filter (where status = 'DELIVERED'), 0) gross,
            count(*) filter (where status = 'REJECTED') rejected,
            count(*) filter (where status in ('CANCELLED', 'CANCELLED_BY_CUSTOMER')) cancelled
       from orders where restaurant_id = $1 and status not in ('PENDING_PAYMENT', 'FAILED_PAYMENT') and ${IST_WINDOW}`,
    [rid, from, to],
  );
  const placed = Number(k!.placed), delivered = Number(k!.delivered), gross = Number(k!.gross), rejected = Number(k!.rejected);
  return {
    placed, delivered, gross, rejected, cancelled: Number(k!.cancelled),
    aov: delivered ? Math.round(gross / delivered) : 0,
    rate: placed ? (Math.round((rejected * 1000) / placed) / 10).toFixed(1) : "0.0",
  };
}

async function istDate(offsetDays: number) {
  const [r] = await query<{ d: string }>(`select to_char((now() at time zone 'Asia/Kolkata')::date + $1::int, 'YYYY-MM-DD') d`, [offsetDays]);
  return r!.d;
}

async function assertKpis(page: Page, from: string, to: string) {
  // Other suites may place orders while this runs; re-read until the page and the DB agree.
  await expect(async () => {
    const want = await expectedKpis(from, to);
    await expect(page.getByTestId("kpi-gross-value")).toHaveText(formatPaise(want.gross), { timeout: 1000 });
    await expect(page.getByTestId("kpi-orders-value")).toHaveText(want.placed.toLocaleString("en-IN"), { timeout: 1000 });
    await expect(page.getByTestId("kpi-orders-sub")).toHaveText(`${want.delivered.toLocaleString("en-IN")} delivered`, { timeout: 1000 });
    await expect(page.getByTestId("kpi-aov-value")).toHaveText(formatPaise(want.aov), { timeout: 1000 });
    await expect(page.getByTestId("kpi-rejected-value")).toHaveText(String(want.rejected), { timeout: 1000 });
    await expect(page.getByTestId("kpi-rejected-sub")).toHaveText(`${want.rate}% rejection rate`, { timeout: 1000 });
    await expect(page.getByTestId("kpi-cancelled-value")).toHaveText(String(want.cancelled), { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

async function openAsOwner(page: Page, path: string) {
  await loginAs(page, "owner-1");
  await page.context().addCookies([{ name: "thaali_outlet", value: rid, domain: new URL(BASE).hostname, path: "/" }]);
  await page.goto(path);
}

async function runPayoutCron(request: import("@playwright/test").APIRequestContext, week?: string) {
  const secret = process.env.CRON_SECRET;
  const res = await request.get(`/api/cron/payouts${week ? `?week=${week}` : ""}`, { headers: secret ? { authorization: `Bearer ${secret}` } : {} });
  expect(res.status()).toBe(200);
  return (await res.json()) as { ok: boolean; period: { start: string; end: string }; generated: number };
}

test.beforeAll(async () => {
  rid = (await query<{ id: string }>(`select id from restaurants where slug = $1`, [SAFFRON]))[0]!.id;
  const [w] = await query<{ s: string; e: string }>(
    `select to_char(date_trunc('week', (now() at time zone 'Asia/Kolkata')::date) - interval '1 week', 'YYYY-MM-DD') s,
            to_char(date_trunc('week', (now() at time zone 'Asia/Kolkata')::date) - interval '1 day', 'YYYY-MM-DD') e`,
  );
  lastWeek = { start: w!.s, end: w!.e };
  // Reset last week's statement so the test can regenerate it with a known adjustment.
  await query(`update payouts set status = 'generated', paid_at = null, adjustments_paise = 0 where restaurant_id = $1 and period_start = $2`, [rid, lastWeek.start]);
  // A Food Rescue sale claimed mid last week (one of last week's customer-cancelled orders).
  const [o] = await query<{ id: string; item_total_paise: number }>(
    `select id, item_total_paise from orders where restaurant_id = $1 and status = 'CANCELLED_BY_CUSTOMER'
       and created_at >= ($2::date)::timestamp at time zone 'Asia/Kolkata' and created_at < ($3::date + 1)::timestamp at time zone 'Asia/Kolkata'
     order by created_at limit 1`,
    [rid, lastWeek.start, lastWeek.end],
  );
  rescueOrderId = o?.id ?? null;
  if (o) {
    await query(
      `insert into food_rescue_listings (order_id, restaurant_id, lat, lng, items_summary, original_price_paise, rescue_price_paise, status, expires_at, claimed_at)
       select $1, $2, lat, lng, 'E2E rescue box', $3, $4, 'claimed', now(), ($5::date + 2)::timestamp at time zone 'Asia/Kolkata' + interval '20 hours'
         from restaurants where id = $2
       on conflict (order_id) do update set status = 'claimed', rescue_price_paise = excluded.rescue_price_paise, claimed_at = excluded.claimed_at`,
      [o.id, rid, o.item_total_paise, Math.round(o.item_total_paise / 2), lastWeek.start],
    );
  }
});

test.afterAll(async () => {
  if (rescueOrderId) await query(`delete from food_rescue_listings where order_id = $1 and items_summary = 'E2E rescue box'`, [rescueOrderId]);
  await query(`update payouts set adjustments_paise = 0 where restaurant_id = $1 and period_start = $2`, [rid, lastWeek.start]);
  await query(`select public.generate_restaurant_payout($1, $2::date, $3::date)`, [rid, lastWeek.start, lastWeek.end]);
});

test("reports: KPIs match SQL across ranges, charts render, CSV export", async ({ page }) => {
  await openAsOwner(page, "/partner/reports");
  await expect(page.getByRole("heading", { name: "Business reports" })).toBeVisible();
  await expect(page.getByRole("button", { name: "7 days" })).toHaveAttribute("aria-pressed", "true");
  const today = await istDate(0);
  await assertKpis(page, await istDate(-6), today);

  // Charts are SVG and responsive.
  await expect(page.getByTestId("chart-trend").locator("svg.recharts-surface")).toBeVisible();
  await expect(page.getByTestId("chart-trend").locator(".recharts-bar-rectangle").first()).toBeVisible();
  await expect(page.getByTestId("chart-hours").locator("svg.recharts-surface")).toBeVisible();
  await expect(page.getByTestId("heatmap").getByTestId("heatmap-row")).toHaveCount(7);
  await expect(page.getByTestId("funnel").getByText("Menu views")).toBeVisible();
  await expect(page.getByTestId("top-dishes").locator("li").first()).toBeVisible();
  const box = await page.getByTestId("chart-trend").boundingBox();
  const vw = page.viewportSize()!.width;
  expect(box!.width).toBeLessThanOrEqual(vw);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);

  // Orders line chart.
  await page.getByRole("tab", { name: "Orders" }).click();
  await expect(page.getByRole("heading", { name: "Orders per day" })).toBeVisible();
  await expect(page.getByTestId("chart-trend").locator(".recharts-line")).toBeVisible();
  await page.getByRole("tab", { name: "By revenue" }).click();
  await expect(page.getByTestId("top-dishes").locator("li").first()).toContainText("₹");

  // 30 days
  await page.getByRole("button", { name: "30 days" }).click();
  await expect(page).toHaveURL(/range=30d/);
  await expect(page.getByRole("button", { name: "30 days" })).toHaveAttribute("aria-pressed", "true");
  await assertKpis(page, await istDate(-29), today);

  // Today
  await page.getByRole("button", { name: "Today" }).click();
  await expect(page).toHaveURL(/range=today/);
  await assertKpis(page, today, today);

  // Custom: a closed historical window (no live traffic), exact match + funnel from analytics_events.
  const from = await istDate(-20), to = await istDate(-10);
  await page.getByRole("button", { name: "Custom" }).click();
  await page.getByLabel("From", { exact: true }).fill(from);
  await page.getByLabel("To", { exact: true }).fill(to);
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(new RegExp(`range=custom&from=${from}&to=${to}`));
  await assertKpis(page, from, to);
  const [ev] = await query<{ views: string; carts: string; checkouts: string }>(
    `select count(*) filter (where event = 'menu_view') views, count(*) filter (where event = 'add_to_cart') carts, count(*) filter (where event = 'checkout_start') checkouts
       from analytics_events where restaurant_id = $1 and ${IST_WINDOW}`,
    [rid, from, to],
  );
  await expect(page.getByTestId("funnel-menu_view")).toHaveText(Number(ev!.views).toLocaleString("en-IN"));
  await expect(page.getByTestId("funnel-add_to_cart")).toHaveText(Number(ev!.carts).toLocaleString("en-IN"));
  await expect(page.getByTestId("funnel-checkout_start")).toHaveText(Number(ev!.checkouts).toLocaleString("en-IN"));
  const [top] = await query<{ name: string }>(
    `select oi.name from order_items oi join orders o on o.id = oi.order_id
      where o.restaurant_id = $1 and o.status = 'DELIVERED' and o.status not in ('PENDING_PAYMENT', 'FAILED_PAYMENT')
        and o.created_at >= ($2::date)::timestamp at time zone 'Asia/Kolkata' and o.created_at < ($3::date + 1)::timestamp at time zone 'Asia/Kolkata'
      group by oi.name order by sum(oi.total_paise) desc, sum(oi.quantity) desc, oi.name limit 1`,
    [rid, from, to],
  );
  await page.getByRole("tab", { name: "By revenue" }).click();
  await expect(page.getByTestId("top-dishes").locator("li").first()).toContainText(top!.name);

  // CSV export for the custom range.
  const [known] = await query<{ n: string; c: string }>(
    `select order_number::text n, (select count(*) from orders where restaurant_id = $1 and status not in ('PENDING_PAYMENT','FAILED_PAYMENT') and ${IST_WINDOW})::text c
       from orders where restaurant_id = $1 and status = 'DELIVERED' and ${IST_WINDOW} order by created_at desc limit 1`,
    [rid, from, to],
  );
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("export-csv").click()]);
  expect(download.suggestedFilename()).toBe(`${SAFFRON}-orders-${from}-to-${to}.csv`);
  const csv = await readFile((await download.path())!, "utf8");
  const lines = csv.trim().split(/\r\n/);
  expect(lines[0]).toBe("Order number,Date,Status,Items,Subtotal (₹),Discount (₹),Total (₹),Payment method");
  expect(lines.length - 1).toBe(Number(known!.c));
  expect(lines.some((l) => l.startsWith(`${known!.n},`) && l.includes("Delivered"))).toBe(true);
});

test("payouts: cron generates last week idempotently; statement math matches DB and UI; CSV", async ({ page, request }) => {
  // Admin adjustment on the open statement, then the weekly job (run twice → still one row).
  await query(`update payouts set adjustments_paise = -5000 where restaurant_id = $1 and period_start = $2`, [rid, lastWeek.start]);
  const first = await runPayoutCron(request);
  expect(first.period).toEqual(lastWeek);
  expect(first.generated).toBeGreaterThan(0);
  await runPayoutCron(request);
  const rows = await query<{ id: string; order_count: number; gross_paise: string; commission_paise: string; gst_on_commission_paise: string; food_rescue_paise: string; adjustments_paise: string; net_paise: string; status: string; pct: string }>(
    `select p.*, r.commission_pct pct from payouts p join restaurants r on r.id = p.restaurant_id
      where p.payee_type = 'restaurant' and p.restaurant_id = $1 and p.period_start = $2`,
    [rid, lastWeek.start],
  );
  expect(rows).toHaveLength(1);
  const p = rows[0]!;
  const n = (v: string | number) => Number(v);
  // Independent recomputation from orders + rescue listings.
  const [src] = await query<{ cnt: string; gross: string; rescue: string }>(
    `select (select count(*) from orders where restaurant_id = $1 and status = 'DELIVERED' and source <> 'food_rescue'
               and delivered_at >= ($2::date)::timestamp at time zone 'Asia/Kolkata' and delivered_at < ($3::date + 1)::timestamp at time zone 'Asia/Kolkata') cnt,
            (select coalesce(sum(item_total_paise + packaging_fee_paise - case when restaurant_offer_id is not null then discount_paise else 0 end), 0) from orders
              where restaurant_id = $1 and status = 'DELIVERED' and source <> 'food_rescue'
               and delivered_at >= ($2::date)::timestamp at time zone 'Asia/Kolkata' and delivered_at < ($3::date + 1)::timestamp at time zone 'Asia/Kolkata') gross,
            (select coalesce(sum(rescue_price_paise), 0) from food_rescue_listings where restaurant_id = $1 and status = 'claimed'
               and claimed_at >= ($2::date)::timestamp at time zone 'Asia/Kolkata' and claimed_at < ($3::date + 1)::timestamp at time zone 'Asia/Kolkata') rescue`,
    [rid, lastWeek.start, lastWeek.end],
  );
  expect(p.order_count).toBe(n(src!.cnt));
  expect(n(p.gross_paise)).toBe(n(src!.gross));
  expect(n(p.commission_paise)).toBe(Math.round((n(p.gross_paise) * Number(p.pct)) / 100));
  expect(n(p.gst_on_commission_paise)).toBe(Math.round((n(p.commission_paise) * 18) / 100));
  expect(n(p.food_rescue_paise)).toBe(n(src!.rescue));
  if (rescueOrderId) expect(n(p.food_rescue_paise)).toBeGreaterThan(0);
  expect(n(p.adjustments_paise)).toBe(-5000);
  expect(n(p.net_paise)).toBe(n(p.gross_paise) - n(p.commission_paise) - n(p.gst_on_commission_paise) + n(p.food_rescue_paise) + n(p.adjustments_paise));

  // A paid statement is never rewritten by the job.
  const [older] = await query<{ id: string; net_paise: string; period_start: string }>(
    `select id, net_paise, to_char(period_start, 'YYYY-MM-DD') period_start from payouts where restaurant_id = $1 and status = 'paid' order by period_start desc limit 1`,
    [rid],
  );
  if (older) {
    await query(`update payouts set net_paise = net_paise + 1 where id = $1`, [older.id]);
    await runPayoutCron(request, older.period_start);
    expect(n((await query<{ net_paise: string }>(`select net_paise from payouts where id = $1`, [older.id]))[0]!.net_paise)).toBe(n(older.net_paise) + 1);
    await query(`update payouts set net_paise = net_paise - 1 where id = $1`, [older.id]);
  }
  // Unfinished weeks are refused.
  const secret = process.env.CRON_SECRET;
  const bad = await request.get(`/api/cron/payouts?week=${await istDate(0)}`, { headers: secret ? { authorization: `Bearer ${secret}` } : {} });
  expect(bad.status()).toBe(400);

  // UI: list → statement.
  await openAsOwner(page, "/partner/payouts");
  await expect(page.getByRole("heading", { name: "This week so far" })).toBeVisible();
  await expect(page.getByTestId("payout-estimate").getByTestId("payout-net")).toContainText("₹");
  const link = page.getByTestId("payout-list").locator(`a[href="/partner/payouts/${p.id}"]`);
  await expect(link).toContainText(formatPaise(n(p.net_paise)));
  await expect(link).toContainText("Generated");
  await expect(page.getByTestId("payout-list").getByText("Paid").first()).toBeVisible();
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/partner/payouts/${p.id}$`), { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: /^Statement/ })).toBeVisible();
  const bd = page.getByTestId("payout-breakdown");
  await expect(bd.getByTestId("payout-gross")).toHaveText(formatPaise(n(p.gross_paise)));
  await expect(bd.getByTestId("payout-commission")).toHaveText(`− ${formatPaise(n(p.commission_paise))}`);
  await expect(bd.getByText(`Commission (${Number(p.pct)}%)`)).toBeVisible();
  await expect(bd.getByTestId("payout-gst")).toHaveText(`− ${formatPaise(n(p.gst_on_commission_paise))}`);
  await expect(bd.getByTestId("payout-rescue")).toHaveText(n(p.food_rescue_paise) ? `+ ${formatPaise(n(p.food_rescue_paise))}` : formatPaise(0));
  await expect(bd.getByTestId("payout-adjustments")).toHaveText(`− ${formatPaise(5000)}`);
  await expect(bd.getByTestId("payout-net")).toHaveText(formatPaise(n(p.net_paise)));
  await expect(page.getByTestId("payout-orders").locator("tbody tr")).toHaveCount(p.order_count);
  if (rescueOrderId) await expect(page.getByText("E2E rescue box")).toBeVisible();

  const [known] = await query<{ n: string }>(
    `select order_number::text n from orders where restaurant_id = $1 and status = 'DELIVERED' and source <> 'food_rescue'
       and delivered_at >= ($2::date)::timestamp at time zone 'Asia/Kolkata' and delivered_at < ($3::date + 1)::timestamp at time zone 'Asia/Kolkata' order by delivered_at limit 1`,
    [rid, lastWeek.start, lastWeek.end],
  );
  await expect(page.getByTestId("payout-orders")).toContainText(`#${known!.n}`);
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("payout-csv").click()]);
  const csv = await readFile((await download.path())!, "utf8");
  expect(csv).toContain("Order number,Delivered at,Item total (₹)");
  expect(csv).toContain(`Net payout,${(n(p.net_paise) / 100).toFixed(2)}`);
  expect(csv).toMatch(new RegExp(`\\r\\n${known!.n},`));

  // Another restaurant's statement is not visible to this owner.
  const [foreign] = await query<{ id: string }>(`select p.id from payouts p join restaurants r on r.id = p.restaurant_id where r.slug = 'green-bowl-co' limit 1`);
  if (foreign) {
    await page.goto(`/partner/payouts/${foreign.id}`);
    await expect(page.getByText("This page went cold")).toBeVisible();
    await expect(page.getByTestId("payout-breakdown")).toHaveCount(0);
  }
});
