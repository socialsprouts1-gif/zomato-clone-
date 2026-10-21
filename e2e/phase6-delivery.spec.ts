import { expect, test, type Browser, type Page } from "@playwright/test";
import { query } from "./db";
import { fillCart, loginAs, placeCodOrder } from "./helpers";

test.describe.configure({ mode: "serial" });
test.setTimeout(150_000);

const status = async (id: string) => (await query<{ s: string }>(`select status s from orders where id = $1`, [id]))[0]!.s;

test.beforeAll(async () => {
  // Clean slate: finish stale test orders and free every rider.
  await query(`update orders set status = 'CANCELLED' where status in ('PLACED','ACCEPTED','PREPARING','READY','RIDER_ASSIGNED','PICKED_UP','OUT_FOR_DELIVERY')`);
  await query(`update riders set current_order_id = null`);
  await query(`update rider_offers set status = 'expired' where status = 'pending'`);
  await query(`update riders set is_online = false where id = (select id from profiles where email = 'rider@demo.in')`);
  await query(`update restaurants set auto_accept = false, is_online = true, busy_until = null where slug = 'saffron-courtyard'`);
  await query(`update wallets set balance_paise = 20000 where user_id = (select id from profiles where email = 'customer@demo.in')`);
});

async function partnerPage(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAs(page, "owner-1");
  await page.goto("/partner");
  return page;
}

async function acceptAndReady(partner: Page, n: string, opts: { ready: boolean }) {
  const card = partner.locator(`[data-testid=partner-order][data-order-number="${n}"]`);
  await expect(card).toBeVisible({ timeout: 15000 });
  await card.getByRole("button", { name: "Accept with 10 minute prep time" }).click();
  if (opts.ready) {
    await partner.getByRole("tab", { name: /preparing/i }).click();
    await card.getByRole("button", { name: /mark food ready/i }).click();
  }
}

test("full lifecycle with a simulated rider moving on the customer's live map", async ({ page, browser }) => {
  await loginAs(page, "customer");
  const id = await placeCodOrder(page);
  const n = (await query<{ n: string }>(`select order_number n from orders where id = $1`, [id]))[0]!.n;
  const partner = await partnerPage(browser);
  await acceptAndReady(partner, n, { ready: false });

  // Customer sees rider assigned + OTP, then the rider moves.
  await expect(page.getByTestId("rider-card")).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId("delivery-otp")).toBeVisible();
  await expect(page.getByRole("img", { name: /🛵|rider/i }).or(page.locator(".thaali-rider-marker")).first()).toBeVisible();
  await expect.poll(async () => Number((await query<{ c: string }>(`select count(*) c from rider_locations where order_id = $1`, [id]))[0]!.c), { timeout: 30000 }).toBeGreaterThan(4);

  await partner.getByRole("tab", { name: /preparing/i }).click();
  await partner.locator(`[data-testid=partner-order][data-order-number="${n}"]`).getByRole("button", { name: /mark food ready/i }).click();

  await expect.poll(() => status(id), { timeout: 90000, intervals: [2000] }).toBe("DELIVERED");
  await expect(page.getByText("Delivered", { exact: true }).first()).toBeVisible({ timeout: 10000 });
  const events = (await query<{ to_status: string }>(`select to_status from order_events where order_id = $1 order by id`, [id])).map((e) => e.to_status);
  for (const s of ["PLACED", "ACCEPTED", "PREPARING", "READY", "RIDER_ASSIGNED", "PICKED_UP", "OUT_FOR_DELIVERY", "DELIVERED"]) expect(events).toContain(s);
  const earnings = await query(`select * from rider_earnings where order_id = $1`, [id]);
  expect(earnings.length).toBe(1);
  await partner.context().close();
});

