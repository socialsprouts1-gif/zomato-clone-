import { expect as baseExpect, test, type Browser, type Page } from "@playwright/test";
import { query } from "./db";
import { fillCart, loginAs } from "./helpers";

test.describe.configure({ mode: "serial", timeout: 180_000 });
// Dev servers compile each admin page on first visit, which can take a few seconds.
const expect = baseExpect.configure({ timeout: 15_000 });

const CODE = "E2EADMIN25";
const BANNER = "E2E admin banner";
const COLLECTION = "E2E admin picks";
const SLUG = "e2e-admin-picks";
const PLAN = "Gold · 3 months";
/**
 * Navigates and waits for the page to settle. In the offline sandbox a remote image can keep the
 * "load" event from ever firing, so the wait for it is capped.
 */
async function go(page: Page, url: string) {
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForLoadState("load", { timeout: 15_000 }).catch(() => undefined);
}

type Settings = { surge_rain: boolean; surge_late_night: boolean; surge_fee_paise: number };
let savedSettings: Settings | null = null;
let savedPlanPrice: number | null = null;
let savedHours: unknown = null;

async function saffronId() {
  return (await query<{ id: string }>(`select id from restaurants where slug = 'saffron-courtyard'`))[0]!.id;
}

async function cleanup() {
  await query(`delete from coupons where code = $1`, [CODE]);
  await query(`delete from banners where title = $1`, [BANNER]);
  await query(`delete from collections where slug = $1`, [SLUG]);
}

test.beforeAll(async () => {
  await cleanup();
  savedSettings = (await query<Settings>(`select surge_rain, surge_late_night, surge_fee_paise from platform_settings`))[0]!;
  savedPlanPrice = (await query<{ price_paise: number }>(`select price_paise from gold_plans where name = $1`, [PLAN]))[0]?.price_paise ?? null;
  // Surge off to start with so the customer bill has no surge line.
  await query(`update platform_settings set surge_rain = false, surge_late_night = false`);
  // Checkout needs the outlet open whatever the wall-clock time; the real hours are restored afterwards.
  const rid = await saffronId();
  savedHours = (await query<{ h: unknown }>(`select opening_hours h from restaurants where id = $1`, [rid]))[0]!.h;
  const allDay = Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, [["00:00", "23:59"]]]));
  await query(`update restaurants set is_online = true, busy_until = null, opening_hours = $2 where id = $1`, [rid, JSON.stringify(allDay)]);
});

test.afterAll(async () => {
  await cleanup();
  if (savedSettings)
    await query(`update platform_settings set surge_rain = $1, surge_late_night = $2, surge_fee_paise = $3`, [savedSettings.surge_rain, savedSettings.surge_late_night, savedSettings.surge_fee_paise]);
  if (savedPlanPrice !== null) await query(`update gold_plans set price_paise = $2 where name = $1`, [PLAN, savedPlanPrice]);
  if (savedHours) await query(`update restaurants set opening_hours = $2 where id = $1`, [await saffronId(), JSON.stringify(savedHours)]);
});

async function asAdmin(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAs(page, "admin");
  return { ctx, page };
}
async function asCustomer(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAs(page, "customer");
  return { ctx, page };
}

/** fillCart, tolerating a slow client-side hop to /cart on a busy dev server (the cart is kept in localStorage). */
async function openCart(page: Page) {
  try {
    await fillCart(page);
  } catch (e) {
    if (!(await page.getByTestId("cart-bar").isVisible())) throw e;
    await go(page, "/cart");
  }
  await expect(page).toHaveURL(/\/cart/);
}

/** Flips a switch, retrying until the page has hydrated and the switch reflects the click. */
async function setSwitch(page: Page, name: string, on: boolean) {
  const sw = page.getByRole("switch", { name });
  await expect(async () => {
    if ((await sw.getAttribute("aria-checked")) !== String(on)) await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", String(on), { timeout: 1000 });
  }).toPass({ timeout: 20_000 });
}

/** The coupon's row (table on desktop, card on phones) — whichever is visible. */
const couponRow = (page: Page, code: string) => page.locator(`[data-testid="admin-coupon"][data-code="${code}"]`).filter({ visible: true });

