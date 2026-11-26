import { expect, test } from "@playwright/test";
import { prisma } from "./helpers";

test.describe("public site", () => {
  test("home page loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /Ask Riya/ }).first()).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("search finds a city on an itinerary, and offers Riya when nothing matches", async ({ page }) => {
    await page.goto("/trips?q=Paris");
    await expect(page.locator("a[href^='/trips/switzerland-france-italy']").first()).toBeVisible();
    await page.goto("/trips?q=Singapore");
    await expect(page.getByText("We don't have a Singapore package yet").first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Ask Riya to plan it/ }).first()).toBeVisible();
  });

  test("a trip link with ?date= picks that departure", async ({ page }) => {
    const trip = (await prisma.trip.findUnique({ where: { slug: "bali-ubud-seminyak-7n" } }))!;
    const deps = await prisma.departure.findMany({ where: { tripId: trip.id, status: "open", date: { gte: new Date().toISOString().slice(0, 10) } }, orderBy: { date: "asc" }, take: 3 });
    const want = deps[2].date;
    await page.goto(`/trips/${trip.slug}?date=${want}`);
    const day = String(Number(want.slice(8)));
    await expect(page.locator("#dates [aria-pressed=true], #dates .on, #dates .sel").first()).toContainText(day);
  });
});
