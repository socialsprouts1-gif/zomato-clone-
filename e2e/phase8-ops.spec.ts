import { expect as baseExpect, test, type Page } from "@playwright/test";
import { query } from "./db";
import { BASE, latestMail, loginAs, setLocation } from "./helpers";

// The dev server compiles pages on first hit and several servers share this machine: be patient.
const expect = baseExpect.configure({ timeout: 20_000 });
test.describe.configure({ mode: "serial", timeout: 180_000 });
test.use({ navigationTimeout: 90_000 });

const SAFFRON = "saffron-courtyard";
let saffronId = "";
let originalPrep = 20;
const istToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());

async function useSaffron(page: Page) {
  await page.context().addCookies([{ name: "thaali_outlet", value: saffronId, domain: new URL(BASE).hostname, path: "/" }]);
}

test.beforeAll(async () => {
  const [r] = await query<{ id: string; avg_prep_minutes: number }>(`select id, avg_prep_minutes from restaurants where slug = $1`, [SAFFRON]);
  saffronId = r!.id;
  originalPrep = r!.avg_prep_minutes === 25 ? 20 : r!.avg_prep_minutes;
  await query(`update restaurants set is_online = true, busy_until = null, holidays = '{}', auto_accept = false where id = $1`, [saffronId]);
  // Bookings to act on.
  await query(`delete from table_bookings where booking_code like 'TE2E%'`);
  await query(
    `insert into table_bookings (booking_code, user_id, restaurant_id, booking_date, time_slot, guests, status, special_request, customer_name, customer_phone)
     select 'TE2E01', p.id, $1::uuid, (now() at time zone 'Asia/Kolkata')::date, '21:00'::time, 2, 'pending'::booking_status, 'Window seat please', 'Priya Sharma', '+919800000001' from profiles p where p.email = 'customer@demo.in'
     union all
     select 'TE2E02', p.id, $1::uuid, (now() at time zone 'Asia/Kolkata')::date + 2, '20:00'::time, 6, 'pending'::booking_status, null::text, 'Priya Sharma', '+919800000001' from profiles p where p.email = 'customer@demo.in'`,
    [saffronId],
  );
  await query(`delete from restaurant_tables where restaurant_id = $1 and label like 'QA%'`, [saffronId]);
  // Staff + onboarding leftovers from earlier runs.
  await query(`delete from restaurant_staff where email like 'e2e-staff-%'`);
  await query(`delete from auth.users where email like 'e2e-staff-%'`);
  await query(`delete from auth.users where id in (select owner_id from restaurants where name like 'E2E Kathi Test%')`);
  await query(`delete from restaurants where name like 'E2E Kathi Test%'`);
});

test.afterAll(async () => {
  await query(`update restaurants set is_online = true, busy_until = null, holidays = '{}', auto_accept = false, avg_prep_minutes = $2 where id = $1`, [saffronId, originalPrep]);
});

