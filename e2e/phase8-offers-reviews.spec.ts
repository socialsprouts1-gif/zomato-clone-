import { expect, test, type Page } from "@playwright/test";
import { query } from "./db";
import { BASE, fillCart, loginAs } from "./helpers";

test.describe.configure({ mode: "serial", timeout: 180_000 });

const CODE = "E2EFLAT40";
const BOGO = "E2EBOGO";
const CAMPAIGN = "E2E Lunch boost";
const REVIEW_TEXT = "E2E reply target: biryani arrived cold";

async function restaurantId() {
  return (await query<{ id: string }>(`select id from restaurants where slug = 'saffron-courtyard'`))[0]!.id;
}

/** Signs in as Rohan with Saffron Courtyard selected in the outlet switcher. */
async function loginOwner(page: Page) {
  await page.context().addCookies([{ name: "thaali_outlet", value: await restaurantId(), domain: new URL(BASE).hostname, path: "/" }]);
  await loginAs(page, "owner-1");
}

async function openTab(page: Page, name: "Offers" | "Ads") {
  await page.getByRole("tab", { name }).click();
  await expect(page.getByRole("tab", { name })).toHaveAttribute("data-state", "active");
}

let savedHours: unknown = null;

test.beforeAll(async () => {
  const rid = await restaurantId();
  // Checkout needs the outlet open whatever the wall-clock time; the real hours are restored afterwards.
  savedHours = (await query<{ h: unknown }>(`select opening_hours h from restaurants where id = $1`, [rid]))[0]!.h;
  const allDay = Object.fromEntries(["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map((d) => [d, [["00:00", "23:59"]]]));
  await query(`update restaurants set is_online = true, busy_until = null, opening_hours = $2 where id = $1`, [rid, JSON.stringify(allDay)]);
  await query(`delete from restaurant_offers where restaurant_id = $1 and code in ($2, $3)`, [rid, CODE, BOGO]);
  await query(`delete from ad_campaigns where restaurant_id = $1 and name = $2`, [rid, CAMPAIGN]);
  // A dedicated low-rated review (no photos, no reply) for the reply flow.
  await query(`delete from reviews where restaurant_id = $1 and comment = $2`, [rid, REVIEW_TEXT]);
  await query(
    `insert into reviews (restaurant_id, customer_id, customer_name, food_rating, food_tags, comment, created_at)
     select $1, p.id, coalesce(p.name, 'Priya Sharma'), 2, '{Cold food}', $2, now() from profiles p where p.email = 'customer@demo.in'`,
    [rid, REVIEW_TEXT],
  );
});

test.afterAll(async () => {
  if (savedHours) await query(`update restaurants set opening_hours = $2 where id = $1`, [await restaurantId(), JSON.stringify(savedHours)]);
});

test("owner creates a flat offer; it applies at checkout and shows up in the offer's stats", async ({ browser }) => {
  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await loginOwner(owner);
  await owner.goto("/partner/offers");
  await expect(owner.getByRole("heading", { name: "Offers & ads" })).toBeVisible();
  await expect(owner.getByText("Saffron Courtyard ·")).toBeVisible();

  await owner.getByRole("button", { name: "Create offer" }).click();
  const dialog = owner.getByRole("dialog", { name: "New offer" });
  // Validation: lowercase is upper-cased, but symbols are rejected.
  await dialog.getByLabel("Title").fill("Flat ₹40 off");
  await dialog.getByLabel("Coupon code").fill("e2e-flat");
  await dialog.getByLabel("Discount type").selectOption("flat");
  await dialog.getByLabel("Discount amount (₹)").fill("40");
  await dialog.getByRole("button", { name: "Create offer" }).click();
  await expect(dialog.getByText("3–20 letters or digits, no spaces")).toBeVisible();
  await dialog.getByLabel("Coupon code").fill(CODE.toLowerCase());
  await dialog.getByLabel("Minimum order (₹)").fill("199");
  await dialog.getByLabel("Description (optional)").fill("On all orders above ₹199");
  await dialog.getByRole("button", { name: "Create offer" }).click();
  await expect(owner.getByText(`${CODE} is live`)).toBeVisible();

  const card = owner.locator(`[data-testid=partner-offer][data-code="${CODE}"]`);
  await expect(card).toBeVisible();
  await expect(card.getByText("Active", { exact: true })).toBeVisible();
  await expect(card.getByText("₹40 off · on orders above ₹199")).toBeVisible();
  await expect(card.getByTestId("offer-orders")).toHaveText("0");
  const row = (await query<{ discount_type: string; discount_value: number; min_order_paise: number; is_active: boolean }>(
    `select discount_type, discount_value, min_order_paise, is_active from restaurant_offers where code = $1`,
    [CODE],
  ))[0]!;
  expect(row).toEqual({ discount_type: "flat", discount_value: 4000, min_order_paise: 19900, is_active: true });

  // Edit the title.
  await card.getByRole("button", { name: `Actions for ${CODE}` }).click();
  await owner.getByRole("menuitem", { name: "Edit" }).click();
  const edit = owner.getByRole("dialog", { name: "Edit offer" });
  await expect(edit.getByLabel("Coupon code")).toHaveValue(CODE);
  await expect(edit.getByLabel("Discount amount (₹)")).toHaveValue("40");
  await edit.getByLabel("Title").fill("Flat ₹40 off on everything");
  await edit.getByRole("button", { name: "Save changes" }).click();
  await expect(card.getByText("Flat ₹40 off on everything")).toBeVisible();

  // Deactivate → paused; activate again.
  await card.getByRole("button", { name: `Actions for ${CODE}` }).click();
  await owner.getByRole("menuitem", { name: "Deactivate" }).click();
  await expect(card.getByText("Paused", { exact: true })).toBeVisible();
  await card.getByRole("button", { name: `Actions for ${CODE}` }).click();
  await owner.getByRole("menuitem", { name: "Activate" }).click();
  await expect(card.getByText("Active", { exact: true })).toBeVisible();

  await ownerCtx.close();

  // Customer: offer is listed at checkout and applies.
  const customerCtx = await browser.newContext();
  const customer = await customerCtx.newPage();
  await loginAs(customer, "customer");
  await fillCart(customer);
  await customer.getByRole("button", { name: /apply coupon/i }).click();
  const sheet = customer.getByRole("dialog");
  await expect(sheet.getByText(CODE, { exact: true })).toBeVisible();
  await sheet.getByLabel("Coupon code").fill(CODE);
  await sheet.getByRole("button", { name: "Apply", exact: true }).first().click();
  await expect(customer.getByText(`‘${CODE}’ applied`)).toBeVisible();
  await expect(customer.getByText(`You save ₹40 with ${CODE}`)).toBeVisible();
  await customer.getByRole("radio", { name: /cash on delivery/i }).click();
  await customer.getByTestId("place-order").click();
  await expect(customer).toHaveURL(/\/orders\/[0-9a-f-]{36}/, { timeout: 60000 });
  const orderId = customer.url().split("/orders/")[1]!.split("?")[0]!;
  const order = (await query<{ coupon_code: string; discount_paise: number; restaurant_offer_id: string | null }>(
    `select coupon_code, discount_paise, restaurant_offer_id from orders where id = $1`,
    [orderId],
  ))[0]!;
  expect(order.coupon_code).toBe(CODE);
  expect(order.discount_paise).toBeGreaterThanOrEqual(4000);
  expect(order.restaurant_offer_id).not.toBeNull();

  await customerCtx.close();

  // Owner: stats count the order.
  const ownerCtx2 = await browser.newContext();
  const owner2 = await ownerCtx2.newPage();
  await loginOwner(owner2);
  await owner2.goto("/partner/offers");
  const card2 = owner2.locator(`[data-testid=partner-offer][data-code="${CODE}"]`);
  await expect(card2.getByTestId("offer-orders")).toHaveText("1");
  await expect(card2.getByTestId("offer-discount")).toHaveText(`₹${order.discount_paise / 100}`);
  await ownerCtx2.close();
});

test("owner creates an ad campaign, sees metrics and pauses it", async ({ page }) => {
  await loginOwner(page);
  await page.goto("/partner/offers?tab=ads");
  await expect(page.getByRole("tab", { name: "Ads" })).toHaveAttribute("data-state", "active");
  await openTab(page, "Offers");
  await openTab(page, "Ads");
  await expect(page).toHaveURL(/tab=ads/);

  await page.getByRole("button", { name: "New campaign" }).click();
  const dialog = page.getByRole("dialog", { name: "New ad campaign" });
  await dialog.getByLabel("Campaign name").fill(CAMPAIGN);
  await dialog.getByLabel("Daily budget (₹)").fill("50");
  await dialog.getByRole("button", { name: "Launch campaign" }).click();
  await expect(dialog.getByText("Daily budget must be ₹100–₹50,000")).toBeVisible();
  await dialog.getByLabel("Daily budget (₹)").fill("300");
  await dialog.getByRole("button", { name: "Launch campaign" }).click();
  await expect(page.getByText(`${CAMPAIGN} is running`)).toBeVisible();

  const card = page.locator(`[data-testid=ad-campaign][data-name="${CAMPAIGN}"]`);
  await expect(card).toHaveAttribute("data-status", "active");
  await expect(card.getByText("₹300/day")).toBeVisible();
  for (const m of ["impressions", "clicks", "ctr", "orders", "spend", "cost-per-order"]) await expect(page.getByTestId(`ad-metric-${m}`)).toBeVisible();
  await expect(page.getByTestId("sponsored-status")).toContainText("Promoted");
  const rid = await restaurantId();
  const [r] = await query<{ sponsored: boolean }>(`select sponsored_until > now() as sponsored from restaurants where id = $1`, [rid]);
  expect(r!.sponsored).toBe(true);

  await card.getByRole("button", { name: `Pause ${CAMPAIGN}` }).click();
  await expect(page.getByText(`${CAMPAIGN} paused`)).toBeVisible();
  await expect(card).toHaveAttribute("data-status", "paused");
  await expect(card.getByRole("button", { name: `Resume ${CAMPAIGN}` })).toBeVisible();
  const [c] = await query<{ status: string; daily_budget_paise: number }>(`select status, daily_budget_paise from ad_campaigns where restaurant_id = $1 and name = $2`, [rid, CAMPAIGN]);
  expect(c).toEqual({ status: "paused", daily_budget_paise: 30000 });

  await card.getByRole("button", { name: `Resume ${CAMPAIGN}` }).click();
  await expect(card).toHaveAttribute("data-status", "active");
  await card.getByRole("button", { name: `End ${CAMPAIGN}` }).click();
  await expect(card).toHaveAttribute("data-status", "ended");
  await expect(card.getByRole("button", { name: `Resume ${CAMPAIGN}` })).toBeHidden();
});

test("owner creates a buy-one-get-one offer from the menu, rejects bad input, then deletes it", async ({ page }) => {
  await loginOwner(page);
  await page.goto("/partner/offers");
  await page.getByRole("button", { name: "Create offer" }).click();
  const dialog = page.getByRole("dialog", { name: "New offer" });
  await dialog.getByLabel("Title").fill("Kebab BOGO");
  await dialog.getByLabel("Coupon code").fill(BOGO);
  await dialog.getByLabel("Discount (%)").fill("101");
  await dialog.getByRole("button", { name: "Create offer" }).click();
  await expect(dialog.getByText("Enter a whole percentage from 1 to 100")).toBeVisible();
  await dialog.getByLabel("Discount type").selectOption("bogo");
  await dialog.getByRole("button", { name: "Create offer" }).click();
  await expect(dialog.getByText("Pick the dish for buy-one-get-one")).toBeVisible();
  const [kebab] = await query<{ id: string }>(`select id from menu_items where restaurant_id = $1 and name = 'Hara Bhara Kebab' and not is_deleted`, [await restaurantId()]);
  await dialog.getByLabel("Buy-one-get-one dish").selectOption(kebab!.id);
  await dialog.getByRole("button", { name: "Create offer" }).click();
  const card = page.locator(`[data-testid=partner-offer][data-code="${BOGO}"]`);
  await expect(card.getByText("Buy 1 get 1 on Hara Bhara Kebab")).toBeVisible();

  await card.getByRole("button", { name: `Actions for ${BOGO}` }).click();
  await page.getByRole("menuitem", { name: "Delete" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete offer" }).click();
  await expect(page.getByText(`${BOGO} deleted`)).toBeVisible();
  await expect(card).toBeHidden();
  expect(await query(`select 1 from restaurant_offers where code = $1`, [BOGO])).toHaveLength(0);
});

test("owner replies to a review; the customer is notified and sees it on the restaurant page", async ({ browser }) => {
  const rid = await restaurantId();
  const [review] = await query<{ id: string }>(`select id from reviews where restaurant_id = $1 and comment = $2`, [rid, REVIEW_TEXT]);
  const reply = `Sorry about that! We've fixed our packing. ${Date.now()}`;

  const ownerCtx = await browser.newContext();
  const owner = await ownerCtx.newPage();
  await loginOwner(owner);
  await owner.goto("/partner/reviews");
  await expect(owner.getByRole("heading", { name: "Reviews" })).toBeVisible();
  await expect(owner.getByTestId("reviews-average")).toHaveText(/\d\.\d/);
  await expect(owner.getByTestId("partner-review-summary")).not.toBeEmpty();
  await expect(owner.getByTestId("summary-label")).toHaveText(/^(AI summary|Summary)$/);

  const card = owner.locator(`[data-testid=partner-review][data-review-id="${review!.id}"]`);
  const filters = owner.getByRole("group", { name: "Filter reviews" });
  await filters.getByRole("button", { name: /^1–2★/ }).click();
  await expect(card).toBeVisible();
  await filters.getByRole("button", { name: /^With photos/ }).click();
  await expect(card).toBeHidden();
  await filters.getByRole("button", { name: /^Needs reply/ }).click();
  await expect(card).toBeVisible();
  await expect(card.getByText("Cold food")).toBeVisible();

  await card.getByRole("button", { name: /^Reply to/ }).click();
  await card.getByRole("textbox").fill(reply);
  await card.getByRole("button", { name: "Post reply" }).click();
  await expect(owner.getByText("Reply posted. The customer has been notified.")).toBeVisible();
  // It no longer needs a reply.
  await expect(card).toBeHidden();
  await filters.getByRole("button", { name: /^All/ }).click();
  await expect(card.getByTestId("review-reply")).toContainText(reply);

  const rows = await query<{ body: string; author: string }>(
    `select rr.body, p.email as author from review_replies rr join profiles p on p.id = rr.author_id where rr.review_id = $1`,
    [review!.id],
  );
  expect(rows).toEqual([{ body: reply, author: "owner@demo.in" }]);
  const notes = await query<{ title: string }>(
    `select n.title from notifications n join profiles p on p.id = n.user_id where p.email = 'customer@demo.in' and n.body = $1`,
    [reply.slice(0, 120)],
  );
  expect(notes[0]?.title).toBe("Saffron Courtyard replied to your review");

  // Edit the reply.
  const edited = `${reply} (edited)`;
  await card.getByRole("button", { name: /^Edit reply/ }).click();
  await card.getByRole("textbox").fill(edited);
  await card.getByRole("button", { name: "Save reply" }).click();
  await expect(card.getByTestId("review-reply")).toContainText("(edited)");
  await ownerCtx.close();

  const customerCtx = await browser.newContext();
  const customer = await customerCtx.newPage();
  await loginAs(customer, "customer");
  await customer.goto("/restaurant/saffron-courtyard");
  await customer.getByRole("tab", { name: /reviews/i }).click();
  await expect(customer.getByText(edited)).toBeVisible();
  await customerCtx.close();
});