test("admin creates a coupon; it applies at checkout; deactivated it stops working; unused it can be deleted", async ({ browser }) => {
  const { ctx: adminCtx, page: admin } = await asAdmin(browser);
  await go(admin, "/admin/coupons");
  await expect(admin.getByRole("heading", { name: "Coupons", exact: true })).toBeVisible();
  // Seeded coupons are listed with usage.
  await expect(couponRow(admin, "WELCOME50")).toBeVisible();

  await admin.getByRole("button", { name: "New coupon" }).click();
  const dialog = admin.getByRole("dialog", { name: "New coupon" });
  await dialog.getByLabel("Code").fill("e2e-admin");
  await dialog.getByLabel("Title", { exact: true }).fill("25% off up to ₹60");
  await dialog.getByRole("button", { name: "Create coupon" }).click();
  await expect(dialog.getByText("Code must be 3–20 letters or digits, no spaces")).toBeVisible();
  await dialog.getByLabel("Code").fill(CODE.toLowerCase());
  await dialog.getByLabel("Discount type").selectOption("percent");
  await dialog.getByLabel("Discount (%)").fill("25");
  await dialog.getByLabel("Maximum discount (₹)").fill("60");
  await dialog.getByLabel("Minimum order (₹)").fill("199");
  await dialog.getByLabel("Uses per customer").fill("3");
  await dialog.getByRole("button", { name: "Create coupon" }).click();
  await expect(dialog).toBeHidden();
  const row = couponRow(admin, CODE);
  await expect(row).toBeVisible();
  await expect(row).toContainText("25% off up to ₹60 · min ₹199");

  const db = (await query<{ discount_type: string; discount_value: number; max_discount_paise: number; min_order_paise: number; per_user_limit: number; is_active: boolean }>(
    `select discount_type, discount_value, max_discount_paise, min_order_paise, per_user_limit, is_active from coupons where code = $1`,
    [CODE],
  ))[0]!;
  expect(db).toEqual({ discount_type: "percent", discount_value: 25, max_discount_paise: 6000, min_order_paise: 19900, per_user_limit: 3, is_active: true });

  // Search finds it; the detail page shows its rules.
  await admin.getByRole("searchbox", { name: "Search coupons" }).fill("e2eadmin");
  await admin.getByRole("searchbox", { name: "Search coupons" }).press("Enter");
  await expect(admin).toHaveURL(/q=e2eadmin/);
  await expect(couponRow(admin, CODE)).toBeVisible();
  await expect(couponRow(admin, "WELCOME50")).toHaveCount(0);
  const detail = await couponRow(admin, CODE).getByRole("link", { name: CODE }).getAttribute("href");
  expect(detail).toMatch(/^\/admin\/coupons\/[0-9a-f-]{36}$/);
  await go(admin, detail!);
  await expect(admin.getByRole("heading", { name: CODE })).toBeVisible();
  await expect(admin.getByText("Not used yet")).toBeVisible();
  // Only one heavy page open at a time keeps the browser's memory down.
  await admin.goto("about:blank");

  // Customer applies it: 25% of a ~₹1,000 cart is capped at ₹60.
  const { ctx: customerCtx, page: customer } = await asCustomer(browser);
  await openCart(customer);
  await customer.getByRole("button", { name: /apply coupon/i }).click();
  const sheet = customer.getByRole("dialog");
  await expect(sheet.getByText(CODE, { exact: true })).toBeVisible();
  await sheet.getByLabel("Coupon code").fill(CODE);
  await sheet.getByRole("button", { name: "Apply", exact: true }).first().click();
  await expect(customer.getByText(`‘${CODE}’ applied`)).toBeVisible();
  await expect(customer.getByText(`You save ₹60 with ${CODE}`)).toBeVisible();

  // Admin deactivates it.
  await customer.goto("about:blank");
  await go(admin, "/admin/coupons");
  await couponRow(admin, CODE).getByRole("button", { name: `Actions for ${CODE}` }).click();
  await admin.getByRole("menuitem", { name: "Deactivate" }).click();
  await expect(couponRow(admin, CODE).getByText("Inactive", { exact: true })).toBeVisible();
  expect((await query<{ is_active: boolean }>(`select is_active from coupons where code = $1`, [CODE]))[0]!.is_active).toBe(false);

  // The customer's cart no longer gets the discount, and the code isn't offered.
  await admin.goto("about:blank");
  await go(customer, "/cart");
  await expect(customer.getByRole("button", { name: /apply coupon/i })).toBeVisible();
  await expect(customer.getByText(`You save ₹60 with ${CODE}`)).toHaveCount(0);
  await customer.getByRole("button", { name: /apply coupon/i }).click();
  await expect(customer.getByRole("dialog").getByText("WELCOME50", { exact: true })).toBeVisible();
  await expect(customer.getByRole("dialog").getByText(CODE, { exact: true })).toHaveCount(0);
  await customerCtx.close();
  await go(admin, "/admin/coupons");

  // Never used, so delete removes it (and writes the audit log).
  await couponRow(admin, CODE).getByRole("button", { name: `Actions for ${CODE}` }).click();
  await admin.getByRole("menuitem", { name: "Delete" }).click();
  const confirm = admin.getByRole("alertdialog");
  await expect(confirm).toContainText(`Delete ${CODE}?`);
  await confirm.getByRole("button", { name: "Delete" }).click();
  await expect(admin.getByText(`${CODE} deleted`)).toBeVisible();
  await expect(couponRow(admin, CODE)).toHaveCount(0);
  const audit = await query<{ action: string }>(`select action from admin_audit_log where details->>'code' = $1 order by created_at`, [CODE]);
  expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(["coupon.create", "coupon.deactivate", "coupon.delete"]));
  await adminCtx.close();
});