test("human rider: request card, accept, pickup with order ID, OTP, cash collection", async ({ page, browser }) => {
  const riderCtx = await browser.newContext();
  const rider = await riderCtx.newPage();
  await loginAs(rider, "rider");
  await rider.goto("/rider");
  await rider.getByRole("switch", { name: "Go online" }).click();
  await expect(rider.getByText("You're online", { exact: true })).toBeVisible();

  await loginAs(page, "customer");
  const id = await placeCodOrder(page);
  const n = (await query<{ n: string }>(`select order_number n from orders where id = $1`, [id]))[0]!.n;
  const partner = await partnerPage(browser);
  await acceptAndReady(partner, n, { ready: false });

  const offer = rider.getByTestId("rider-offer");
  await expect(offer).toBeVisible({ timeout: 15000 });
  await expect(offer).toContainText("Saffron Courtyard");
  await offer.getByRole("button", { name: "Accept" }).click();
  const flow = rider.getByTestId("active-delivery");
  await expect(flow).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("rider-card")).toContainText("Arjun Patil", { timeout: 15000 });

  await flow.getByRole("button", { name: /reached restaurant/i }).click();
  await partner.getByRole("tab", { name: /preparing/i }).click();
  await partner.locator(`[data-testid=partner-order][data-order-number="${n}"]`).getByRole("button", { name: /mark food ready/i }).click();
  await expect.poll(() => status(id)).toBe("RIDER_ASSIGNED");

  await rider.reload();
  await rider.getByLabel(/confirm the order id/i).fill("0000");
  await rider.getByRole("button", { name: /picked up/i }).click();
  await expect(rider.getByText(/doesn't match/i)).toBeVisible();
  await rider.getByLabel(/confirm the order id/i).fill(n.slice(-4));
  await rider.getByRole("button", { name: /picked up/i }).click();
  await expect.poll(() => status(id)).toBe("PICKED_UP");
  await rider.getByRole("button", { name: /start delivery/i }).click();
  await expect.poll(() => status(id)).toBe("OUT_FOR_DELIVERY");

  const otp = (await query<{ o: string }>(`select delivery_otp o from orders where id = $1`, [id]))[0]!.o;
  await expect(page.getByTestId("delivery-otp")).toContainText(otp);
  const cashBefore = Number((await query<{ c: string }>(`select floating_cash_paise c from riders where id = (select id from profiles where email='rider@demo.in')`))[0]!.c);
  await rider.getByLabel(/delivery otp/i).fill(otp === "0000" ? "1111" : "0000");
  await rider.getByLabel("Cash collected").click();
  await rider.getByRole("button", { name: /^delivered$/i }).click();
  await expect(rider.getByText(/wrong otp/i)).toBeVisible();
  await rider.getByLabel(/delivery otp/i).fill(otp);
  await rider.getByRole("button", { name: /^delivered$/i }).click();
  await expect.poll(() => status(id)).toBe("DELIVERED");
  const o = (await query<{ p: string; ps: string }>(`select payable_paise p, payment_status ps from orders where id = $1`, [id]))[0]!;
  expect(o.ps).toBe("cod_collected");
  await expect
    .poll(async () => Number((await query<{ c: string }>(`select floating_cash_paise c from riders where id = (select id from profiles where email='rider@demo.in')`))[0]!.c))
    .toBe(cashBefore + Number(o.p));
  await rider.goto("/rider/earnings");
  await expect(rider.getByText(`Order #${n}`)).toBeVisible();

  await rider.goto("/rider");
  await rider.getByRole("switch", { name: "Go online" }).click();
  await riderCtx.close();
  await partner.context().close();
});

test("cancel before acceptance refunds; after acceptance goes to Food Rescue", async ({ page, browser }) => {
  await loginAs(page, "customer");
  await fillCart(page);
  await page.getByRole("switch", { name: "Use Thaali wallet" }).click();
  await page.getByRole("radio", { name: /cash on delivery/i }).click();
  await page.getByTestId("place-order").click();
  await expect(page).toHaveURL(/\/orders\//);
  const id1 = page.url().split("/orders/")[1]!.split("?")[0]!;
  await page.getByRole("button", { name: /cancel order/i }).click();
  await expect(page.getByRole("alertdialog")).toContainText(/full refund/i);
  await page.getByRole("alertdialog").getByRole("button", { name: /cancel order/i }).click();
  await expect.poll(() => status(id1)).toBe("CANCELLED_BY_CUSTOMER");
  const r1 = (await query<{ r: string; u: string }>(`select refund_paise r, wallet_used_paise u from orders where id = $1`, [id1]))[0]!;
  expect(Number(r1.r)).toBe(Number(r1.u));

  const id2 = await placeCodOrder(page);
  const n2 = (await query<{ n: string }>(`select order_number n from orders where id = $1`, [id2]))[0]!.n;
  const partner = await partnerPage(browser);
  await acceptAndReady(partner, n2, { ready: false });
  await expect.poll(() => status(id2)).toBe("PREPARING");
  await page.reload();
  await page.getByRole("button", { name: /cancel order/i }).click();
  await expect(page.getByRole("alertdialog")).toContainText(/food rescue/i);
  await page.getByRole("alertdialog").getByRole("button", { name: /cancel order/i }).click();
  await expect.poll(() => status(id2)).toBe("CANCELLED_BY_CUSTOMER");
  const listing = await query<{ status: string; rescue_price_paise: string; original_price_paise: string }>(`select * from food_rescue_listings where order_id = $1`, [id2]);
  expect(listing[0]?.status).toBe("available");
  expect(Number(listing[0]!.rescue_price_paise)).toBe(Math.round(Number(listing[0]!.original_price_paise) / 2));
  await partner.context().close();
});
