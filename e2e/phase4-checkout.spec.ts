import { expect, test, type Page } from "@playwright/test";
import { query } from "./db";
import { loginAs } from "./helpers";

test.describe.configure({ mode: "serial" });

async function fillCart(page: Page) {
  await page.goto("/restaurant/saffron-courtyard");
  await page.evaluate(() => {
    localStorage.removeItem("thaali.cart");
    localStorage.removeItem("thaali.checkout");
  });
  await page.reload();
  await page.getByRole("button", { name: "Add Hara Bhara Kebab" }).click();
  await page.getByRole("button", { name: "Add one more Hara Bhara Kebab" }).click();
  await page.getByRole("button", { name: "Add Lucknowi Chicken Biryani" }).click();
  await page.getByRole("dialog").getByLabel("Burani raita").click();
  await page.getByRole("dialog").getByRole("button", { name: /add item/i }).click();
  await page.getByTestId("cart-bar").click();
  await expect(page).toHaveURL(/\/cart/);
  await expect(page.getByTestId("cart-line")).toHaveCount(2);
}

async function latestOrder(email: string) {
  const rows = await query<Record<string, number | string | null>>(
    `select o.* from orders o join profiles p on p.id = o.customer_id where p.email = $1 order by o.created_at desc limit 1`,
    [email],
  );
  return rows[0]!;
}

test("WELCOME50 + ₹30 tip + demo UPI payment creates an order with correct server-side totals", async ({ page }) => {
  await query(`delete from coupon_redemptions where user_id = (select id from profiles where email = 'customer@demo.in')`);
  await loginAs(page, "customer");
  await fillCart(page);
  await expect(page.getByText(/delivering to home/i)).toBeVisible();

  await page.getByRole("button", { name: /apply coupon/i }).click();
  await page.getByLabel("Coupon code").fill("WELCOME50");
  await page.getByRole("dialog").getByRole("button", { name: "Apply", exact: true }).first().click();
  await expect(page.getByText(/‘WELCOME50’ applied/)).toBeVisible();
  await expect(page.getByText(/you save ₹100 with WELCOME50/i)).toBeVisible();

  await page.getByRole("radio", { name: "₹30" }).click();
  await page.getByRole("radio", { name: /^UPI/ }).click();
  await page.getByTestId("place-order").click();
  const sheet = page.getByTestId("demo-payment");
  await expect(sheet).toBeVisible();
  await sheet.getByRole("button", { name: "Pay now" }).click();

  await expect(page).toHaveURL(/\/orders\/[0-9a-f-]+/);
  await expect(page.getByText(/order placed!/i)).toBeVisible();

  const o = await latestOrder("customer@demo.in");
  expect(o.status).toMatch(/PLACED|ACCEPTED|PREPARING/);
  expect(o.payment_status).toBe("paid");
  expect(o.coupon_code).toBe("WELCOME50");
  expect(o.tip_paise).toBe(3000);
  expect(o.discount_paise).toBe(10000);
  const items = await query<{ total: string }>(`select sum(total_paise) as total from order_items where order_id = $1`, [o.id]);
  expect(Number(items[0]!.total)).toBe(o.item_total_paise);
  const expected =
    Number(o.item_total_paise) + Number(o.delivery_fee_paise) + Number(o.platform_fee_paise) + Number(o.packaging_fee_paise) +
    Number(o.gst_paise) + Number(o.tip_paise) + Number(o.donation_paise) - Number(o.discount_paise);
  expect(o.total_paise).toBe(expected);
  expect(o.gst_paise).toBe(Math.round(((Number(o.item_total_paise) - Number(o.discount_paise)) * 5) / 100));
  const events = await query<{ to_status: string }>(`select to_status from order_events where order_id = $1 order by id`, [o.id]);
  expect(events.map((e) => e.to_status).slice(0, 2)).toEqual(["PENDING_PAYMENT", "PLACED"]);
});

test("cash on delivery with part paid from the wallet", async ({ page }) => {
  await loginAs(page, "customer");
  await query(`select public.wallet_apply(id, 30000, 'admin_credit', 'Test credit') from profiles where email = 'customer@demo.in'`);
  const before = Number((await query<{ b: string }>(`select balance_paise b from wallets w join profiles p on p.id = w.user_id where p.email = 'customer@demo.in'`))[0]!.b);
  await fillCart(page);
  await page.getByRole("switch", { name: "Use Thaali wallet" }).click();
  await page.getByRole("radio", { name: /cash on delivery/i }).click();
  await expect(page.getByText(/paid from wallet/i)).toBeVisible();
  await page.getByTestId("place-order").click();
  await expect(page).toHaveURL(/\/orders\//);
  const o = await latestOrder("customer@demo.in");
  expect(o.payment_method).toBe("cod");
  expect(o.payment_status).toBe("cod_pending");
  expect(Number(o.wallet_used_paise)).toBe(Math.min(before, Number(o.total_paise)));
  const after = Number((await query<{ b: string }>(`select balance_paise b from wallets w join profiles p on p.id = w.user_id where p.email = 'customer@demo.in'`))[0]!.b);
  expect(after).toBe(before - Number(o.wallet_used_paise));
});

test("coupon rules are enforced on the server", async ({ page }) => {
  await loginAs(page, "customer");
  await fillCart(page);
  await page.getByRole("radio", { name: /credit \/ debit card/i }).click();
  await page.getByRole("button", { name: /apply coupon/i }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByText("Pay with UPI to use this")).toBeVisible();
  await expect(sheet.getByText("Only for Gold members")).toBeVisible();
  await expect(sheet.getByText("Only for your first order")).toBeVisible();
  await sheet.getByLabel("Coupon code").fill("NOTREAL");
  await sheet.getByRole("button", { name: "Apply", exact: true }).first().click();
  await expect(page.getByText(/that code isn't valid/i)).toBeVisible();
});

test("failed payment keeps the cart and marks the order FAILED_PAYMENT", async ({ page }) => {
  await loginAs(page, "customer");
  await fillCart(page);
  await page.getByRole("radio", { name: /^UPI/ }).click();
  await page.getByTestId("place-order").click();
  await page.getByTestId("demo-payment").getByRole("button", { name: "Simulate failure" }).click();
  await expect(page.getByText(/payment failed/i).first()).toBeVisible();
  await expect(page).toHaveURL(/\/cart/);
  await expect(page.getByTestId("cart-line")).toHaveCount(2);
  const o = await latestOrder("customer@demo.in");
  expect(o.status).toBe("FAILED_PAYMENT");
});

test("scheduled order is created as SCHEDULED", async ({ page }) => {
  await loginAs(page, "customer");
  await fillCart(page);
  await page.getByRole("radio", { name: /schedule/i }).click();
  const dlg = page.getByRole("dialog");
  await dlg.locator("button", { hasText: /^[A-Z][a-z]{2}, / }).nth(1).click();
  await dlg.locator("button", { hasText: /\d+:\d\d\s?(am|pm)/i }).first().click();
  await page.getByRole("radio", { name: /cash on delivery/i }).click();
  await page.getByTestId("place-order").click();
  await expect(page.getByText(/order scheduled!/i)).toBeVisible();
  const o = await latestOrder("customer@demo.in");
  expect(o.status).toBe("SCHEDULED");
  expect(o.scheduled_for).not.toBeNull();
});
