import { expect, test } from "@playwright/test";
import { query } from "./db";
import { loginAs, placeCodOrder } from "./helpers";

test.describe.configure({ mode: "serial" });
test.setTimeout(90_000);

async function unreviewedDelivered() {
  const rows = await query<{ id: string; slug: string }>(
    `select o.id, r.slug from orders o join profiles p on p.id = o.customer_id join restaurants r on r.id = o.restaurant_id
     where p.email = 'customer@demo.in' and o.status = 'DELIVERED' and o.hidden_by_customer = false
       and not exists (select 1 from reviews v where v.order_id = o.id) order by o.created_at desc limit 1`,
  );
  return rows[0]!;
}

test("rate a delivered order (food + delivery separately) and see it on the restaurant page", async ({ page }) => {
  const o = await unreviewedDelivered();
  await loginAs(page, "customer");
  await page.goto(`/orders/${o.id}`);
  await page.getByTestId("post-delivery").getByRole("link", { name: /rate order/i }).click();
  await page.getByRole("radiogroup", { name: "Food rating" }).getByRole("radio", { name: "5 stars" }).click();
  await page.getByRole("button", { name: "Tasty" }).click();
  await page.getByRole("button", { name: "Well packed" }).click();
  const delivery = page.getByRole("radiogroup", { name: "Delivery rating" });
  if (await delivery.count()) {
    await delivery.getByRole("radio", { name: "4 stars" }).click();
    await page.getByRole("button", { name: "On time" }).click();
  }
  const comment = `Playwright review ${Date.now()}`;
  await page.getByLabel("Review").fill(comment);
  await page.getByRole("button", { name: /submit rating/i }).click();
  await expect(page.getByTestId("post-delivery")).toContainText(/you rated the food 5★/i);
  await page.goto(`/restaurant/${o.slug}`);
  await page.getByRole("tab", { name: /reviews/i }).click();
  await expect(page.getByText(comment)).toBeVisible();
});

test("download invoice PDF and reorder", async ({ page }) => {
  const [o] = await query<{ id: string }>(`select o.id from orders o join profiles p on p.id = o.customer_id where p.email = 'customer@demo.in' and o.status = 'DELIVERED' order by o.created_at desc limit 1`);
  await loginAs(page, "customer");
  const res = await page.request.get(`/orders/${o!.id}/invoice`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toBe("application/pdf");
  expect((await res.body()).subarray(0, 4).toString()).toBe("%PDF");
  await page.goto(`/orders/${o!.id}`);
  await page.getByTestId("post-delivery").getByRole("button", { name: /reorder/i }).click();
  await expect(page).toHaveURL(/\/cart/);
  expect(await page.getByTestId("cart-line").count()).toBeGreaterThan(0);
});

test("hide an order from history", async ({ page }) => {
  await loginAs(page, "customer");
  await page.goto("/orders");
  const first = page.locator("main li").filter({ has: page.getByRole("button", { name: /hide this order/i }) }).first();
  const text = await first.locator("p.truncate").first().innerText();
  const n = (await first.innerText()).match(/#(\d+)/)?.[1];
  await first.getByRole("button", { name: /hide this order/i }).click();
  await expect(page.getByText(/hidden from your history/i)).toBeVisible();
  await expect(page.locator("main")).not.toContainText(`#${n}`);
  void text;
});

test("notifications: bell count, list, mark all read", async ({ page }) => {
  await loginAs(page, "customer");
  await query(`update notifications set read_at = now() where user_id = (select id from profiles where email = 'customer@demo.in')`);
  await placeCodOrder(page);
  await expect(page.getByTestId("unread-count")).toBeVisible({ timeout: 15000 });
  await page.getByTestId("notification-bell").click();
  await expect(page).toHaveURL(/\/notifications/);
  await expect(page.getByText("Order placed").first()).toBeVisible();
  await page.getByRole("button", { name: /mark all as read/i }).click();
  await expect(page.getByTestId("unread-count")).toBeHidden({ timeout: 10000 });
});

test("chat with the rider on a live order (simulated rider replies)", async ({ page, browser }) => {
  await query(`update riders set current_order_id = null where is_simulated`);
  await loginAs(page, "customer");
  const id = await placeCodOrder(page);
  const n = (await query<{ n: string }>(`select order_number n from orders where id = $1`, [id]))[0]!.n;
  const pctx = await browser.newContext();
  const partner = await pctx.newPage();
  await loginAs(partner, "owner-1");
  await partner.goto("/partner");
  await partner.locator(`[data-testid=partner-order][data-order-number="${n}"]`).getByRole("button", { name: "Accept with 10 minute prep time" }).click();
  await expect(page.getByTestId("rider-card")).toBeVisible({ timeout: 25000 });
  await page.getByTestId("rider-card").getByRole("button", { name: /chat:/i }).click();
  await page.getByRole("textbox", { name: "Message" }).fill("Please ring the bell twice");
  await page.getByRole("button", { name: "Send message" }).click();
  const msgs = page.getByTestId("chat-messages");
  await expect(msgs).toContainText("Please ring the bell twice");
  await expect(msgs.locator("div.bg-muted")).toHaveCount(1, { timeout: 15000 });
  await pctx.close();
});

test("support ticket from an order with live chat", async ({ page }) => {
  await loginAs(page, "customer");
  const [o] = await query<{ id: string }>(`select o.id from orders o join profiles p on p.id = o.customer_id where p.email = 'customer@demo.in' order by o.created_at desc limit 1`);
  await page.goto(`/help?order=${o!.id}`);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("radio", { name: /missing or wrong items/i }).click();
  await dialog.getByLabel("What happened?").fill("The raita was missing from my bag.");
  await dialog.getByRole("button", { name: /start chat/i }).click();
  await expect(page).toHaveURL(/\/help\/tickets\//);
  const msgs = page.getByTestId("ticket-messages");
  await expect(msgs).toContainText("The raita was missing");
  await expect(msgs).toContainText(/a support agent will reply/i);
  await page.getByRole("textbox", { name: "Message" }).fill("Order number is on the bill");
  await page.getByRole("button", { name: "Send" }).click();
  await expect(msgs).toContainText("Order number is on the bill");
});

test("refund status on a cancelled order", async ({ page }) => {
  await loginAs(page, "customer");
  const [o] = await query<{ id: string }>(`select o.id from orders o join profiles p on p.id = o.customer_id where p.email = 'customer@demo.in' and o.status = 'CANCELLED_BY_CUSTOMER' and o.refund_paise > 0 order by o.created_at desc limit 1`);
  await page.goto(`/orders/${o!.id}`);
  await expect(page.getByTestId("refund-status")).toContainText(/refunded to your thaali wallet/i);
});
