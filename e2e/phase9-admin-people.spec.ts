import { expect as baseExpect, test, type Browser, type Locator, type Page } from "@playwright/test";
import { query } from "./db";
import { BASE, loginAs, setLocation } from "./helpers";

// Several dev servers share this machine and pages compile on first hit: be patient.
const expect = baseExpect.configure({ timeout: 45_000 });
test.describe.configure({ mode: "serial", timeout: 180_000 });
test.use({ navigationTimeout: 90_000 });

const KATHI = "kolkata-kathi-co";
const SUSPEND_SLUG = "frozen-spoon";
const RIDER_EMAIL = "rider.applicant@demo.in";
const BLOCK_EMAIL = "customer2@demo.in";
const CREDIT_EMAIL = "customer3@demo.in";
const CREDIT_NOTE = "E2E goodwill credit";

type Snap = { id: string; status: string; is_online: boolean; commission_pct: string; name: string };
let kathi: Snap;
let spoon: Snap;
let riderId = "";
let since = "";

async function restore() {
  await query(`update restaurants set status = 'pending', is_online = $2 where id = $1`, [kathi.id, kathi.is_online]);
  await query(`update restaurants set status = 'approved', is_online = $2, commission_pct = $3 where id = $1`, [spoon.id, spoon.is_online, spoon.commission_pct]);
  await query(`update riders set status = 'pending', is_online = false where id = $1`, [riderId]);
  await query(`update profiles set is_blocked = false where email in ($1, $2)`, [BLOCK_EMAIL, CREDIT_EMAIL]);
  // Undo test wallet credits so balances stay as seeded.
  const credits = await query<{ id: string; user_id: string; amount_paise: string }>(
    `select t.id, t.user_id, t.amount_paise from wallet_transactions t join profiles p on p.id = t.user_id where p.email = $1 and t.type = 'admin_credit' and t.description = $2`,
    [CREDIT_EMAIL, CREDIT_NOTE],
  );
  for (const c of credits) {
    await query(`update wallets set balance_paise = balance_paise - $2 where user_id = $1`, [c.user_id, c.amount_paise]);
    await query(`delete from wallet_transactions where id = $1`, [c.id]);
  }
}

test.beforeAll(async () => {
  since = new Date().toISOString();
  const snap = (slug: string) => query<Snap>(`select id, name, status, is_online, commission_pct from restaurants where slug = $1`, [slug]).then((r) => r[0]!);
  kathi = await snap(KATHI);
  spoon = await snap(SUSPEND_SLUG);
  // Earlier aborted runs may have left these changed.
  if (spoon.commission_pct === "17.50") spoon.commission_pct = "20.00";
  const [r] = await query<{ id: string }>(`select id from profiles where email = $1`, [RIDER_EMAIL]);
  riderId = r!.id;
  await restore();
});

test.afterAll(async () => {
  await restore();
});

/** A separate browser (same device profile) for the affected customer. */
async function newUserContext(browser: Browser) {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch } = test.info().project.use;
  const ctx = await browser.newContext({ viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL: BASE });
  await setLocation(ctx);
  return ctx;
}

/**
 * Other agents edit this checkout while tests run, so the dev server may hot-reload the page mid-dialog.
 * Runs `steps` until `done` shows, skipping them once it already does (so nothing is applied twice).
 */
async function untilDone(steps: () => Promise<void>, done: Locator) {
  const page = done.page();
  await expect(async () => {
    if (await done.isVisible()) return;
    if (await page.getByRole("dialog").or(page.getByRole("alertdialog")).isVisible()) await page.keyboard.press("Escape");
    await steps();
    await expect(done).toBeVisible({ timeout: 10_000 });
  }).toPass({ timeout: 150_000, intervals: [1_000, 2_000, 5_000] });
}

/** The list renders cards on phones and a table on desktop; pick whichever is visible. */
const visibleRow = (page: Page, testId: string, name: string) => page.getByTestId(testId).filter({ visible: true }).filter({ hasText: name }).first();

test("admin approves a pending restaurant; it goes live on the customer app", async ({ page, browser }) => {
  await loginAs(page, "admin");
  await page.goto("/admin/restaurants?status=pending");
  await page.getByRole("searchbox", { name: "Search restaurants" }).fill("Kolkata");
  await page.getByRole("button", { name: "Search" }).click();
  await expect(page).toHaveURL(/q=Kolkata/);
  await visibleRow(page, "admin-restaurant-row", kathi.name).getByText(kathi.name).click();
  await expect(page.getByRole("heading", { name: kathi.name })).toBeVisible();
  await expect(page.getByText("27AAB0099C1Z9")).toBeVisible(); // GSTIN from onboarding
  await expect(page.getByText("HDFC0001234")).toBeVisible();
  await expect(page.getByTestId("restaurant-status")).toHaveText("Pending");

  await untilDone(async () => {
    await page.getByRole("button", { name: "Approve" }).click({ timeout: 10_000 });
    await page.getByRole("alertdialog").getByRole("button", { name: "Approve restaurant" }).click({ timeout: 10_000 });
  }, page.getByTestId("restaurant-status").filter({ hasText: "Approved" }));

  const [row] = await query<{ status: string }>(`select status from restaurants where id = $1`, [kathi.id]);
  expect(row!.status).toBe("approved");
  const notes = await query(`select 1 from notifications n join profiles p on p.id = n.user_id where p.email = 'newpartner@demo.in' and n.title = $1 and n.created_at > $2`, [`${kathi.name} is approved`, since]);
  expect(notes.length).toBeGreaterThan(0);
  const audit = await query(`select 1 from admin_audit_log where action = 'restaurant.approve' and entity_id = $1 and created_at > $2`, [kathi.id, since]);
  expect(audit.length).toBe(1);

  // A customer now sees it on the home feed.
  const ctx = await newUserContext(browser);
  const customer = await ctx.newPage();
  await customer.goto("/");
  await expect(customer.getByTestId("restaurant-card").filter({ hasText: kathi.name }).first()).toBeVisible();
  await ctx.close();
});

