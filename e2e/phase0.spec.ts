import { expect, test } from "@playwright/test";
import { loginAs, setLocation, trackConsoleErrors, type Persona } from "./helpers";

const apps: { path: string; marker: string; persona?: Persona; heading: RegExp }[] = [
  { path: "/", marker: "customer", heading: /what's on your mind/i },
  { path: "/partner", marker: "partner", persona: "owner-1", heading: /live orders/i },
  { path: "/rider", marker: "rider", persona: "rider", heading: /ready to ride|you're|active delivery|online/i },
  { path: "/admin", marker: "admin", persona: "admin", heading: /overview/i },
];

for (const app of apps) {
  test(`${app.marker} app renders at ${app.path}`, async ({ page, context }) => {
    const errors = trackConsoleErrors(page);
    await setLocation(context);
    if (app.persona) await loginAs(page, app.persona);
    await page.goto(app.path);
    await expect(page.locator(`[data-app="${app.marker}"]`)).toBeVisible();
    await expect(page.getByRole("heading", { name: app.heading }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("every nav link resolves (no dead links)", async ({ page }) => {
  await loginAs(page, "admin");
  for (const root of ["/", "/partner", "/rider", "/admin"]) {
    await page.goto(root);
    const hrefs = await page.locator('nav a[href^="/"]').evaluateAll((els) =>
      Array.from(new Set(els.map((el) => el.getAttribute("href") ?? ""))),
    );
    expect(hrefs.length).toBeGreaterThan(0);
    for (const href of hrefs) {
      const res = await page.request.get(href);
      expect(res.status(), href).toBe(200);
    }
  }
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
