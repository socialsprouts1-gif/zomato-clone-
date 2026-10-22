import { expect, test, type Page } from "@playwright/test";
import { query } from "./db";
import { loginAs } from "./helpers";

/**
 * Phase 9 · Admin overview, orders and "Run full demo".
 * Creates its own orders at Napoli Fire Oven for the demo customer, so seeded data stays untouched.
 */
test.describe.configure({ mode: "serial", timeout: 200_000 });

const rupees = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: Number.isInteger(paise / 100) ? 0 : 2 }).format(paise / 100);

let customerId = "";
let restaurantId = "";
let cancelOrder = { id: "", number: 0, amount: 0 };
let reassignOrder = { id: "", number: 0, riderId: "" };

async function insertOrder(status: string, extra: Record<string, unknown>) {
  const cols = ["customer_id", "restaurant_id", "status", "customer_name", "customer_phone", "delivery_address", "item_total_paise", "total_paise", ...Object.keys(extra)];
  const vals = [customerId, restaurantId, status, "Priya Sharma", "+919800000001", JSON.stringify({ label: "Home", line1: "Lane 5, Koregaon Park", lat: 18.5385, lng: 73.8925 }), 45000, 51200, ...Object.values(extra)];
  const [row] = await query<{ id: string; order_number: string }>(
    `insert into orders (${cols.join(",")}) values (${cols.map((_, i) => `$${i + 1}`).join(",")}) returning id, order_number`,
    vals,
  );
  await query(`insert into order_items (order_id, name, quantity, unit_price_paise, total_paise, is_veg) values ($1, 'E2E Margherita', 1, 45000, 45000, true)`, [row!.id]);
  await query(`insert into order_events (order_id, from_status, to_status, actor_role, note) values ($1, null, 'PENDING_PAYMENT', 'customer', 'Checkout · wallet'), ($1, 'PENDING_PAYMENT', 'PLACED', 'system', 'Paid from wallet')`, [row!.id]);
  return { id: row!.id, number: Number(row!.order_number) };
}

test.beforeAll(async () => {
  customerId = (await query<{ id: string }>(`select id from profiles where email = 'customer@demo.in'`))[0]!.id;
  restaurantId = (await query<{ id: string }>(`select id from restaurants where slug = 'napoli-fire-oven'`))[0]!.id;
  // Finish any demo order left running by an earlier run so "Run full demo" starts a fresh one.
  await query(`update riders set current_order_id = null where current_order_id in (select id from orders where is_demo and source = 'demo' and status not in ('DELIVERED','CANCELLED','CANCELLED_BY_CUSTOMER','REJECTED','FAILED_PAYMENT'))`);
  await query(`update orders set status = 'CANCELLED', cancelled_at = now(), cancel_reason = 'e2e reset' where is_demo and source = 'demo' and status not in ('DELIVERED','CANCELLED','CANCELLED_BY_CUSTOMER','REJECTED','FAILED_PAYMENT')`);

  // A wallet-paid order to cancel and refund.
  const a = await insertOrder("PLACED", { payment_method: "wallet", payment_status: "paid", wallet_used_paise: 51200, payable_paise: 0, placed_at: new Date().toISOString() });
  cancelOrder = { ...a, amount: 51200 };

  // A cooking order with a simulated rider, to reassign.
  const [rider] = await query<{ id: string }>(`select id from riders where is_simulated and status = 'approved' and is_online and current_order_id is null order by name limit 1`);
  const b = await insertOrder("PREPARING", {
    payment_method: "cod", payment_status: "cod_pending", payable_paise: 51200, placed_at: new Date().toISOString(), accepted_at: new Date().toISOString(), prep_minutes: 30,
    rider_id: rider!.id, rider_assigned_at: new Date().toISOString(),
  });
  await query(`update riders set current_order_id = $2 where id = $1`, [rider!.id, b.id]);
  reassignOrder = { ...b, riderId: rider!.id };
});

test.afterAll(async () => {
  const ids = [cancelOrder.id, reassignOrder.id].filter(Boolean);
  if (!ids.length) return;
  await query(`update riders set current_order_id = null where current_order_id = any($1::uuid[])`, [ids]);
  await query(`update orders set status = 'CANCELLED', cancelled_at = coalesce(cancelled_at, now()), cancel_reason = coalesce(cancel_reason, 'e2e cleanup') where id = any($1::uuid[]) and status not in ('CANCELLED','DELIVERED')`, [ids]);
});

/** Today's KPIs straight from SQL, with the same definitions the dashboard documents. */
async function sqlKpis() {
  const [k] = await query<{ orders: string; cancelled: string; gmv: string; riders: string; restaurants: string }>(`
    with o as (
      select status, total_paise, status in ('REJECTED','CANCELLED','CANCELLED_BY_CUSTOMER') as cancelled from orders
      where (created_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date
        and status not in ('PENDING_PAYMENT','FAILED_PAYMENT'))
    select count(*) orders, count(*) filter (where cancelled) cancelled, coalesce(sum(total_paise) filter (where not cancelled), 0) gmv,
      (select count(*) from riders where status = 'approved' and is_online) riders,
      (select count(*) from restaurants where status = 'approved' and is_online) restaurants
    from o`);
  const orders = Number(k!.orders);
  const cancelled = Number(k!.cancelled);
  const gmv = Number(k!.gmv);
  return {
    orders,
    gmv,
    aov: orders - cancelled > 0 ? Math.round(gmv / (orders - cancelled)) : 0,
    rate: orders > 0 ? Math.round((cancelled * 1000) / orders) / 10 : 0,
    riders: Number(k!.riders),
    restaurants: Number(k!.restaurants),
  };
}

