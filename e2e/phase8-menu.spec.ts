import { expect as baseExpect, test, type Browser, type Page } from "@playwright/test";
import { query } from "./db";
import { BASE, loginAs } from "./helpers";


// The dev server compiles pages on first hit and shares the machine with other suites.
const expect = baseExpect.configure({ timeout: 15_000 });
test.describe.configure({ mode: "serial" });

const CAT = "E2E Test Category";
const SUB = "E2E Specials";
const ITEM = "E2E Paneer Pizza Bowl";
// 1×1 transparent PNG.
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

let rid = "";

async function cleanup() {
  await query(`delete from menu_categories where restaurant_id = $1 and name in ($2, $3)`, [rid, CAT, SUB]);
  await query(`delete from notifications where title like $1`, [`%${ITEM}%`]);
}

async function lowStockNotices(qty: number) {
  const rows = await query<{ n: number }>(
    `select count(*)::int n from notifications n join profiles p on p.id = n.user_id where p.email = 'owner@demo.in' and n.title = $1`,
    [`Low stock: ${ITEM} (${qty} left)`],
  );
  return rows[0]!.n;
}

async function partnerPage(browser: Browser) {
  const ctx = await browser.newContext();
  await ctx.addCookies([{ name: "thaali_outlet", value: rid, domain: new URL(BASE).hostname, path: "/" }]);
  const page = await ctx.newPage();
  await loginAs(page, "owner-1");
  await page.goto("/partner/menu");
  await expect(page.getByRole("heading", { name: "Menu", exact: true })).toBeVisible();
  return page;
}

async function customerPage(browser: Browser) {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await loginAs(page, "customer");
  await page.goto("/restaurant/saffron-courtyard");
  return page;
}

function itemRow(page: Page) {
  return page.locator(`[data-testid=partner-item][data-item-name="${ITEM}"]`);
}

test.beforeAll(async () => {
  test.setTimeout(180_000);
  // Warm up dev-server routes so the first sign-in doesn't time out on compilation.
  for (const path of ["/", "/login", "/restaurant/saffron-courtyard", "/partner/menu"]) await fetch(new URL(path, BASE)).catch(() => undefined);
  rid = (await query<{ id: string }>(`select id from restaurants where slug = 'saffron-courtyard'`))[0]!.id;
  await cleanup();
  await query(`update restaurants set is_online = true, busy_until = null where id = $1`, [rid]);
});

test.afterAll(async () => {
  await cleanup();
});

