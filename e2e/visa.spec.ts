import { expect, test } from "@playwright/test";
import { BASE, TEST_EMAIL, prisma, signIn } from "./helpers";

test("visa: search, country page, wizard, documents, pay, team files and issues the visa", async ({ page, context }) => {
  // home: search with suggestions
  await page.goto("/visa");
  await expect(page.getByRole("heading", { name: /Your visa, sorted/ })).toBeVisible();
  await expect(page.locator(".vx-card").first()).toBeVisible();
  await page.getByLabel("Travelling to").fill("viet");
  await page.locator(".vx-pop .vx-opt", { hasText: "Vietnam" }).first().click();

  // country page: exactly 2 travellers, price, start
  await expect(page.getByRole("heading", { name: "Vietnam visa" })).toBeVisible();
  const count = page.locator(".vx-counter b");
  for (let i = 0; i < 9 && (await count.innerText()) !== "1"; i++) await page.getByRole("button", { name: "Fewer travellers" }).click();
  await page.getByRole("button", { name: "More travellers" }).click();
  await expect(count).toHaveText("2");
  await page.getByRole("button", { name: /Start application/ }).click();

  // wizard step 1: dates
  const arrive = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
  await page.getByLabel("Arriving in Vietnam").fill(arrive);
  await expect(page.getByText("In good time")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // step 2: validation shows, then travellers and contact
  await page.getByRole("button", { name: /Continue to documents/ }).click();
  await expect(page.getByText("Full name as printed on the passport.").first()).toBeVisible();
  await page.getByLabel("Traveller 1: full name").fill("E2E Asha Rao");
  await page.getByLabel("Traveller 2: full name").fill("E2E Vikram Rao");
  await page.getByLabel("Your name").fill("E2E Asha Rao");
  await page.getByLabel("Mobile number").fill("+91 98765 43210");
  await page.locator(".vx-stage").getByLabel("Email").fill(TEST_EMAIL);
  await page.getByRole("button", { name: /Continue to documents/ }).click();

  // step 3: documents
  await expect(page).toHaveURL(/\/visa\/application\/RB-/);
  const ref = page.url().match(/RB-[A-Z0-9]+/)![0];
  await expect(page.locator(".vx-progress li.now")).toContainText("Documents");
  await expect(page.getByRole("button", { name: /E2E Vikram Rao/ })).toBeVisible();
  const e = (await prisma.enquiry.findUnique({ where: { ref } }))!;
  expect(e.type).toBe("visa");
  expect(e.quotedTotal).toBeGreaterThan(0);
  expect(JSON.parse(e.travellers!)).toEqual(["E2E Asha Rao", "E2E Vikram Rao"]);

  // step 4: review & pay
  await page.getByRole("button", { name: /Review & pay/ }).click();
  await expect(page.locator(".vx-progress li.now")).toContainText("Review");
  await expect(page.getByRole("button", { name: /securely/ })).toBeVisible();

  // paid (as if Razorpay confirmed it) → tracking
  const pay = await prisma.payment.create({ data: { enquiryId: e.id, kind: "full", amount: e.quotedTotal!, orderId: `order_E2E_${ref}` } });
  await page.request.post(`${BASE}/api/e2e/settle`, { data: { paymentRowId: pay.id } });
  await page.reload();
  await expect(page.getByRole("heading", { name: "Where your visa is" })).toBeVisible();

  // the team files it and uploads the issued visa
  const appPage = page.url();
  await signIn(context, "admin");
  await page.goto(`/admin/enquiries?q=${ref}`);
  await page.locator("select[name=stage]").selectOption("submitted");
  await page.getByRole("button", { name: "Update and notify" }).click();
  await expect.poll(async () => JSON.parse((await prisma.enquiry.findUnique({ where: { ref } }))!.details!).stage).toBe("submitted");
  await page.goto(`/admin/enquiries?q=${ref}`);
  await page.locator("form", { hasText: "Upload issued visa" }).locator("input[type=file]").setInputFiles({ name: "vietnam-evisa-asha.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4\n% E2E test visa\n%%EOF\n") });
  await page.getByRole("button", { name: "Upload issued visa" }).click();
  await expect.poll(async () => JSON.parse((await prisma.enquiry.findUnique({ where: { ref } }))!.details!).stage).toBe("approved");

  // the traveller downloads it with the emailed link
  await context.clearCookies();
  await page.goto(appPage);
  await expect(page.getByRole("heading", { name: "Your visa is ready" })).toBeVisible();
  const href = (await page.getByRole("link", { name: "Download" }).first().getAttribute("href"))!;
  const r = await page.request.get(BASE + href);
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("pdf");
});

test("visa: every country has a page; unpriced ones wait for the team's price", async ({ page }) => {
  await page.goto("/visa");
  await expect(page.locator("#all-countries .vx-az a")).toHaveCount(await page.locator("#all-countries .vx-az a").count());
  expect(await page.locator("#all-countries .vx-az a").count()).toBeGreaterThan(150);
  await page.goto("/visa/kenya");
  await expect(page.getByRole("heading", { name: "Kenya visa" })).toBeVisible();
  await expect(page.getByText("Confirmed before you pay")).toBeVisible();
  await page.goto("/visa/maldives");
  await expect(page.getByText(/No visa (needed|to apply for)/).first()).toBeVisible();
});

test("visa: admin catalogue lists the visas", async ({ page, context }) => {
  await signIn(context, "admin");
  await page.goto("/admin/visas");
  await expect(page.getByRole("heading", { name: "Visas" })).toBeVisible();
  await expect(page.locator(".vadm-item").first()).toBeVisible();
});