test("owner confirms (with a table) and declines bookings; guest is notified", async ({ page }) => {
  await loginAs(page, "owner-1");
  await useSaffron(page);
  await page.goto("/partner/bookings");
  await page.getByRole("tab", { name: /^Today/ }).click();
  const today = page.locator('[data-testid="booking-card"][data-code="TE2E01"]');
  await expect(today).toContainText("Window seat please");
  await today.getByRole("button", { name: "Confirm" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Assign a table" }).click();
  await page.getByRole("option", { name: /^T2 · Main/ }).click();
  await dialog.getByRole("button", { name: "Confirm booking" }).click();
  await expect(page.getByText(/booking confirmed/i).first()).toBeVisible();
  await expect(today).toContainText("Confirmed");
  await expect(today).toContainText("Table T2");
  const [b1] = await query<{ status: string; label: string | null }>(`select b.status, t.label from table_bookings b left join restaurant_tables t on t.id = b.table_id where booking_code = 'TE2E01'`);
  expect(b1).toEqual({ status: "confirmed", label: "T2" });

  await page.getByRole("tab", { name: /^Upcoming/ }).click();
  const later = page.locator('[data-testid="booking-card"][data-code="TE2E02"]');
  await later.getByRole("button", { name: "Decline" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Fully booked for this slot" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Decline booking" }).click();
  await expect(later).toContainText("Declined: Fully booked for this slot");
  const [b2] = await query<{ status: string; decline_reason: string }>(`select status, decline_reason from table_bookings where booking_code = 'TE2E02'`);
  expect(b2).toEqual({ status: "declined", decline_reason: "Fully booked for this slot" });

  const notes = await query<{ title: string }>(
    `select title from notifications n join profiles p on p.id = n.user_id where p.email = 'customer@demo.in' and n.created_at > now() - interval '2 minutes' and n.title like '%Saffron Courtyard%' order by n.created_at`,
  );
  expect(notes.map((n) => n.title)).toEqual(expect.arrayContaining(["Table booked at Saffron Courtyard", "Booking at Saffron Courtyard declined"]));
});

test("owner adds a table; its QR opens the restaurant page for that table", async ({ page }) => {
  await loginAs(page, "owner-1");
  await useSaffron(page);
  await page.goto("/partner/bookings");
  await page.getByRole("button", { name: "Add table" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Table name").fill("qa7");
  await dialog.getByLabel("Section").fill("Terrace");
  await dialog.getByLabel("Seats").fill("2");
  await dialog.getByRole("button", { name: "Save table" }).click();
  await expect(page.getByText("Table QA7 added")).toBeVisible();
  const card = page.locator('[data-testid="table-card"][data-label="QA7"]');
  await expect(card).toContainText("Terrace · 2 seats");
  const qr = card.getByRole("img", { name: "QR code for table QA7" });
  await expect(qr).toHaveAttribute("src", /^data:image\/png;base64,/);
  const [t] = await query<{ qr_token: string }>(`select qr_token from restaurant_tables where restaurant_id = $1 and label = 'QA7'`, [saffronId]);
  const url = await qr.getAttribute("data-qr-url");
  expect(url).toBe(`${new URL(page.url()).origin}/restaurant/${SAFFRON}?table=${encodeURIComponent(t!.qr_token)}`);
  await expect(card.getByRole("button", { name: "Download QR for table QA7" })).toBeEnabled();

  await page.goto(url!);
  await expect(page.getByTestId("restaurant-page")).toBeVisible();
  await expect(page.getByTestId("table-banner")).toContainText("You're at Table QA7");

  await page.goto("/partner/bookings");
  await page.getByRole("button", { name: "Delete table QA7" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Delete table" }).click();
  await expect(page.locator('[data-testid="table-card"][data-label="QA7"]')).toHaveCount(0);
});

test("settings: busy mode, holiday closes the customer page, prep time", async ({ page }) => {
  await loginAs(page, "owner-1");
  await useSaffron(page);
  await page.goto("/partner/settings");
  await page.getByRole("button", { name: "Busy for 30 min" }).click();
  await expect(page.getByTestId("busy-status")).toContainText(/Busy until \d{1,2}:\d{2}/);
  const [busy] = await query<{ mins: number }>(`select extract(epoch from busy_until - now()) / 60 as mins from restaurants where id = $1`, [saffronId]);
  expect(Number(busy!.mins)).toBeGreaterThan(28);
  expect(Number(busy!.mins)).toBeLessThanOrEqual(30);
  await page.getByRole("button", { name: /I'm back now/ }).click();
  await expect(page.getByTestId("busy-status")).toContainText("Pause new orders");

  const today = istToday();
  await page.getByLabel("Holiday date").fill(today);
  await page.getByRole("button", { name: "Add holiday" }).click();
  await expect(page.getByRole("list", { name: "Upcoming holidays" })).toContainText("today");
  await page.goto(`/restaurant/${SAFFRON}`);
  await expect(page.getByText(/Closed today\. You can still schedule/)).toBeVisible();
  await page.goto("/partner/settings");
  await page.getByRole("button", { name: /Remove holiday/ }).first().click();
  await expect(page.getByText(/No upcoming holidays/)).toBeVisible();
  expect((await query<{ h: string[] }>(`select holidays::text[] h from restaurants where id = $1`, [saffronId]))[0]!.h).toEqual([]);

  await page.getByLabel("Average prep time (minutes)").fill("25");
  await page.getByRole("button", { name: "Save kitchen settings" }).click();
  await expect(page.getByText("Kitchen settings saved")).toBeVisible();
  expect((await query<{ p: number }>(`select avg_prep_minutes p from restaurants where id = $1`, [saffronId]))[0]!.p).toBe(25);

  await page.getByRole("switch", { name: "Open on Sunday" }).click();
  await expect(page.getByTestId("hours-sun")).toContainText("Closed");
  await page.getByRole("switch", { name: "Open on Sunday" }).click();
  await page.getByRole("button", { name: "Save hours" }).click();
  await expect(page.getByText("Opening hours saved")).toBeVisible();
});

test("owner invites staff; the new user signs in and reaches the partner app", async ({ page, browser }) => {
  const email = `e2e-staff-${Date.now()}@test.in`;
  await loginAs(page, "owner-1");
  await useSaffron(page);
  await page.goto("/partner/settings#staff");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send invite" }).click();
  const row = page.locator(`[data-testid="staff-row"][data-email="${email}"]`);
  await expect(row).toContainText("Invited");

  const ctx = await browser.newContext();
  const staff = await ctx.newPage();
  await setLocation(ctx);
  await staff.goto("/login?next=%2Fpartner");
  await staff.getByRole("tab", { name: /email/i }).click();
  await staff.getByRole("textbox", { name: "Email" }).fill(email);
  await staff.getByRole("button", { name: /send magic link/i }).click();
  await expect(staff.getByText(/check your inbox/i)).toBeVisible({ timeout: 60_000 });
  let link: string | undefined;
  await expect
    .poll(async () => {
      link = (await latestMail(email))?.body.match(/href="([^"]+)"/)?.[1]?.replace(/&amp;/g, "&");
      return Boolean(link);
    })
    .toBe(true);
  await staff.goto(link!);
  await expect(staff).toHaveURL(/\/partner/, { timeout: 15000 });
  await expect(staff.getByRole("button", { name: "Switch outlet" })).toContainText("Saffron Courtyard");
  await staff.goto("/partner/settings");
  await expect(staff.getByText(/signed in as order taker/i)).toBeVisible();
  await expect(staff.getByRole("button", { name: "Save hours" })).toHaveCount(0);
  await ctx.close();

  const [s] = await query<{ status: string; role: string }>(`select s.status, p.role from restaurant_staff s join profiles p on p.id = s.user_id where s.email = $1`, [email]);
  expect(s).toEqual({ status: "active", role: "restaurant_staff" });

  await page.reload();
  await expect(row).toContainText("Active");
  await row.getByRole("combobox", { name: `Role for ${email}` }).click();
  await page.getByRole("option", { name: "Manager" }).click();
  await expect(page.getByText(`${email} is now manager`)).toBeVisible();
  await row.getByRole("button", { name: `Remove ${email}` }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Remove" }).click();
  await expect(row).toHaveCount(0);
  const [after] = await query<{ status: string; role: string }>(`select s.status, p.role from restaurant_staff s join profiles p on p.id = s.user_id where s.email = $1`, [email]);
  expect(after).toEqual({ status: "removed", role: "customer" });
});

test("a customer registers a restaurant and sees the pending review screen", async ({ page, context }) => {
  await setLocation(context);
  await page.goto("/login");
  const phone = `8${String(Date.now()).slice(-9)}`;
  await page.getByLabel("Mobile number").fill(phone);
  await page.getByRole("button", { name: /send otp/i }).click();
  await page.getByLabel(/enter the code/i).fill("123456");
  await page.getByRole("button", { name: /verify/i }).click();
  await expect(page).toHaveURL(/\/$/);

  // (In demo mode /partner opens the demo owner's console, so a new customer starts onboarding from the CTA page.)
  await page.goto("/forbidden?need=restaurant_owner,restaurant_staff,admin&next=%2Fpartner");
  await page.getByRole("link", { name: "Register your restaurant" }).click();
  await expect(page).toHaveURL(/\/partner\/onboarding/);

  const name = `E2E Kathi Test ${phone.slice(-4)}`;
  await page.getByLabel("Restaurant name").fill(name);
  await page.getByLabel("Cuisines").fill("Rolls, Bengali");
  await page.getByLabel("Cost for two (₹)").fill("400");
  await expect(page.getByLabel("Cost for two (₹)")).toHaveValue("400");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Location", exact: true })).toBeVisible();
  // Required fields are validated per step.
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByText("Pick the location on the map")).toBeVisible();
  await page.getByLabel("Search address").fill("Baner");
  await page.getByRole("button", { name: /baner/i }).first().click();
  await expect(page.getByTestId("chosen-location")).toBeVisible();
  await expect(page.getByLabel("Locality")).not.toHaveValue("");
  await page.getByLabel("Full address").fill("Shop 4, Sai Plaza, Baner Road, Baner, Pune 411045");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Legal & bank" })).toBeVisible();

  await page.getByLabel("FSSAI licence number").fill("11522999000123");
  await page.getByLabel("PAN").fill("abcde1234f");
  await page.getByLabel("Account holder name").fill("E2E Kathi Foods");
  await page.getByLabel("Account number").fill("123456789012");
  await page.getByLabel("IFSC").fill("HDFC0001234");
  await page.getByLabel("Owner name").fill("Test Owner");
  await page.getByLabel("Owner email").fill("owner.e2e@test.in");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Photos & documents" })).toBeVisible();

  await page.locator("#up-cover").setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: Buffer.from("89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000d49444154789c6360000002000154a24f5d0000000049454e44ae426082", "hex") });
  await expect(page.getByText("cover.png")).toBeVisible();
  await page.getByRole("button", { name: "Submit for review" }).click();

  await expect(page).toHaveURL(/\/partner$/, { timeout: 20000 });
  await expect(page.getByTestId("pending-review")).toContainText("Your restaurant is under review");
  await expect(page.getByTestId("pending-review")).toContainText(name);

  const [r] = await query<{ status: string; role: string; masked: string; pan: string; cover: string | null }>(
    `select r.status, p.role, rp.bank_account_number_masked masked, rp.pan_number pan, r.cover_image_url cover
     from restaurants r join profiles p on p.id = r.owner_id join restaurant_private rp on rp.restaurant_id = r.id where r.name = $1`,
    [name],
  );
  expect(r).toMatchObject({ status: "pending", role: "restaurant_owner", masked: "XXXXXX9012", pan: "ABCDE1234F" });
  expect(r!.cover).toContain("restaurant-media");

  await page.goto("/partner/onboarding");
  await expect(page.getByRole("heading", { name: "Application status" })).toBeVisible();
});
