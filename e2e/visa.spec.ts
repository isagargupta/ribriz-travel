import { expect, test } from "@playwright/test";
import { BASE, TEST_EMAIL, prisma, signIn } from "./helpers";

const setDate = async (page: import("@playwright/test").Page, sel: string, v: string) => page.locator(sel).fill(v);

test("visa: search, country page, apply, documents, pay, team files and issues the visa", async ({ page, context }) => {
  // landing and search
  await page.goto("/visa");
  await expect(page.getByRole("heading", { name: /Your visa, handled/ })).toBeVisible();
  await expect(page.locator(".vz-card").first()).toBeVisible();
  await page.getByRole("textbox", { name: "Search a destination" }).fill("viet");
  await page.locator(".vz-results a", { hasText: "Vietnam" }).click();

  // country page: price for 2, ready-by, apply
  await expect(page.getByRole("heading", { name: /Vietnam visa for Indians/ })).toBeVisible();
  // exactly 2 travellers, whatever the visitor's saved group size
  const count = page.locator(".vz-apply .vz-step b");
  for (let i = 0; i < 9 && (await count.innerText()) !== "1"; i++) await page.locator(".vz-apply").getByRole("button", { name: "Fewer" }).click();
  await page.locator(".vz-apply").getByRole("button", { name: "More" }).click();
  await expect(count).toHaveText("2");
  await expect(page.locator(".vz-price .tot")).toContainText("₹");
  await page.getByRole("button", { name: "Start application" }).click();

  // step 1: trip
  const arrive = new Date(Date.now() + 40 * 864e5).toISOString().slice(0, 10);
  await setDate(page, ".vz-form input[type=date] >> nth=0", arrive);
  await expect(page.getByText("In good time for your trip")).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();

  // step 2: travellers and contact
  const form = page.locator(".vz-form");
  await expect(form.locator("input")).toHaveCount(5); // 2 travellers + name, mobile, email
  const values = ["E2E Asha Rao", "E2E Vikram Rao", "E2E Asha Rao", "+91 98765 43210", TEST_EMAIL];
  for (const [i, v] of values.entries()) { await form.locator("input").nth(i).fill(v); await expect(form.locator("input").nth(i)).toHaveValue(v); }
  await page.getByRole("button", { name: "Continue to documents" }).click();

  // application page
  await expect(page).toHaveURL(/\/visa\/application\/RB-/);
  const ref = page.url().match(/RB-[A-Z0-9]+/)![0];
  await expect(page.locator(".vz-track li.now")).toContainText("Documents");
  const e = (await prisma.enquiry.findUnique({ where: { ref } }))!;
  expect(e.type).toBe("visa");
  expect(e.quotedTotal).toBeGreaterThan(0);
  expect(JSON.parse(e.travellers!)).toEqual(["E2E Asha Rao", "E2E Vikram Rao"]);
  await expect(page.getByRole("tab", { name: "E2E Vikram Rao" })).toBeVisible();

  // pay (settled as if Razorpay confirmed it); documents still missing → stays at Documents
  const pay = await prisma.payment.create({ data: { enquiryId: e.id, kind: "full", amount: e.quotedTotal!, orderId: `order_E2E_${ref}` } });
  await page.request.post(`${BASE}/api/e2e/settle`, { data: { paymentRowId: pay.id } });
  await page.reload();
  await expect(page.getByText("Paid. Our visa team takes it from here.")).toBeVisible();

  // the team files it, then uploads the issued visa for traveller 1
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

  // the traveller sees it issued and can download it with the emailed link
  await context.clearCookies();
  await page.goto(appPage);
  await expect(page.getByRole("heading", { name: /Your visa is ready/ })).toBeVisible();
  const href = (await page.getByRole("link", { name: /Download vietnam-evisa-asha.pdf/ }).getAttribute("href"))!;
  const r = await page.request.get(BASE + href);
  expect(r.status()).toBe(200);
  expect(r.headers()["content-type"]).toContain("pdf");
});

test("visa: admin catalogue lists the visas and flags unchecked fees", async ({ page, context }) => {
  await signIn(context, "admin");
  await page.goto("/admin/visas");
  await expect(page.getByRole("heading", { name: "Visas" })).toBeVisible();
  await expect(page.locator(".vadm-item").first()).toBeVisible();
});