/** Clicks until the dialog shows (the first click can land before hydration in dev). */
async function openDialog(page: Page, button: string, role: "dialog" | "alertdialog") {
  await expect(async () => {
    if (!(await page.getByRole(role).isVisible())) await page.getByRole("button", { name: button }).click();
    await expect(page.getByRole(role)).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30_000 });
  return page.getByRole(role);
}

async function openOrder(page: Page, orderNumber: number) {
  await page.goto("/admin/orders");
  await page.getByLabel("Search").fill(String(orderNumber));
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(new RegExp(`q=${orderNumber}`));
  await expect(page.getByTestId("orders-count")).toHaveText("1 order");
  await page.getByRole("link", { name: `#${orderNumber}`, exact: false }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: new RegExp(`Order #${orderNumber}`) })).toBeVisible({ timeout: 20_000 });
}

test("overview KPIs match the database for today", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  await expect(page.getByTestId("chart-trend")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Live city map" })).toBeVisible();
  // Other suites may place orders meanwhile, so compare against a fresh query until both agree.
  await expect(async () => {
    await page.reload();
    const k = await sqlKpis();
    await expect(page.getByTestId("kpi-orders-value")).toHaveText(String(k.orders), { timeout: 3000 });
    await expect(page.getByTestId("kpi-gmv-value")).toHaveText(rupees(k.gmv), { timeout: 1000 });
    await expect(page.getByTestId("kpi-aov-value")).toHaveText(rupees(k.aov), { timeout: 1000 });
    await expect(page.getByTestId("kpi-cancel-value")).toHaveText(`${k.rate}%`, { timeout: 1000 });
    await expect(page.getByTestId("kpi-riders-value")).toHaveText(String(k.riders), { timeout: 1000 });
    await expect(page.getByTestId("kpi-restaurants-value")).toHaveText(String(k.restaurants), { timeout: 1000 });
  }).toPass({ timeout: 60_000 });
  // Range switch reloads the series.
  await page.getByRole("tab", { name: "30 days" }).click();
  await expect(page.getByText("Last 30 days, India time")).toBeVisible();
  await page.getByRole("tab", { name: "GMV" }).click();
  await expect(page.getByRole("heading", { name: "GMV per day" })).toBeVisible();
});

test("search an order by number and open its detail with timeline", async ({ page }) => {
  await loginAs(page, "admin");
  await openOrder(page, cancelOrder.number);
  const timeline = page.getByTestId("order-timeline");
  await expect(timeline.getByText("Order placed")).toBeVisible();
  await expect(timeline.getByText(/Paid from wallet/)).toBeVisible();
  await expect(page.getByText("1 × E2E Margherita")).toBeVisible();
  await expect(page.getByTestId("payment-panel").getByText("Thaali wallet")).toBeVisible();
  // Filters narrow the list server-side.
  await page.goto(`/admin/orders?q=Napoli&status=cancelled&method=cod`);
  await expect(page.getByLabel("Status")).toHaveValue("cancelled");
});

test("cancel with refund to wallet credits the customer exactly once", async ({ page }) => {
  const before = Number((await query<{ b: string }>(`select balance_paise b from wallets where user_id = $1`, [customerId]))[0]!.b);
  await loginAs(page, "admin");
  await openOrder(page, cancelOrder.number);
  const dialog = await openDialog(page, "Cancel order", "alertdialog");
  await expect(dialog.getByText(`${rupees(cancelOrder.amount)} paid will be refunded`)).toBeVisible();
  await dialog.getByLabel("Reason").selectOption("Restaurant can't fulfil the order");
  await dialog.getByLabel("Note (optional)").fill("Oven broke down");
  await dialog.getByRole("button", { name: "Cancel and refund" }).click();
  await expect(page.getByText(`Order cancelled · ${rupees(cancelOrder.amount)} refunded`)).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Cancelled by support")).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel order" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Refund" })).toHaveCount(0);

  const after = Number((await query<{ b: string }>(`select balance_paise b from wallets where user_id = $1`, [customerId]))[0]!.b);
  expect(after - before).toBe(cancelOrder.amount);
  const txns = await query(`select id from wallet_transactions where reference_id = $1 and type = 'refund'`, [cancelOrder.id]);
  expect(txns).toHaveLength(1);
  const [o] = await query<{ status: string; refund_paise: number; refund_to: string; cancel_reason: string }>(`select status, refund_paise, refund_to, cancel_reason from orders where id = $1`, [cancelOrder.id]);
  expect(o).toMatchObject({ status: "CANCELLED", refund_paise: cancelOrder.amount, refund_to: "wallet", cancel_reason: "Restaurant can't fulfil the order: Oven broke down" });
  const audit = await query<{ details: { refund_paise: number } }>(`select details from admin_audit_log where action = 'order.cancel' and entity_id = $1`, [cancelOrder.id]);
  expect(audit).toHaveLength(1);
  expect(audit[0]!.details.refund_paise).toBe(cancelOrder.amount);
  const [ev] = await query<{ n: string }>(`select count(*) n from order_events where order_id = $1 and to_status = 'CANCELLED' and actor_role = 'admin'`, [cancelOrder.id]);
  expect(Number(ev!.n)).toBeGreaterThanOrEqual(1);
  const notes = await query(`select id from notifications where user_id = $1 and link = $2 and title = 'Cancelled'`, [customerId, `/orders/${cancelOrder.id}`]);
  expect(notes.length).toBeGreaterThanOrEqual(1);

  // A second attempt (stale tab) is refused and moves no money.
  await page.reload();
  await expect(page.getByTestId("payment-panel").getByText(`${rupees(cancelOrder.amount)} to wallet`)).toBeVisible();
  const again = Number((await query<{ b: string }>(`select balance_paise b from wallets where user_id = $1`, [customerId]))[0]!.b);
  expect(again).toBe(after);
});

