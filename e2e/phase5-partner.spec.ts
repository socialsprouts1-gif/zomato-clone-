import { expect, test } from "@playwright/test";
import { query } from "./db";
import { loginAs, placeCodOrder } from "./helpers";

test.describe.configure({ mode: "serial" });

async function orderNumber(id: string) {
  return (await query<{ n: string }>(`select order_number n from orders where id = $1`, [id]))[0]!.n;
}
async function status(id: string) {
  return (await query<{ s: string }>(`select status s from orders where id = $1`, [id]))[0]!.s;
}

test.beforeAll(async () => {
  await query(`update restaurants set auto_accept = false, is_online = true, busy_until = null where slug = 'saffron-courtyard'`);
  await query(`select public.wallet_apply(id, 50000, 'admin_credit', 'Test credit') from profiles where email = 'customer@demo.in'`);
});

test("order placed in tab A appears instantly in partner tab B with alert, then accept → ready", async ({ browser }) => {
  const partnerCtx = await browser.newContext();
  await partnerCtx.grantPermissions(["notifications"]);
  await partnerCtx.addInitScript(() => {
    const w = window as unknown as { __notes: string[] };
    w.__notes = [];
    class FakeNotification {
      static permission = "granted";
      static requestPermission = async () => "granted";
      onclick: (() => void) | null = null;
      constructor(title: string) {
        w.__notes.push(title);
      }
      close() {}
    }
    (window as unknown as { Notification: unknown }).Notification = FakeNotification;
  });
  const partner = await partnerCtx.newPage();
  await loginAs(partner, "owner-1");
  await partner.goto("/partner");
  await partner.getByTestId("enable-alerts").click();
  await expect(partner.getByTestId("enable-alerts")).toBeHidden();
  await expect(partner.getByText("Live", { exact: true })).toBeVisible({ timeout: 10000 });

  const customerCtx = await browser.newContext();
  const customer = await customerCtx.newPage();
  await loginAs(customer, "customer");
  const id = await placeCodOrder(customer);
  const n = await orderNumber(id);

  // Realtime: well under the 10 s polling fallback.
  const card = partner.locator(`[data-testid=partner-order][data-order-number="${n}"]`);
  await expect(card).toBeVisible({ timeout: 5000 });
  await expect(partner.getByText(`New order #${n}`).first()).toBeVisible();
  expect(await partner.evaluate(() => (window as unknown as { __notes: string[] }).__notes)).toContain(`New order #${n}`);

  await card.getByRole("button", { name: "Accept with 15 minute prep time" }).click();
  await expect.poll(() => status(id)).toBe("PREPARING");
  await partner.getByRole("tab", { name: /preparing/i }).click();
  await expect(card.getByText(/ready in/i)).toBeVisible();
  await card.getByRole("button", { name: /mark food ready/i }).click();
  await expect.poll(() => status(id)).toMatch(/READY|RIDER_ASSIGNED/);

  const events = await query<{ to_status: string; actor_role: string }>(`select to_status, actor_role from order_events where order_id = $1 order by id`, [id]);
  expect(events.map((e) => e.to_status)).toEqual(expect.arrayContaining(["PLACED", "ACCEPTED", "PREPARING", "READY"]));
  expect(events.find((e) => e.to_status === "ACCEPTED")?.actor_role).toBe("restaurant");
  await partnerCtx.close();
  await customerCtx.close();
});

test("reject refunds the customer's wallet share", async ({ page, browser }) => {
  const customerCtx = await browser.newContext();
  const customer = await customerCtx.newPage();
  await loginAs(customer, "customer");
  await customer.goto("/restaurant/saffron-courtyard");
  const id = await (async () => {
    const { fillCart } = await import("./helpers");
    await fillCart(customer);
    await customer.getByRole("switch", { name: "Use Thaali wallet" }).click();
    await customer.getByRole("radio", { name: /cash on delivery/i }).click();
    await customer.getByTestId("place-order").click();
    await expect(customer).toHaveURL(/\/orders\//);
    return customer.url().split("/orders/")[1]!.split("?")[0]!;
  })();
  const used = Number((await query<{ w: string }>(`select wallet_used_paise w from orders where id = $1`, [id]))[0]!.w);
  expect(used).toBeGreaterThan(0);
  const before = Number((await query<{ b: string }>(`select balance_paise b from wallets w join profiles p on p.id = w.user_id where p.email = 'customer@demo.in'`))[0]!.b);

  await loginAs(page, "owner-1");
  await page.goto("/partner");
  const n = await orderNumber(id);
  const card = page.locator(`[data-testid=partner-order][data-order-number="${n}"]`);
  await card.getByRole("button", { name: /reject/i }).click();
  await page.getByRole("button", { name: "Kitchen too busy" }).click();
  await page.getByRole("button", { name: "Reject order" }).click();
  await expect.poll(() => status(id)).toBe("REJECTED");
  const after = Number((await query<{ b: string }>(`select balance_paise b from wallets w join profiles p on p.id = w.user_id where p.email = 'customer@demo.in'`))[0]!.b);
  expect(after).toBe(before + used);
  await customerCtx.close();
});

test("auto-accept moves new orders straight into preparing", async ({ page, browser }) => {
  await loginAs(page, "owner-1");
  await page.goto("/partner");
  await page.getByRole("switch", { name: "Auto-accept orders" }).click();
  await expect(page.getByText(/accepted automatically/i)).toBeVisible();
  const customerCtx = await browser.newContext();
  const customer = await customerCtx.newPage();
  await loginAs(customer, "customer");
  const id = await placeCodOrder(customer);
  await expect.poll(() => status(id)).toMatch(/PREPARING|READY|RIDER_ASSIGNED/);
  const ev = await query<{ note: string | null }>(`select note from order_events where order_id = $1 and to_status = 'ACCEPTED' and from_status = 'PLACED'`, [id]);
  expect(ev[0]?.note).toBe("Auto-accepted");
  await page.getByRole("switch", { name: "Auto-accept orders" }).click();
  await customerCtx.close();
});

test("KOT print view and outlet switcher", async ({ page }) => {
  await loginAs(page, "owner-1");
  const [o] = await query<{ id: string }>(`select o.id from orders o join restaurants r on r.id = o.restaurant_id where r.slug = 'saffron-courtyard' order by o.created_at desc limit 1`);
  await page.goto(`/partner/orders/${o!.id}/kot`);
  await expect(page.getByTestId("kot")).toContainText("KITCHEN ORDER TICKET");
  await page.goto("/partner");
  await page.getByRole("button", { name: "Switch outlet" }).click();
  await page.getByRole("menuitem", { name: /napoli fire oven/i }).click();
  await expect(page.getByRole("heading", { name: "Live orders" })).toBeVisible();
  await expect(page.getByText(/Napoli Fire Oven · Koregaon Park/)).toBeVisible();
  await page.getByRole("button", { name: "Switch outlet" }).click();
  await page.getByRole("menuitem", { name: /saffron courtyard/i }).click();
  await expect(page.getByText(/Saffron Courtyard · Koregaon Park/)).toBeVisible();
});
