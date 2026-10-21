import { expect, test } from "@playwright/test";

const apps = [
  { path: "/", heading: /what's on your mind/i, marker: "customer" },
  { path: "/partner", heading: /live orders/i, marker: "partner" },
  { path: "/rider", heading: /ready to ride/i, marker: "rider" },
  { path: "/admin", heading: /overview/i, marker: "admin" },
];

for (const app of apps) {
  test(`${app.marker} app renders at ${app.path}`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });

    await page.goto(app.path);
    await expect(page.locator(`[data-app="${app.marker}"]`)).toBeVisible();
    await expect(page.getByRole("heading", { name: app.heading })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("every nav link resolves (no dead links)", async ({ page, request }) => {
  for (const root of ["/", "/partner", "/rider", "/admin"]) {
    await page.goto(root);
    const hrefs = await page.locator('nav a[href^="/"]').evaluateAll((els) =>
      Array.from(new Set(els.map((el) => el.getAttribute("href") ?? ""))),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const res = await request.get(href);
      expect(res.status(), href).toBe(200);
    }
  }
});

test("demo switcher opens and jumps to the rider app", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("demo-switcher").click();
  await expect(page.getByRole("heading", { name: /switch demo persona/i })).toBeVisible();
  await page.getByRole("button", { name: /rider/i }).first().click();
  await expect(page).toHaveURL(/\/rider$/);
  await expect(page.locator('[data-app="rider"]')).toBeVisible();
});

test("PWA manifest and icons are served", async ({ request }) => {
  const manifest = await request.get("/manifest.webmanifest");
  expect(manifest.ok()).toBe(true);
  const json = (await manifest.json()) as { icons: { src: string }[] };
  for (const icon of json.icons) {
    const res = await request.get(icon.src);
    expect(res.headers()["content-type"]).toContain("image/png");
  }
});
