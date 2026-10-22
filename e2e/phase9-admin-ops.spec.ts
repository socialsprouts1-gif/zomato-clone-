import { expect as baseExpect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { formatPaise } from "../src/lib/utils";
import { query } from "./db";
import { BASE, GATEWAY, loginAs, setLocation } from "./helpers";

// Several dev servers share this machine and pages compile on first hit: be patient.
const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ mode: "serial", timeout: 420_000 });
test.use({ navigationTimeout: 150_000, actionTimeout: 20_000 });

const TICKET_SUBJECT = "E2E ops ticket: wrong item delivered";
const EVENT_TITLE = "E2E Ops Event Sufi Night";
const RIDER_NAME = "Salim Sheikh"; // simulated rider: holds no COD cash, so settling it changes nothing else
const RESCUE_ITEMS = "E2E ops rescue box";
const ADJ_NOTE = "E2E ops: missed rain bonus";

let customerId = "";
let ticketId = "";
let riderId = "";
let lastWeek = { start: "", end: "" };
let since = "";
let rescueOrderId: string | null = null;

const n = (v: string | number | null | undefined) => Number(v ?? 0);

/** On phones the desktop table is hidden (and vice versa): pick whichever copy is visible. */
const visible = (l: Locator) => l.filter({ visible: true });

async function cleanup() {
  await query(`delete from support_tickets where subject = $1`, [TICKET_SUBJECT]);
  await query(`delete from events where title like 'E2E Ops Event%'`);
  await query(`delete from food_rescue_listings where items_summary = $1`, [RESCUE_ITEMS]);
  if (riderId && lastWeek.start) await query(`delete from payouts where payee_type = 'rider' and rider_id = $1 and period_start = $2`, [riderId, lastWeek.start]);
}

test.beforeAll(async () => {
  since = new Date().toISOString();
  customerId = (await query<{ id: string }>(`select id from profiles where email = 'customer@demo.in'`))[0]!.id;
  riderId = (await query<{ id: string }>(`select id from riders where name = $1`, [RIDER_NAME]))[0]!.id;
  const [w] = await query<{ s: string; e: string }>(
    `select to_char(date_trunc('week', (now() at time zone 'Asia/Kolkata')::date) - interval '1 week', 'YYYY-MM-DD') s,
            to_char(date_trunc('week', (now() at time zone 'Asia/Kolkata')::date) - interval '1 day', 'YYYY-MM-DD') e`,
  );
  lastWeek = { start: w!.s, end: w!.e };
  await cleanup();
  // A ticket from the demo customer, as /help would create it.
  const [t] = await query<{ id: string }>(`insert into support_tickets (user_id, category, subject) values ($1, 'order', $2) returning id`, [customerId, TICKET_SUBJECT]);
  ticketId = t!.id;
  await query(`insert into support_messages (ticket_id, sender_id, sender_role, body) values ($1, $2, 'customer', 'My biryani was swapped for a paneer dish.')`, [ticketId, customerId]);
  // A claimed Food Rescue listing (this week, so last week's payouts don't move).
  const [o] = await query<{ id: string; restaurant_id: string; lat: number; lng: number }>(
    `select o.id, o.restaurant_id, r.lat, r.lng from orders o join restaurants r on r.id = o.restaurant_id
      where r.slug = 'napoli-fire-oven' and o.status in ('CANCELLED', 'CANCELLED_BY_CUSTOMER', 'REJECTED')
        and not exists (select 1 from food_rescue_listings f where f.order_id = o.id) limit 1`,
  );
  if (o) {
    rescueOrderId = o.id;
    await query(
      `insert into food_rescue_listings (order_id, restaurant_id, lat, lng, items_summary, original_price_paise, rescue_price_paise, status, expires_at, claimed_by, claimed_at)
       values ($1, $2, $3, $4, $5, 64000, 25600, 'claimed', now() + interval '20 minutes', $6, now())`,
      [o.id, o.restaurant_id, o.lat, o.lng, RESCUE_ITEMS, customerId],
    );
  }
});

test.afterAll(async () => {
  await cleanup();
});

async function newCustomerContext(browser: Browser) {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = test.info().project.use;
  const ctx = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL: BASE });
  await setLocation(ctx);
  return ctx;
}

/** Signs in via the Demo Switcher; on a busy dev server the post-login redirect can lag, so fall back to opening the page. */
async function signIn(page: Page, persona: "admin" | "customer", path: string) {
  try {
    await loginAs(page, persona);
  } catch {
    await gotoSettled(page, path);
    await expect(page).not.toHaveURL(/\/login/);
  }
  await gotoSettled(page, path);
}

