import { expect, test } from "@playwright/test";
import { setLocation, trackConsoleErrors } from "./helpers";

test.beforeEach(async ({ context }) => {
  await setLocation(context);
});

test("home shows banners, cuisines, rails and restaurants", async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await page.goto("/");
  await expect(page.getByRole("region", { name: "Offers" })).toBeVisible();
  await expect(page.getByRole("heading", { name: /what's on your mind/i })).toBeVisible();
  await expect(page.getByTestId("rail-top-rated")).toBeVisible();
  await expect(page.getByTestId("rail-collections")).toBeVisible();
  const cards = page.locator("#restaurants [data-testid=restaurant-card]");
  expect(await cards.count()).toBeGreaterThan(15);
  expect(errors).toEqual([]);
});

test("filters: pure veg, rating and cuisine narrow the list", async ({ page }) => {
  await page.goto("/");
  const all = await page.locator("#restaurants [data-testid=restaurant-card]").count();
  await page.getByRole("toolbar", { name: "Filters" }).getByRole("button", { name: "Pure Veg" }).click();
  await expect(page).toHaveURL(/veg=1/);
  const veg = await page.locator("#restaurants [data-testid=restaurant-card]").count();
  expect(veg).toBeGreaterThan(0);
  expect(veg).toBeLessThan(all);
  await expect(page.locator("#restaurants [data-testid=restaurant-card]").first()).toContainText(/pure veg/i);
  await page.goto("/?cuisines=Biryani&sort=rating");
  const names = await page.locator("#restaurants [data-testid=restaurant-card] h3").allTextContents();
  expect(names.length).toBeGreaterThan(0);
  expect(names.join(" ")).toMatch(/biryani|kebab|dastarkhwan|badshah/i);
});

test("Veg Mode hides non-veg restaurants and dishes app-wide", async ({ page }) => {
  await page.goto("/");
  const before = await page.locator("#restaurants [data-testid=restaurant-card]").count();
  await page.getByRole("switch", { name: "Veg Mode" }).click();
  await expect(page.getByText(/veg mode on/i).first()).toBeVisible();
  await expect.poll(async () => page.locator("#restaurants [data-testid=restaurant-card]").count()).toBeLessThan(before);
  await page.goto("/search?q=thali");
  await expect(page.getByTestId("dish-result").first()).toBeVisible();
  const dishText = await page.getByTestId("dish-result").allTextContents();
  expect(dishText.join(" ")).toMatch(/thali/i);
  expect(dishText.join(" ")).not.toMatch(/fish|chicken|mutton|egg/i);
  // restore
  await page.goto("/");
  await page.getByRole("switch", { name: "Veg Mode" }).click();
  await expect(page.getByText(/veg mode off/i).first()).toBeVisible();
});

test("search groups restaurants and dishes and tolerates typos", async ({ page }) => {
  await page.goto("/search");
  await expect(page.getByText(/trending searches/i)).toBeVisible();
  await page.getByLabel("Search", { exact: true }).fill("biryani");
  await expect(page.getByRole("region", { name: "Restaurants" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Dishes" })).toBeVisible();
  await page.getByLabel("Search", { exact: true }).fill("biriyani");
  await expect(page.getByRole("region", { name: "Dishes" }).or(page.getByRole("region", { name: "Restaurants" })).first()).toBeVisible();
  await page.getByLabel("Search", { exact: true }).fill("paner tika");
  await expect(page.getByTestId("dish-result").filter({ hasText: /paneer tikka/i }).first()).toBeVisible();
});

test("dish search result can be added to the cart", async ({ page }) => {
  await page.goto("/search?q=masala dosa");
  await page.getByRole("button", { name: /^Add Masala Dosa from/ }).first().click();
  await page.getByRole("button", { name: /add item/i }).click();
  await expect(page.getByTestId("cart-bar")).toContainText("1 item");
});

test("restaurant page: menu, filters, customisation, cart and replace dialog", async ({ page }) => {
  const errors = trackConsoleErrors(page);
  await page.goto("/restaurant/saffron-courtyard");
  await expect(page.getByRole("heading", { name: "Saffron Courtyard", level: 1 })).toBeVisible();
  await expect(page.getByRole("list", { name: "Offers" })).toContainText("SAFFRON20");

  // in-menu search + veg filter
  await page.getByLabel("Search the menu").fill("paneer");
  const names = await page.getByTestId("menu-item").evaluateAll((els) => els.map((e) => e.getAttribute("data-item-name")));
  expect(names.every((n) => /paneer/i.test(n ?? ""))).toBe(true);
  await page.getByLabel("Search the menu").fill("");
  await page.getByRole("button", { name: "Veg", exact: true }).click();
  await expect(page.getByTestId("menu-item").filter({ hasText: "Butter Chicken" })).toHaveCount(0);
  await page.getByRole("button", { name: "Veg", exact: true }).click();

  // simple add + stepper
  await page.getByRole("button", { name: "Add Hara Bhara Kebab" }).click();
  await expect(page.getByTestId("cart-bar")).toContainText("1 item");
  await page.getByRole("button", { name: "Add one more Hara Bhara Kebab" }).click();
  await expect(page.getByTestId("cart-bar")).toContainText("2 item");

  // customisation: variant + add-ons, live price
  await page.getByRole("button", { name: "Add Lucknowi Chicken Biryani" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByLabel("Full (serves 2)").click();
  await sheet.getByLabel("Burani raita").click();
  await expect(sheet.getByRole("button", { name: /add item · ₹/i })).toContainText("₹");
  await sheet.getByRole("button", { name: /add item/i }).click();
  await expect(page.getByTestId("cart-bar")).toContainText("3 item");

  // out-of-stock item is greyed out
  await expect(page.getByTestId("menu-item").filter({ hasText: "Rasmalai" }).getByText(/out of stock/i)).toBeVisible();

  // adding from another restaurant asks to replace
  await page.goto("/restaurant/burger-republic");
  await page.getByRole("button", { name: "Add Aloo Tikki Burger" }).click();
  await page.getByRole("dialog").getByRole("button", { name: /make it a meal/i }).first().isVisible().catch(() => false);
  if (await page.getByRole("button", { name: /add item/i }).isVisible().catch(() => false)) await page.getByRole("button", { name: /add item/i }).click();
  await expect(page.getByRole("alertdialog")).toContainText(/replace cart items/i);
  await page.getByRole("button", { name: "Replace" }).click();
  await expect(page.getByTestId("cart-bar")).toContainText("Burger Republic");
  expect(errors).toEqual([]);
});

test("restaurant reviews, photos and info tabs", async ({ page }) => {
  await page.goto("/restaurant/baner-biryani-house");
  await page.getByRole("tab", { name: /reviews/i }).click();
  await expect(page.getByTestId("review-summary")).not.toBeEmpty();
  await page.getByRole("button", { name: "5★" }).click();
  await page.getByRole("tab", { name: "Info" }).click();
  await expect(page.getByRole("link", { name: /get directions/i })).toHaveAttribute("href", /google\.com\/maps/);
  await expect(page.getByText(/FSSAI/)).toBeVisible();
});

test("collections page lists curated restaurants", async ({ page }) => {
  await page.goto("/collections/best-biryani-in-pune");
  await expect(page.getByRole("heading", { name: /best biryani in pune/i })).toBeVisible();
  expect(await page.getByTestId("restaurant-card").count()).toBeGreaterThan(1);
});