test("admin suspends and reinstates a restaurant and sets its commission", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto(`/admin/restaurants/${spoon.id}`);
  await expect(page.getByRole("heading", { name: spoon.name })).toBeVisible();

  await untilDone(async () => {
    await page.getByRole("button", { name: "Suspend" }).click({ timeout: 10_000 });
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("button", { name: "Hygiene audit failed" }).click({ timeout: 10_000 });
    await dialog.getByRole("button", { name: "Suspend restaurant" }).click({ timeout: 10_000 });
  }, page.getByTestId("restaurant-status").filter({ hasText: "Suspended" }));
  await expect(page.getByText("Suspension reason:")).toBeVisible();
  const [s1] = await query<{ status: string; is_online: boolean }>(`select status, is_online from restaurants where id = $1`, [spoon.id]);
  expect(s1).toEqual({ status: "suspended", is_online: false });

  await untilDone(async () => {
    await page.getByRole("button", { name: "Lift suspension" }).click({ timeout: 10_000 });
    await page.getByRole("alertdialog").getByRole("button", { name: "Lift suspension" }).click({ timeout: 10_000 });
  }, page.getByTestId("restaurant-status").filter({ hasText: "Approved" }));

  await untilDone(async () => {
    await page.getByLabel("Commission %").fill("17.5", { timeout: 10_000 });
    await page.getByRole("button", { name: "Save commission" }).click({ timeout: 10_000 });
  }, page.getByText("17.5%", { exact: true }).first());
  const [s2] = await query<{ status: string; commission_pct: string }>(`select status, commission_pct from restaurants where id = $1`, [spoon.id]);
  expect(s2).toEqual({ status: "approved", commission_pct: "17.50" });
  const actions = await query<{ action: string }>(`select action from admin_audit_log where entity_id = $1 and created_at > $2 order by id`, [spoon.id, since]);
  expect(actions.map((a) => a.action)).toEqual(["restaurant.suspend", "restaurant.unsuspend", "restaurant.commission"]);
});

test("admin approves the pending rider applicant", async ({ page }) => {
  await loginAs(page, "admin");
  await page.goto("/admin/riders?status=pending");
  await visibleRow(page, "admin-rider-row", "Vikram Pawar").getByText("Vikram Pawar").click();
  await expect(page.getByRole("heading", { name: "Vikram Pawar" })).toBeVisible();
  await expect(page.getByTestId("rider-status")).toHaveText("Applicant");
  await expect(page.getByText("ICIC0002211")).toBeVisible();
  await expect(page.getByText("Trips delivered")).toBeVisible();

  await untilDone(async () => {
    await page.getByRole("button", { name: "Approve" }).click({ timeout: 10_000 });
    await page.getByRole("alertdialog").getByRole("button", { name: "Approve rider" }).click({ timeout: 10_000 });
  }, page.getByTestId("rider-status").filter({ hasText: "Approved" }));
  const [r] = await query<{ status: string }>(`select status from riders where id = $1`, [riderId]);
  expect(r!.status).toBe("approved");
  const notes = await query(`select 1 from notifications where user_id = $1 and title = 'You''re approved to deliver' and created_at > $2`, [riderId, since]);
  expect(notes.length).toBe(1);
});

test("admin sees an active rider's live location", async ({ page }) => {
  const [r] = await query<{ id: string; current_lat: number | null; current_lng: number | null; last_seen_at: Date | null }>(
    `select r.id, r.current_lat, r.current_lng, r.last_seen_at from riders r join profiles p on p.id = r.id where p.email = 'rider@demo.in'`,
  );
  await query(`update riders set current_lat = 18.5362, current_lng = 73.8930, last_seen_at = now() where id = $1`, [r!.id]);
  await loginAs(page, "admin");
  await page.goto(`/admin/riders/${r!.id}`);
  try {
    await expect(page.getByTestId("rider-live-map")).toContainText("18.5362, 73.8930");
  } finally {
    await query(`update riders set current_lat = $2, current_lng = $3, last_seen_at = $4 where id = $1`, [r!.id, r!.current_lat, r!.current_lng, r!.last_seen_at]);
  }
});