/** page.goto that retries once when a still-running client navigation (post-login redirect) aborts it. */
async function gotoSettled(page: Page, path: string) {
  try {
    await page.goto(path);
  } catch (e) {
    if (!/ERR_ABORTED|frame was detached|interrupted/.test(String(e))) throw e;
    await page.waitForLoadState().catch(() => undefined);
    await page.goto(path);
  }
}

async function openAdmin(page: Page, path: string) {
  await signIn(page, "admin", path);
}

test("support inbox: admin replies, the customer sees it live; resolve and reopen", async ({ page, browser }) => {
  const ctx = await newCustomerContext(browser);
  const customer = await ctx.newPage();
  await signIn(customer, "customer", `/help/tickets/${ticketId}`);
  await expect(customer.getByTestId("ticket-messages")).toContainText("swapped for a paneer dish");

  await openAdmin(page, "/admin/support?status=open");
  await page.getByRole("searchbox", { name: "Search tickets" }).fill("wrong item delivered");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=wrong/);
  await page.getByRole("link", { name: `Ticket ${TICKET_SUBJECT}` }).click();
  await expect(page).toHaveURL(new RegExp(`/admin/support/${ticketId}$`));
  await expect(page.getByTestId("ticket-status")).toHaveText("Open");

  const reply = `We're sorry! Refund on its way (${test.info().project.name}).`;
  // The chat input is controlled: retry until hydration has picked up the typed text.
  await expect(async () => {
    await page.getByLabel("Message").fill(reply);
    await expect(page.getByRole("button", { name: "Send" })).toBeEnabled({ timeout: 1000 });
  }).toPass({ timeout: 30_000 });
  await page.getByRole("button", { name: "Send" }).click();
  await expect(page.getByTestId("ticket-messages")).toContainText(reply);
  await expect(page.getByTestId("ticket-status")).toHaveText("Awaiting customer");

  // Customer's open page gets the reply without a reload (Realtime, with polling as fallback).
  await expect(customer.getByTestId("ticket-messages")).toContainText(reply);
  await expect(customer.getByTestId("ticket-messages")).toContainText("Thaali support");
  const [notice] = await query<{ n: string }>(`select count(*) n from notifications where user_id = $1 and link = $2 and title = 'Support replied'`, [customerId, `/help/tickets/${ticketId}`]);
  expect(n(notice!.n)).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Resolve ticket" }).click();
  await expect(page.getByTestId("ticket-status")).toHaveText("Resolved");
  expect((await query<{ status: string }>(`select status from support_tickets where id = $1`, [ticketId]))[0]!.status).toBe("resolved");
  await expect(customer.getByTestId("ticket-messages")).toContainText("marked as resolved");

  await page.getByRole("button", { name: "Reopen ticket" }).click();
  await expect(page.getByTestId("ticket-status")).toHaveText("Open");
  expect((await query<{ status: string }>(`select status from support_tickets where id = $1`, [ticketId]))[0]!.status).toBe("open");
  await ctx.close();
});