test("a used coupon is deactivated instead of deleted", async ({ browser }) => {
  const used = (await query<{ code: string; is_active: boolean }>(`select code, is_active from coupons where code = 'WELCOME50'`))[0]!;
  const { ctx, page: admin } = await asAdmin(browser);
  await go(admin, "/admin/coupons?q=WELCOME50");
  await couponRow(admin, "WELCOME50").getByRole("button", { name: "Actions for WELCOME50" }).click();
  await admin.getByRole("menuitem", { name: "Delete" }).click();
  await expect(admin.getByRole("alertdialog")).toContainText("Deactivate WELCOME50?");
  // Cancel: the seeded coupon stays as it was.
  await admin.getByRole("alertdialog").getByRole("button", { name: "Cancel" }).click();
  expect((await query<{ is_active: boolean }>(`select is_active from coupons where code = 'WELCOME50'`))[0]!.is_active).toBe(used.is_active);
  await ctx.close();
});

test("admin adds a home banner; customers see it in the carousel; deleting removes it", async ({ browser }) => {
  const { ctx: adminCtx, page: admin } = await asAdmin(browser);
  await go(admin, "/admin/content");
  await expect(admin.getByRole("heading", { name: "Banners & collections" })).toBeVisible();
  await admin.getByRole("button", { name: "New banner" }).click();
  const dialog = admin.getByRole("dialog", { name: "New banner" });
  await dialog.getByLabel("Title", { exact: true }).fill(BANNER);
  await dialog.getByLabel("Subtitle (optional)").fill("Kebabs worth crossing town for");
  await dialog.getByLabel("Opens").selectOption("restaurant");
  await dialog.getByLabel("Restaurant", { exact: true }).selectOption({ label: "Saffron Courtyard" });
  await dialog.getByLabel("Colour theme").selectOption("night");
  await dialog.getByLabel("Position (optional)").fill("0");
  // Upload an image to the platform-media bucket.
  await dialog.getByTestId("banner-image-file").setInputFiles({
    name: "banner.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"),
  });
  await expect(dialog.getByLabel("Banner image", { exact: true })).toHaveValue(/platform-media\/banners\/.+\.png$/);
  await dialog.getByRole("button", { name: "Add banner" }).click();
  await expect(dialog).toBeHidden();
  const card = admin.locator(`[data-testid="admin-banner"][data-title="${BANNER}"]`);
  await expect(card).toBeVisible();
  await expect(card).toContainText("Opens Restaurant · Saffron Courtyard");
  const row = (await query<{ link_url: string; image_url: string; theme: string }>(`select link_url, image_url, theme from banners where title = $1`, [BANNER]))[0]!;
  expect(row.link_url).toBe("/restaurant/saffron-courtyard");
  expect(row.theme).toBe("night");
  const img = await fetch(row.image_url);
  expect(img.status).toBe(200);
  await admin.goto("about:blank");

  const { ctx: customerCtx, page: customer } = await asCustomer(browser);
  await go(customer, "/");
  const carousel = customer.getByRole("region", { name: "Offers" });
  await carousel.getByRole("button", { name: new RegExp(`: ${BANNER}$`) }).click();
  await expect(carousel.getByRole("heading", { name: BANNER })).toBeVisible();
  await expect(carousel.getByRole("link", { name: new RegExp(BANNER) })).toHaveAttribute("href", "/restaurant/saffron-courtyard");

  await customer.goto("about:blank");
  await go(admin, "/admin/content");
  await card.getByRole("button", { name: `Actions for banner ${BANNER}` }).click();
  await admin.getByRole("menuitem", { name: "Delete" }).click();
  await admin.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(admin.getByText("Banner deleted")).toBeVisible();
  await expect(card).toHaveCount(0);

  await admin.goto("about:blank");
  await go(customer, "/");
  await expect(customer.getByRole("region", { name: "Offers" }).getByRole("button", { name: new RegExp(`: ${BANNER}$`) })).toHaveCount(0);
  await customerCtx.close();
  await adminCtx.close();
});

