import { expect, test } from "@playwright/test";
import { TEST_EMAIL, prisma } from "./helpers";

test("guest holds a price on the trip page; it becomes a trip plan and can be paid", async ({ page }) => {
  await page.goto("/trips/kerala-backwaters-munnar-6n");
  await page.getByRole("button", { name: "Reserve this price" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByLabel("Full name (as on passport)").fill("E2E Traveller");
  await page.getByLabel("Mobile").fill("+91 98765 43210");
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByRole("button", { name: "Review" }).click();
  await page.locator("label.agree input").check();
  await page.getByRole("button", { name: /Reserve now|Confirm new price/ }).click();
  await expect(page.getByText(/Your price is held for/)).toBeVisible();
  const ref = (await page.locator(".co-done .ref").innerText()).match(/RB-[A-Z0-9]+/)![0];

  // the hold is a trip plan with its date saved (live trip, wallet, reminders all work from it)
  const e = (await prisma.enquiry.findUnique({ where: { ref }, include: { mission: { include: { tasks: true } } } }))!;
  expect(e.missionId).toBeTruthy();
  expect(e.mission!.departureId).toBe(e.departureId);
  expect(e.mission!.tasks.find((t) => t.kind === "price_hold")?.status).toBe("done");

  // pay page: the deposit is due; we stop before Razorpay
  await page.getByRole("link", { name: /deposit & book now/ }).click();
  // a deposit, or the full amount when the trip leaves within 30 days
  await expect(page.getByText(/Pay the deposit to book|Pay in full to book/)).toBeVisible();
  await expect(page.getByRole("button", { name: /securely/ })).toBeVisible();

  // company GST details: a typo is caught, a real GSTIN is saved
  await page.getByRole("button", { name: /Booking for a company/ }).click();
  await page.getByLabel("GSTIN").fill("29AANCR5772Q1Z7");
  await page.getByLabel("Registered company name").fill("E2E Pvt Ltd");
  await page.getByRole("button", { name: "Save GST details" }).click();
  await expect(page.getByText(/check digit doesn't match/)).toBeVisible();
  await page.getByLabel("GSTIN").fill("27AAPFU0939F1ZV");
  await page.getByRole("button", { name: "Save GST details" }).click();
  await expect(page.getByText(/Saved. Your tax invoice will show/)).toBeVisible();
  expect((await prisma.enquiry.findUnique({ where: { ref } }))!.billingGstin).toBe("27AAPFU0939F1ZV");
});
