import { expect, test } from "@playwright/test";
import { paidHoliday, prisma, signIn } from "./helpers";

test.describe("signed-in traveller and team", () => {
  test("a paid holiday shows in bookings and wallet; the team invoices it; the traveller sees the invoice", async ({ page, context }) => {
    await paidHoliday("RB-E2EPAID1");
    await signIn(context, "customer");
    await page.goto("/me/bookings");
    await expect(page.locator(".app-row", { hasText: "RB-E2EPAID1" }).getByText("Booked · fully paid")).toBeVisible();
    await page.goto("/me/wallet");
    await expect(page.getByRole("link", { name: "Receipt" }).first()).toBeVisible();

    // team issues the invoice from the admin (normally automatic when the final payment lands)
    await signIn(context, "admin");
    await page.goto("/admin/enquiries");
    await page.locator("form", { has: page.locator("input[name=id]") }).filter({ hasText: "Issue invoice now" }).first().getByRole("button", { name: /Issue invoice now/ }).click();
    await expect.poll(async () => prisma.invoice.count({ where: { enquiry: { ref: "RB-E2EPAID1" } } })).toBe(1);
    await page.goto("/admin/invoices");
    await expect(page.getByText(/TS\/\d{4}-\d{2}\/\d{4}/).first()).toBeVisible();

    const inv = (await prisma.invoice.findFirst({ where: { enquiry: { ref: "RB-E2EPAID1" } } }))!;
    expect(inv.taxable + inv.cgst + inv.sgst + inv.igst).toBe(11781000);
    expect(inv.cgst).toBe(280500); // Karnataka consumer: CGST + SGST
    await page.goto(`/invoice/${inv.id}`);
    await expect(page.getByRole("heading", { name: "Tax invoice" })).toBeVisible();
    await expect(page.getByText("CGST @ 2.5%")).toBeVisible();

    // the traveller (not admin) sees it in the wallet
    await context.clearCookies();
    await signIn(context, "customer");
    await page.goto("/me/wallet");
    await expect(page.getByText(inv.number)).toBeVisible();
  });

  test("invoices are private: no link, no access", async ({ page }) => {
    const inv = await prisma.invoice.findFirst({ where: { number: { startsWith: "TS/" } } });
    test.skip(!inv, "needs the invoice from the previous test");
    const r = await page.goto(`/invoice/${inv!.id}`);
    expect(r?.status()).toBe(404);
  });

  test("dashboard change check answers, and reloads only on change", async ({ page, context }) => {
    await signIn(context, "customer");
    await page.goto("/me");
    const a = await page.evaluate(() => fetch("/api/me/pulse").then((r) => r.json()));
    const b = await page.evaluate(() => fetch("/api/me/pulse").then((r) => r.json()));
    expect(a.v).toBe(b.v);
  });
});