test("admin curates a collection of two restaurants; /collections/<slug> shows them; deleting removes it", async ({ browser }) => {
  const { ctx: adminCtx, page: admin } = await asAdmin(browser);
  await go(admin, "/admin/content?tab=collections");
  await admin.getByRole("button", { name: "New collection" }).click();
  const dialog = admin.getByRole("dialog", { name: "New collection" });
  await dialog.getByLabel("Title", { exact: true }).fill(COLLECTION);
  await expect(dialog.getByLabel("Slug")).toHaveValue(SLUG);
  await dialog.getByLabel("Description (optional)").fill("Two places our team keeps going back to");
  await dialog.getByRole("button", { name: "Create collection" }).click();
  await expect(admin).toHaveURL(/\/admin\/content\/collections\/[0-9a-f-]{36}/);
  await expect(admin.getByRole("heading", { name: COLLECTION })).toBeVisible();

  const search = admin.getByRole("searchbox", { name: "Search restaurants to add" });
  await search.fill("Saffron");
  await admin.getByRole("button", { name: "Add Saffron Courtyard" }).click();
  await search.fill("Napoli");
  await admin.getByRole("button", { name: "Add Napoli Fire Oven" }).click();
  const members = admin.getByTestId("collection-member");
  await expect(members).toHaveCount(2);
  // Reorder: Napoli first.
  await admin.getByRole("button", { name: "Move Napoli Fire Oven up" }).click();
  await expect(members.first()).toContainText("Napoli Fire Oven");
  await admin.getByRole("button", { name: "Save restaurants" }).click();
  await expect(admin.getByText("Restaurants saved")).toBeVisible();
  const items = await query<{ slug: string; sort: number }>(
    `select r.slug, ci.sort from collection_items ci join collections c on c.id = ci.collection_id join restaurants r on r.id = ci.restaurant_id where c.slug = $1 order by ci.sort`,
    [SLUG],
  );
  expect(items).toEqual([
    { slug: "napoli-fire-oven", sort: 0 },
    { slug: "saffron-courtyard", sort: 1 },
  ]);
  await admin.goto("about:blank");

  const { ctx: customerCtx, page: customer } = await asCustomer(browser);
  await go(customer, `/collections/${SLUG}`);
  await expect(customer.getByRole("heading", { name: COLLECTION })).toBeVisible();
  await expect(customer.getByText("2 places deliver to you")).toBeVisible();
  await expect(customer.getByRole("link", { name: /Saffron Courtyard/ }).first()).toBeVisible();
  await expect(customer.getByRole("link", { name: /Napoli Fire Oven/ }).first()).toBeVisible();

  await customer.goto("about:blank");
  await go(admin, "/admin/content?tab=collections");
  const card = admin.locator(`[data-testid="admin-collection"][data-slug="${SLUG}"]`);
  await expect(card).toContainText("2 restaurants");
  await card.getByRole("button", { name: `Actions for collection ${COLLECTION}` }).click();
  await admin.getByRole("menuitem", { name: "Delete" }).click();
  await admin.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(admin.getByText(`“${COLLECTION}” deleted`)).toBeVisible();
  await expect(card).toHaveCount(0);

  await admin.goto("about:blank");
  await go(customer, `/collections/${SLUG}`);
  await expect(customer.getByText("This page went cold")).toBeVisible();
  await expect(customer.getByRole("heading", { name: COLLECTION })).toHaveCount(0);
  await customerCtx.close();
  await adminCtx.close();
});