test("blocked user is sent to /blocked, then unblocked", async ({ page, browser }) => {
  // The user signs in first, in their own browser.
  const ctx = await newUserContext(browser);
  const user = await ctx.newPage();
  await user.goto("/login");
  await user.getByRole("tab", { name: /email/i }).click();
  await user.getByRole("button", { name: /sign in with a password/i }).click();
  await user.getByRole("textbox", { name: "Email" }).fill(BLOCK_EMAIL);
  await user.getByLabel("Password").fill("Demo@1234");
  await user.getByRole("button", { name: /^sign in$/i }).click();
  await expect(user).toHaveURL(/\/$/);

  await loginAs(page, "admin");
  await page.goto("/admin/users?role=customer&q=customer2%40demo.in");
  await visibleRow(page, "admin-user-row", "Rahul Deshpande").getByText("Rahul Deshpande").click();
  await expect(page.getByRole("heading", { name: "Rahul Deshpande" })).toBeVisible();
  await untilDone(async () => {
    await page.getByRole("button", { name: "Block" }).click({ timeout: 10_000 });
    await page.getByRole("dialog").getByLabel("Reason").fill("Repeated fake COD orders", { timeout: 10_000 });
    await page.getByRole("dialog").getByRole("button", { name: "Block user" }).click({ timeout: 10_000 });
  }, page.getByTestId("user-blocked"));
  await expect(page.getByText("Block reason:")).toBeVisible();

  await user.goto("/account");
  await expect(user).toHaveURL(/\/blocked/, { timeout: 60_000 }); // may be a client-side redirect after streaming starts
  await expect(user.getByRole("heading", { name: "Your account is blocked" })).toBeVisible();

  await untilDone(async () => {
    await page.getByRole("button", { name: "Unblock" }).click({ timeout: 10_000 });
    await page.getByRole("alertdialog").getByRole("button", { name: "Unblock user" }).click({ timeout: 10_000 });
  }, page.getByRole("button", { name: "Block", exact: true }));
  await user.goto("/account");
  await expect(user).toHaveURL(/\/account/);
  await expect(user.getByRole("heading", { name: "Rahul Deshpande" })).toBeVisible();
  await ctx.close();

  const audit = await query<{ action: string; details: { reason?: string } }>(
    `select action, details from admin_audit_log a join profiles p on p.id::text = a.entity_id where p.email = $1 and a.created_at > $2 order by a.id`,
    [BLOCK_EMAIL, since],
  );
  expect(audit.map((a) => a.action)).toEqual(["user.block", "user.unblock"]);
  expect(audit[0]!.details.reason).toBe("Repeated fake COD orders");
});

test("admin credits ₹100 to a customer's wallet", async ({ page }) => {
  const [before] = await query<{ id: string; balance: string }>(
    `select p.id, coalesce(w.balance_paise, 0)::text balance from profiles p left join wallets w on w.user_id = p.id where p.email = $1`,
    [CREDIT_EMAIL],
  );
  await loginAs(page, "admin");
  await page.goto("/admin/users?q=Ananya");
  await visibleRow(page, "admin-user-row", "Ananya Iyer").getByText("Ananya Iyer").click();
  await expect(page.getByRole("heading", { name: "Ananya Iyer" })).toBeVisible();

  await untilDone(async () => {
    await page.getByRole("button", { name: "Add credits" }).click({ timeout: 10_000 });
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Amount (₹)").fill("100", { timeout: 10_000 });
    await dialog.getByLabel("Note").fill(CREDIT_NOTE, { timeout: 10_000 });
    await dialog.getByRole("button", { name: "Credit wallet" }).click({ timeout: 10_000 });
  }, page.getByTestId("wallet-txn").filter({ hasText: CREDIT_NOTE }).first());

  const expected = Number(before!.balance) + 10000;
  await expect(page.getByTestId("wallet-balance")).toHaveText(new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(expected / 100));
  await expect(page.getByTestId("wallet-txn").first()).toContainText(CREDIT_NOTE);

  const [w] = await query<{ balance_paise: string }>(`select balance_paise from wallets where user_id = $1`, [before!.id]);
  expect(Number(w!.balance_paise)).toBe(expected);
  const txns = await query<{ amount_paise: string; balance_after_paise: string }>(
    `select amount_paise, balance_after_paise from wallet_transactions where user_id = $1 and type = 'admin_credit' and description = $2`,
    [before!.id, CREDIT_NOTE],
  );
  expect(txns).toEqual([{ amount_paise: "10000", balance_after_paise: String(expected) }]);
  const audit = await query<{ details: { amount_paise: number } }>(`select details from admin_audit_log where action = 'wallet.credit' and entity_id = $1 and created_at > $2`, [before!.id, since]);
  expect(audit.map((a) => a.details.amount_paise)).toEqual([10000]);
  const notes = await query(`select 1 from notifications where user_id = $1 and title = '₹100 added to your Thaali Money' and created_at > $2`, [before!.id, since]);
  expect(notes.length).toBe(1);
});
