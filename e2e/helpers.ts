import { expect, type BrowserContext, type Page } from "@playwright/test";

export const BASE = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${process.env.PORT ?? 3100}`;
export const GATEWAY = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";

/** Skip the first-visit welcome screen by setting a delivery location (Koregaon Park). */
export async function setLocation(context: BrowserContext, loc = { lat: 18.5385, lng: 73.8925, label: "Home", line: "Koregaon Park, Pune" }) {
  const url = new URL(BASE);
  await context.addCookies([{ name: "thaali_loc", value: JSON.stringify(loc), domain: url.hostname, path: "/" }]);
}

export type Persona = "customer" | "owner-1" | "owner-2" | "owner-3" | "rider" | "admin";
const personaLabel: Record<Persona, RegExp> = {
  customer: /^Customer/,
  "owner-1": /Saffron Courtyard/,
  "owner-2": /Baner Biryani House/,
  "owner-3": /Green Bowl/,
  rider: /^Rider/,
  admin: /^Admin/,
};
const personaHome: Record<Persona, RegExp> = {
  customer: /\/$/,
  "owner-1": /\/partner/,
  "owner-2": /\/partner/,
  "owner-3": /\/partner/,
  rider: /\/rider/,
  admin: /\/admin/,
};

/** Sign in through the Demo Switcher, exactly as a presenter would. */
export async function loginAs(page: Page, persona: Persona) {
  await setLocation(page.context());
  if (!page.url().startsWith(BASE)) await page.goto("/login");
  await page.getByTestId("demo-switcher").click();
  await page.getByRole("button", { name: personaLabel[persona] }).first().click();
  await expect(page).toHaveURL(personaHome[persona], { timeout: 15_000 });
}

/** Collect console errors, ignoring image loads that fail only because the sandbox has no internet. */
export function trackConsoleErrors(page: Page) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/Failed to load resource|images\.unsplash|tile\.openstreetmap|ERR_TUNNEL|ERR_NAME_NOT_RESOLVED|status of 40[0-9]|_next\/image/.test(text)) return;
    errors.push(text);
  });
  return errors;
}

export async function latestMail(to: string): Promise<{ subject: string; body: string } | undefined> {
  const res = await fetch(`${GATEWAY}/mail?to=${encodeURIComponent(to)}`);
  const list = (await res.json()) as { subject: string; body: string }[];
  return list.at(-1);
}