test("admin edits a Gold plan's price", async ({ browser }) => {
  test.skip(savedPlanPrice === null, "seeded Gold plan missing");
  const { ctx, page: admin } = await asAdmin(browser);
  await go(admin, "/admin/gold");
  await expect(admin.getByRole("heading", { name: "Gold", exact: true })).toBeVisible();
  const plan = admin.locator(`[data-testid="gold-plan"][data-name="${PLAN}"]`);
  await plan.getByRole("button", { name: `Actions for ${PLAN}` }).click();
  await admin.getByRole("menuitem", { name: "Edit pricing" }).click();
  const dialog = admin.getByRole("dialog", { name: `Edit ${PLAN}` });
  await dialog.getByLabel("Price (₹)", { exact: true }).fill("179");
  await dialog.getByRole("button", { name: "Save plan" }).click();
  await expect(dialog).toBeHidden();
  await expect(plan.getByTestId("gold-plan-price")).toHaveText("₹179");
  expect((await query<{ price_paise: number }>(`select price_paise from gold_plans where name = $1`, [PLAN]))[0]!.price_paise).toBe(17900);

  // Members list is searchable.
  await expect(admin.getByRole("heading", { name: "Members" })).toBeVisible();
  await admin.getByRole("searchbox", { name: "Search members" }).fill("customer2");
  await admin.getByRole("searchbox", { name: "Search members" }).press("Enter");
  await expect(admin).toHaveURL(/q=customer2/);
  await expect(admin.getByTestId("gold-member").filter({ visible: true })).toHaveCount(1);
  await expect(admin.getByTestId("gold-member").filter({ visible: true })).toContainText("customer2@demo.in");
  await ctx.close();
});

test("admin turns rain surge on; the customer bill shows the surge fee; turning it off removes it", async ({ browser }) => {
  const { ctx: adminCtx, page: admin } = await asAdmin(browser);
  await go(admin, "/admin/settings");
  await expect(admin.getByRole("heading", { name: "Zones & fees" })).toBeVisible();
  await expect(admin.locator('[data-testid="zone"]').first()).toBeVisible();
  await expect(admin.getByTestId("fee-slab").first()).toBeVisible();

  await setSwitch(admin, "Rain surge", true);
  await admin.getByLabel("Surge fee (₹)").fill("25");
  await admin.getByRole("button", { name: "Save surge" }).click();
  await expect(admin.getByText("Surge settings saved")).toBeVisible();
  await expect(admin.getByTestId("surge-state")).toHaveText("Surge live · +₹25");
  expect((await query<Settings>(`select surge_rain, surge_late_night, surge_fee_paise from platform_settings`))[0]!).toMatchObject({ surge_rain: true, surge_fee_paise: 2500 });

  await admin.goto("about:blank");
  const { ctx: customerCtx, page: customer } = await asCustomer(browser);
  await openCart(customer);
  await expect(customer.getByText("Includes a ₹25 surge fee (high demand).")).toBeVisible();

  await customer.goto("about:blank");
  await go(admin, "/admin/settings");
  await setSwitch(admin, "Rain surge", false);
  await admin.getByRole("button", { name: "Save surge" }).click();
  await expect(admin.getByText("Surge settings saved")).toBeVisible();
  await expect(admin.getByTestId("surge-state")).toHaveText("No surge right now");
  expect((await query<Settings>(`select surge_rain from platform_settings`))[0]!.surge_rain).toBe(false);

  await admin.goto("about:blank");
  await go(customer, "/cart");
  await expect(customer.getByText("Grand total")).toBeVisible();
  await expect(customer.getByText(/surge fee \(high demand\)/)).toHaveCount(0);
  await customerCtx.close();
  await adminCtx.close();
});