test("reassign the rider of a cooking order", async ({ page }) => {
  await loginAs(page, "admin");
  await openOrder(page, reassignOrder.number);
  const dialog = await openDialog(page, "Reassign rider", "dialog");
  const choice = dialog.getByRole("radio").first();
  await expect(choice).toBeVisible({ timeout: 45_000 });
  const newName = (await choice.getAttribute("aria-label"))!;
  await choice.click();
  await dialog.getByRole("button", { name: "Assign" }).click();
  await expect(page.getByText(`Assigned to ${newName}`)).toBeVisible();
  await expect(page.getByTestId("rider-panel").getByText(newName)).toBeVisible();
  await expect(page.getByTestId("order-timeline").getByText(new RegExp(`Rider reassigned by support: .* → ${newName}`))).toBeVisible();

  const [o] = await query<{ rider_id: string; status: string }>(`select rider_id, status from orders where id = $1`, [reassignOrder.id]);
  expect(o!.rider_id).not.toBe(reassignOrder.riderId);
  expect(o!.status).toBe("PREPARING");
  const [oldRider] = await query<{ current_order_id: string | null }>(`select current_order_id from riders where id = $1`, [reassignOrder.riderId]);
  expect(oldRider!.current_order_id).toBeNull();
  const [newRider] = await query<{ current_order_id: string | null; name: string }>(`select current_order_id, name from riders where id = $1`, [o!.rider_id]);
  expect(newRider).toMatchObject({ current_order_id: reassignOrder.id, name: newName });
  const audit = await query(`select id from admin_audit_log where action = 'order.reassign_rider' and entity_id = $1`, [reassignOrder.id]);
  expect(audit).toHaveLength(1);
});

test("Run full demo takes an order from placed to delivered", async ({ page }) => {
  test.setTimeout(200_000);
  await loginAs(page, "admin");
  await page.goto("/admin");
  const panel = page.getByTestId("demo-panel");
  const started = new Date();
  await expect(async () => {
    if (!(await panel.getByTestId("demo-status").isVisible())) await panel.getByRole("button", { name: "Run full demo" }).click();
    await expect(panel.getByTestId("demo-status")).toBeVisible({ timeout: 8000 });
  }).toPass({ timeout: 40_000 });
  await expect(panel.getByTestId("demo-status")).toBeVisible();
  for (const label of ["Customer tracking", "Partner board", "Rider app", "Admin order"]) await expect(panel.getByRole("link", { name: new RegExp(label) })).toBeVisible();

  const [demo] = await query<{ id: string }>(`select id from orders where is_demo and source = 'demo' and created_at >= $1 order by created_at desc limit 1`, [new Date(started.getTime() - 5000).toISOString()]);
  expect(demo).toBeTruthy();
  await expect(panel.getByRole("link", { name: /Customer tracking/ })).toHaveAttribute("href", `/orders/${demo!.id}`);

  await expect
    .poll(async () => (await query<{ status: string }>(`select status from orders where id = $1`, [demo!.id]))[0]!.status, { timeout: 120_000, intervals: [2000] })
    .toBe("DELIVERED");
  const steps = await query<{ to_status: string }>(`select distinct to_status from order_events where order_id = $1`, [demo!.id]);
  expect(steps.map((s) => s.to_status).sort()).toEqual(["ACCEPTED", "DELIVERED", "OUT_FOR_DELIVERY", "PENDING_PAYMENT", "PICKED_UP", "PLACED", "PREPARING", "READY", "RIDER_ASSIGNED"].sort());
  await expect(panel.getByTestId("demo-status")).toHaveAttribute("data-status", "DELIVERED", { timeout: 10_000 });
  await expect(panel.getByText(/Delivered in \d+ s/)).toBeVisible();
  const audit = await query(`select id from admin_audit_log where action = 'demo.run' and entity_id = $1`, [demo!.id]);
  expect(audit).toHaveLength(1);
});