test("food rescue: totals match the database; donations; event create, edit, deactivate", async ({ page }) => {
  await openAdmin(page, "/admin/rescue");
  const [t] = await query<{ claimed: string; saved: string; available: string; expired: string }>(
    `select count(*) filter (where status = 'claimed') claimed,
            coalesce(sum(original_price_paise - rescue_price_paise) filter (where status = 'claimed'), 0) saved,
            count(*) filter (where status = 'available' and expires_at > now()) available,
            count(*) filter (where status = 'expired' or (status = 'available' and expires_at <= now())) expired
       from food_rescue_listings`,
  );
  await expect(page.getByTestId("rescue-meals")).toHaveText(String(n(t!.claimed)));
  await expect(page.getByTestId("rescue-saved")).toHaveText(formatPaise(n(t!.saved)));
  await expect(page.getByTestId("rescue-available")).toHaveText(String(n(t!.available)));
  await expect(page.getByTestId("rescue-expired")).toHaveText(String(n(t!.expired)));
  if (rescueOrderId) {
    await page.getByRole("link", { name: /^Claimed/ }).click();
    await expect(page).toHaveURL(/status=claimed/);
    const row = visible(page.getByTestId("rescue-row")).filter({ hasText: RESCUE_ITEMS });
    await expect(row).toContainText(formatPaise(25600));
    await expect(row).toContainText(formatPaise(64000));
  }

  await page.getByRole("link", { name: "Donations" }).click();
  await expect(page).toHaveURL(/tab=donations/);
  const [d] = await query<{ total: string; count: string }>(`select coalesce(sum(amount_paise), 0) total, count(*) count from donations`);
  await expect(page.getByTestId("donations-total")).toHaveText(formatPaise(n(d!.total)));
  await expect(page.getByTestId("donations-count")).toHaveText(String(n(d!.count)));
  await expect(page.getByTestId("donations-by-month")).toBeVisible();

  // Events: create
  await page.getByRole("link", { name: "Events", exact: true }).click();
  await expect(page).toHaveURL(/tab=events/);
  await page.getByRole("button", { name: "New event" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Title").fill(EVENT_TITLE);
  await dialog.getByLabel("Category").selectOption("Concert");
  await dialog.getByLabel("Date and time").fill("2026-12-20T19:30");
  await dialog.getByLabel("Venue").fill("Phoenix Marketcity Amphitheatre");
  await dialog.getByLabel("Tier 1 name").fill("Silver");
  await dialog.getByLabel("Tier 1 price (₹)").fill("699");
  await dialog.getByLabel("Tier 1 capacity").fill("120");
  await dialog.getByRole("button", { name: "Add tier" }).click();
  await dialog.getByLabel("Tier 2 name").fill("Gold");
  await dialog.getByLabel("Tier 2 price (₹)").fill("1499");
  await dialog.getByLabel("Tier 2 capacity").fill("30");
  await dialog.getByRole("button", { name: "Create event" }).click();
  await expect(dialog).toBeHidden();
  const card = page.getByTestId("event-row").filter({ hasText: EVENT_TITLE });
  await expect(card).toContainText("Phoenix Marketcity Amphitheatre");
  await expect(card.getByTestId("event-sold")).toContainText("0/150");
  const [ev] = await query<{ id: string; slug: string; tiers: { id: string; name: string; price_paise: number; capacity: number }[]; starts_at: Date; is_active: boolean }>(
    `select id, slug, tiers, starts_at, is_active from events where title = $1`,
    [EVENT_TITLE],
  );
  expect(ev!.is_active).toBe(true);
  expect(ev!.slug).toMatch(/^e2e-ops-event-sufi-night/);
  expect(ev!.tiers.map((x) => [x.name, x.price_paise, x.capacity])).toEqual([["Silver", 69900, 120], ["Gold", 149900, 30]]);
  expect(new Date(ev!.starts_at).toISOString()).toBe("2026-12-20T14:00:00.000Z"); // 19:30 IST

  // Edit: venue and the Gold price; tier ids stay stable
  await card.getByRole("button", { name: `Edit ${EVENT_TITLE}` }).click();
  await dialog.getByLabel("Venue").fill("Mahalaxmi Lawns");
  await dialog.getByLabel("Tier 2 price (₹)").fill("1299");
  await dialog.getByRole("button", { name: "Save changes" }).click();
  await expect(dialog).toBeHidden();
  await expect(card).toContainText("Mahalaxmi Lawns");
  const [ev2] = await query<{ venue: string; tiers: { id: string; price_paise: number }[] }>(`select venue, tiers from events where id = $1`, [ev!.id]);
  expect(ev2!.venue).toBe("Mahalaxmi Lawns");
  expect(ev2!.tiers.map((x) => x.id)).toEqual(ev!.tiers.map((x) => x.id));
  expect(ev2!.tiers[1]!.price_paise).toBe(129900);

  // Deactivate
  await card.getByRole("switch", { name: `${EVENT_TITLE} listed` }).click();
  await expect(card).toContainText("Inactive");
  await expect.poll(async () => (await query<{ is_active: boolean }>(`select is_active from events where id = $1`, [ev!.id]))[0]!.is_active).toBe(false);
});

test("payouts: generate last week for restaurants and riders; adjust, mark paid, locked; CSV", async ({ page }) => {
  await openAdmin(page, "/admin/payouts");
  await page.getByRole("button", { name: /generate statements/i }).click();
  await expect(page.getByText(/Statements ready:/)).toBeVisible({ timeout: 60_000 });

  const [{ restaurants, riders }] = (await query<{ restaurants: string; riders: string }>(
    `select (select count(*) from payouts p join restaurants r on r.id = p.restaurant_id where p.payee_type = 'restaurant' and p.period_start = $1 and r.status = 'approved') restaurants,
            (select count(*) from payouts p join riders r on r.id = p.rider_id where p.payee_type = 'rider' and p.period_start = $1 and r.status = 'approved') riders`,
    [lastWeek.start],
  )) as [{ restaurants: string; riders: string }];
  const [approved] = await query<{ r: string; d: string }>(`select (select count(*) from restaurants where status = 'approved') r, (select count(*) from riders where status = 'approved') d`);
  expect(n(restaurants)).toBe(n(approved!.r));
  expect(n(riders)).toBe(n(approved!.d));

  // Net math holds for every statement of the week.
  const bad = await query(
    `select id from payouts where period_start = $1
       and net_paise <> gross_paise - commission_paise - gst_on_commission_paise + food_rescue_paise - cash_held_paise + adjustments_paise`,
    [lastWeek.start],
  );
  expect(bad).toEqual([]);

  // The rider statement matches rider_earnings directly.
  const [want] = await query<{ trips: string; earnings: string }>(
    `select count(*) filter (where kind = 'delivery') trips, coalesce(sum(total_paise), 0) earnings from rider_earnings
      where rider_id = $1 and created_at >= ($2::date)::timestamp at time zone 'Asia/Kolkata' and created_at < ($3::date + 1)::timestamp at time zone 'Asia/Kolkata'`,
    [riderId, lastWeek.start, lastWeek.end],
  );
  const [rp] = await query<{ id: string; order_count: number; gross_paise: string; cash_held_paise: string; net_paise: string; status: string }>(
    `select id, order_count, gross_paise, cash_held_paise, net_paise, status from payouts where payee_type = 'rider' and rider_id = $1 and period_start = $2`,
    [riderId, lastWeek.start],
  );
  expect(rp!.status).toBe("generated");
  expect(rp!.order_count).toBe(n(want!.trips));
  expect(n(rp!.gross_paise)).toBe(n(want!.earnings));
  const [rider] = await query<{ floating_cash_paise: string }>(`select floating_cash_paise from riders where id = $1`, [riderId]);
  expect(n(rp!.cash_held_paise)).toBe(n(rider!.floating_cash_paise));

  // Filter to riders and open the statement.
  await page.getByRole("navigation", { name: "Payee type" }).getByRole("link", { name: "Riders" }).click();
  await expect(page).toHaveURL(/type=rider/);
  const row = visible(page.getByTestId("payout-row")).filter({ hasText: RIDER_NAME });
  await expect(row).toContainText(formatPaise(n(rp!.net_paise)));
  await visible(page.getByRole("link", { name: new RegExp(RIDER_NAME) })).first().click();
  await expect(page).toHaveURL(new RegExp(`/admin/payouts/${rp!.id}$`));
  await expect(page.getByTestId("payout-gross")).toHaveText(formatPaise(n(rp!.gross_paise)));
  await expect(page.getByTestId("payout-net")).toHaveText(formatPaise(n(rp!.net_paise)));

  // +₹150 adjustment
  await page.getByRole("button", { name: "Add adjustment" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Credit (+)").check();
  await dialog.getByLabel("Amount (₹)").fill("150");
  await dialog.getByLabel("Note").fill(ADJ_NOTE);
  await dialog.getByRole("button", { name: "Save adjustment" }).click();
  await expect(dialog).toBeHidden();
  const netAfter = n(rp!.net_paise) + 15000;
  await expect(page.getByTestId("payout-net")).toHaveText(formatPaise(netAfter));
  await expect(page.getByTestId("payout-adjustments")).toHaveText(`+ ${formatPaise(15000)}`);
  await expect(page.getByTestId("payout-adjustments-list")).toContainText(ADJ_NOTE);

  // Regenerating keeps the adjustment.
  await page.goto("/admin/payouts?type=rider");
  await page.getByRole("button", { name: /generate statements/i }).click();
  await expect(page.getByText(/Statements ready:/)).toBeVisible({ timeout: 60_000 });
  const [kept] = await query<{ adjustments_paise: string; net_paise: string }>(`select adjustments_paise, net_paise from payouts where id = $1`, [rp!.id]);
  expect(n(kept!.adjustments_paise)).toBe(15000);
  expect(n(kept!.net_paise)).toBe(netAfter);

  // CSV export of the week
  // (Fetched with the page's session rather than via a download event: the list may still be refreshing after regenerate.)
  const csvLink = page.getByTestId("payouts-csv");
  await expect(csvLink).toHaveAttribute("download", "");
  const csvRes = await page.request.get((await csvLink.getAttribute("href"))!);
  expect(csvRes.status()).toBe(200);
  expect(csvRes.headers()["content-disposition"]).toContain(`thaali-payouts-${lastWeek.start}.csv`);
  const csv = await csvRes.text();
  expect(csv).toContain(`${rp!.id},rider,${RIDER_NAME},${lastWeek.start},${lastWeek.end}`);
  expect(csv).toContain(`,${(netAfter / 100).toFixed(2)},generated,`);

  // Mark paid → locked
  await page.goto(`/admin/payouts/${rp!.id}`);
  await page.getByRole("button", { name: "Mark as paid" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Mark paid" }).click();
  await expect(page.getByTestId("payout-locked")).toBeVisible();
  await expect(page.getByRole("button", { name: "Add adjustment" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Mark as paid" })).toHaveCount(0);
  const [paid] = await query<{ status: string; paid_at: Date | null; net_paise: string }>(`select status, paid_at, net_paise from payouts where id = $1`, [rp!.id]);
  expect(paid!.status).toBe("paid");
  expect(paid!.paid_at).not.toBeNull();

  // Immutable: regeneration skips it, and even the service role can't edit it through the API.
  await page.goto("/admin/payouts?type=rider&status=paid");
  await expect(visible(page.getByTestId("payout-row")).filter({ hasText: RIDER_NAME })).toContainText("Paid");
  await query(`select public.generate_rider_payout($1, $2::date, $3::date)`, [riderId, lastWeek.start, lastWeek.end]);
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const res = await fetch(`${GATEWAY}/rest/v1/payouts?id=eq.${rp!.id}`, {
    method: "PATCH",
    headers: { apikey: key, authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ adjustments_paise: 0 }),
  });
  expect(res.ok).toBe(false);
  const [after] = await query<{ status: string; net_paise: string; adjustments_paise: string }>(`select status, net_paise, adjustments_paise from payouts where id = $1`, [rp!.id]);
  expect(after).toEqual({ status: "paid", net_paise: String(netAfter), adjustments_paise: "15000" });
});

test("audit log lists the actions above with links and details", async ({ page }) => {
  await openAdmin(page, "/admin/audit");
  await page.getByLabel("Action").selectOption("payout");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/action=payout/);
  const rows = page.getByTestId("audit-row");
  await expect(rows.first()).toBeVisible();
  for (const a of await rows.getByTestId("audit-action").allTextContents()) expect(a).toMatch(/^payout\./);

  const paidRow = rows.filter({ has: page.getByTestId("audit-action").getByText("payout.mark_paid", { exact: true }) }).first();
  await expect(paidRow.getByTestId("audit-entity")).toHaveAttribute("href", `/admin/riders/${riderId}`);
  const adjRow = rows.filter({ has: page.getByTestId("audit-action").getByText("payout.adjust", { exact: true }) }).first();
  await adjRow.getByText("Details").click();
  await expect(adjRow.locator("pre")).toContainText(ADJ_NOTE);
  await expect(adjRow.locator("pre")).toContainText('"amount_paise": 15000');
  await expect(rows.filter({ has: page.getByTestId("audit-action").getByText("payout.generate", { exact: true }) }).first().getByTestId("audit-entity")).toHaveAttribute("href", `/admin/payouts?week=${lastWeek.start}`);

  // Support and event actions from this run are there too, with the right links.
  await page.getByLabel("Action").selectOption("support");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(rows.filter({ hasText: "support.reply" }).first().getByTestId("audit-entity")).toHaveAttribute("href", `/admin/support/${ticketId}`);
  await expect(rows.filter({ hasText: "support.resolve" }).first()).toBeVisible();
  await expect(rows.filter({ hasText: "support.reopen" }).first()).toBeVisible();

  await page.getByLabel("Action").selectOption("event");
  await page.getByRole("button", { name: "Apply" }).click();
  for (const a of ["event.create", "event.update", "event.deactivate"]) await expect(rows.filter({ hasText: a }).first()).toBeVisible();

  // Every action recorded during this run is by the demo admin.
  const entries = await query<{ action: string; name: string }>(
    `select l.action, p.name from admin_audit_log l join profiles p on p.id = l.admin_id where l.created_at >= $1 and (l.action like 'payout.%' or l.action like 'support.%' or l.action like 'event.%')`,
    [since],
  );
  expect(entries.length).toBeGreaterThanOrEqual(8);
  expect(new Set(entries.map((e) => e.action))).toEqual(new Set(["support.reply", "support.resolve", "support.reopen", "event.create", "event.update", "event.deactivate", "payout.generate", "payout.adjust", "payout.mark_paid"]));
});