test("partner builds a category, subcategory and item; customers see stock changes live", async ({ browser }) => {
  test.setTimeout(180_000);
  const partner = await partnerPage(browser);

  // Category + subcategory with serving hours.
  await partner.getByRole("button", { name: "Add category", exact: true }).click();
  await partner.getByLabel("Category name").fill(CAT);
  await partner.getByRole("dialog").getByRole("button", { name: "Add category" }).click();
  const catRow = partner.locator(`[data-testid=category-row][data-category-name="${CAT}"]`);
  await expect(catRow).toBeVisible();

  await partner.getByRole("button", { name: `Add subcategory to ${CAT}` }).click();
  await partner.getByLabel("Subcategory name").fill(SUB);
  await partner.getByRole("dialog").getByRole("button", { name: "Add subcategory" }).click();
  const subRow = partner.locator(`[data-testid=category-row][data-category-name="${SUB}"]`);
  await expect(subRow).toBeVisible();

  await partner.getByRole("button", { name: `Edit ${SUB}` }).click();
  const dlg = partner.getByRole("dialog");
  await dlg.getByRole("switch", { name: "Only serve at set times" }).click();
  await dlg.getByLabel("From").selectOption("00:00");
  await dlg.getByLabel("To").selectOption("23:59");
  // Days: switching one off and back on keeps the item orderable every day.
  await dlg.getByRole("button", { name: "Sun" }).click();
  await expect(dlg.getByRole("button", { name: "Sun" })).toHaveAttribute("aria-pressed", "false");
  await dlg.getByRole("button", { name: "Sun" }).click();
  await dlg.getByRole("button", { name: "Save" }).click();
  await expect(subRow.getByText("12 am – 11:59 pm")).toBeVisible();
  const [sub] = await query<{ available_from: string; available_to: string; parent: string }>(
    `select c.available_from::text, c.available_to::text, p.name parent from menu_categories c join menu_categories p on p.id = c.parent_id where c.restaurant_id = $1 and c.name = $2`,
    [rid, SUB],
  );
  expect(sub).toMatchObject({ available_from: "00:00:00", available_to: "23:59:00", parent: CAT });

  // Reorder: the new category moves up one place.
  const sortOf = async () => (await query<{ sort: number }>(`select sort from menu_categories where restaurant_id = $1 and name = $2`, [rid, CAT]))[0]!.sort;
  const before = await sortOf();
  await partner.getByRole("button", { name: `Move ${CAT} up` }).click();
  await expect.poll(sortOf).toBeLessThan(before);

  // New item with photo, variants and an add-on group.
  await subRow.getByRole("button", { name: `${SUB}, ` }).click();
  await partner.getByRole("button", { name: `Add item to ${SUB}` }).click();
  const sheet = partner.getByRole("dialog");
  await sheet.getByLabel("Name", { exact: true }).fill(ITEM);
  await sheet.getByLabel("Description").fill("Wood-fired paneer, peppers and makhani sauce.");
  await sheet.getByLabel("Price (₹)").fill("249");
  await sheet.getByRole("radio", { name: "Veg", exact: true }).click();
  await sheet.getByLabel("Tags").fill("spicy, chef special");
  await sheet.getByTestId("item-photo-input").setInputFiles({ name: "bowl.png", mimeType: "image/png", buffer: PNG });
  await expect(sheet.getByTestId("item-photo-url")).toContainText(`/restaurant-media/${rid}/menu/`);
  await sheet.getByRole("button", { name: "Add variant" }).click();
  await sheet.getByLabel("Variant 1 name").fill("Regular");
  await sheet.getByLabel("Variant 1 price").fill("249");
  await sheet.getByRole("button", { name: "Add variant" }).click();
  await sheet.getByLabel("Variant 2 name").fill("Large");
  await sheet.getByLabel("Variant 2 price").fill("349.50");
  await sheet.getByRole("button", { name: "Add group" }).click();
  await sheet.getByLabel("Add-on group 1 name").fill("Extra toppings");
  await sheet.getByLabel("Add-on group 1 maximum").fill("2");
  await sheet.getByLabel("Group 1 add-on 1 name").fill("Olives");
  await sheet.getByLabel("Group 1 add-on 1 price").fill("30");
  await sheet.getByRole("button", { name: "Add add-on" }).click();
  await sheet.getByLabel("Group 1 add-on 2 name").fill("Jalapeños");
  await sheet.getByLabel("Group 1 add-on 2 price").fill("40");
  await sheet.getByLabel("Calories (kcal)").fill("620");
  await sheet.getByRole("button", { name: "Add item" }).click();
  await expect(partner.getByText("Item added")).toBeVisible();
  await expect(itemRow(partner)).toBeVisible();
  await expect(itemRow(partner)).toContainText("₹249");
  await expect(itemRow(partner)).toContainText("2 variants");

  const [db] = await query<{ id: string; price_paise: number; image_url: string; variants: number; large: number; addons: number; max_select: number; calories: number }>(
    `select i.id, i.price_paise, i.image_url, i.calories,
       (select count(*)::int from item_variants v where v.item_id = i.id) variants,
       (select price_paise from item_variants v where v.item_id = i.id and v.name = 'Large') large,
       (select count(*)::int from addons a join addon_groups g on g.id = a.group_id where g.item_id = i.id) addons,
       (select max_select from addon_groups g where g.item_id = i.id) max_select
     from menu_items i where i.restaurant_id = $1 and i.name = $2 and not i.is_deleted`,
    [rid, ITEM],
  );
  expect(db).toMatchObject({ price_paise: 24900, variants: 2, large: 34950, addons: 2, max_select: 2, calories: 620 });
  expect(db!.image_url).toContain(`/${rid}/menu/`);

  // Search narrows the list.
  await partner.getByLabel("Search items").fill("paneer pizza");
  await expect(partner.getByTestId("partner-item")).toHaveCount(1);
  await partner.getByLabel("Search items").fill("");

  // Customer sees it, with its customisation.
  const customer = await customerPage(browser);
  const card = customer.locator(`article[data-item-name="${ITEM}"]`);
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: `Add ${ITEM}` }).click();
  await expect(customer.getByRole("dialog").getByText("Extra toppings")).toBeVisible();
  await expect(customer.getByRole("dialog").getByText("Large").first()).toBeVisible();
  await customer.keyboard.press("Escape");

  // Out of stock in the partner app → sold out for the open customer page, no reload.
  await partner.getByRole("switch", { name: `In stock: ${ITEM}` }).click();
  await expect(card.getByText("Out of stock")).toBeVisible({ timeout: 8000 });
  await expect(card.getByRole("button", { name: `Add ${ITEM}` })).toBeHidden();
  await partner.getByRole("switch", { name: `In stock: ${ITEM}` }).click();
  await expect(card.getByRole("button", { name: `Add ${ITEM}` })).toBeVisible({ timeout: 8000 });

  // Stock tracking: qty 1 with alert at 2 → low-stock badge + one notification.
  await itemRow(partner).getByRole("button", { name: `Edit ${ITEM}` }).click();
  await sheet.getByRole("switch", { name: "Track stock quantity" }).click();
  await sheet.getByLabel("Quantity in stock").fill("1");
  await sheet.getByLabel("Low-stock alert at").fill("2");
  await sheet.getByRole("button", { name: "Save changes" }).click();
  await expect(itemRow(partner).getByText("Low stock")).toBeVisible();
  await expect(itemRow(partner).getByTestId("item-stock")).toHaveText("1 in stock");
  await expect.poll(() => lowStockNotices(1)).toBe(1);
  await expect(card.getByText("Only 1 left")).toBeVisible({ timeout: 8000 });

  // Inventory: +/- and set quantity; only a fresh crossing alerts again.
  await partner.getByRole("tab", { name: /Inventory/ }).click();
  await expect(partner).toHaveURL(/view=inventory/);
  const inv = partner.locator(`[data-testid=inventory-row][data-item-name="${ITEM}"]`);
  await expect(inv.getByText("Low stock")).toBeVisible();
  await inv.getByRole("button", { name: `Increase stock of ${ITEM}` }).click();
  await expect(inv.getByTestId("stock-qty")).toHaveText("2");
  await inv.getByRole("button", { name: `Increase stock of ${ITEM}` }).click();
  await expect(inv.getByTestId("stock-qty")).toHaveText("3");
  await expect(inv.getByText("Low stock")).toBeHidden();
  expect(await lowStockNotices(2)).toBe(0);
  await inv.getByLabel(`Stock quantity: ${ITEM}`).fill("1");
  await inv.getByRole("button", { name: `Save stock for ${ITEM}` }).click();
  await expect(inv.getByTestId("stock-qty")).toHaveText("1");
  await expect.poll(() => lowStockNotices(1)).toBe(2);
  await inv.getByRole("button", { name: `Decrease stock of ${ITEM}` }).click();
  await expect(inv.getByText("Out of stock")).toBeVisible();
  await expect(card.getByText("Out of stock")).toBeVisible({ timeout: 8000 });
  const [after] = await query<{ in_stock: boolean; stock_qty: number }>(`select in_stock, stock_qty from menu_items where id = $1`, [db!.id]);
  expect(after).toEqual({ in_stock: false, stock_qty: 0 });

  // Soft delete: gone from both apps.
  await partner.getByRole("tab", { name: /Menu/ }).click();
  await itemRow(partner).getByRole("button", { name: `Edit ${ITEM}` }).click();
  await sheet.getByRole("button", { name: "Delete item" }).click();
  await partner.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(itemRow(partner)).toBeHidden();
  await expect(card).toBeHidden({ timeout: 8000 });
  expect((await query<{ is_deleted: boolean }>(`select is_deleted from menu_items where id = $1`, [db!.id]))[0]!.is_deleted).toBe(true);

  // Delete the subcategory, then the category.
  await partner.getByRole("button", { name: `Edit ${SUB}` }).click();
  await partner.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await partner.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(subRow).toBeHidden();
  await partner.getByRole("button", { name: `Edit ${CAT}` }).click();
  await partner.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await partner.getByRole("alertdialog").getByRole("button", { name: "Delete" }).click();
  await expect(catRow).toBeHidden();
  expect(await query(`select 1 from menu_categories where restaurant_id = $1 and name in ($2, $3)`, [rid, CAT, SUB])).toHaveLength(0);

  await partner.context().close();
  await customer.context().close();
});
