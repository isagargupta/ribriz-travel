import { expect, test } from "@playwright/test";
import { BASE, paidHoliday, prisma, signIn, state } from "./helpers";

test.describe("funnel", () => {
  // the server ignores bots, including "HeadlessChrome", so look like a normal browser here
  test.use({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36" });
  test("funnel: trip views are counted anonymously and the admin funnel shows them", async ({ page, context }) => {
    await context.addInitScript(() => { (window as unknown as { __rbTrackTests: boolean }).__rbTrackTests = true; sessionStorage.setItem("rb-sid", "e2e-" + Math.random().toString(36).slice(2)); });
    await page.goto("/trips/bali-ubud-seminyak-7n");
    await expect.poll(async () => prisma.event.count({ where: { sid: { startsWith: "e2e-" }, type: "trip_view" } })).toBeGreaterThan(0);
    const ev = await prisma.event.findFirst({ where: { sid: { startsWith: "e2e-" } } });
    expect(ev?.source).toBe("direct");
    await signIn(context, "admin");
    await page.goto("/admin/funnel?days=7");
    await expect(page.getByRole("heading", { name: "Sales funnel" })).toBeVisible();
    await expect(page.getByText("Looked at a trip")).toBeVisible();
  });
});

test.describe("growth and operations features", () => {

  test("destination guide: best time from weather history, visa and trips", async ({ page }) => {
    await page.goto("/destinations");
    await page.getByRole("link", { name: /Bali/ }).first().click();
    await expect(page.getByRole("heading", { name: "Bali from India" })).toBeVisible();
    await expect(page.getByRole("heading", { name: /When to go to Bali/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Visa for Indian passport holders" })).toBeVisible();
    await expect(page.locator(".dest-visa li").first()).toBeVisible();
    const ld = await page.locator('script[type="application/ld+json"]').allTextContents();
    expect(ld.join(" ")).toContain("FAQPage");
  });

  test("team: copy a trip, add a season of Fridays, add a festival surcharge", async ({ page, context }) => {
    await signIn(context, "admin");
    const src = (await prisma.trip.findUnique({ where: { slug: "north-goa-beach-4n" } })) ?? (await prisma.trip.findFirst({ where: { published: true } }))!;
    await page.goto(`/admin/trips/${src.id}`);
    await page.getByRole("button", { name: "Copy trip" }).click();
    await expect(page).not.toHaveURL(new RegExp(src.id));
    const copyId = page.url().split("/").pop()!.split("?")[0];
    const copy = (await prisma.trip.findUnique({ where: { id: copyId } }))!;
    expect(copy.published).toBe(false);
    expect(copy.title).toContain("(copy)");

    const season = page.locator("form.dep-season").first();
    await season.locator("input[name=from]").fill("2027-06-01");
    await season.locator("input[name=to]").fill("2027-06-30");
    await season.locator("label", { hasText: "Fri" }).locator("input").check();
    await season.locator("input[name=delta]").fill("1000");
    await season.getByRole("button", { name: "Add season" }).click();
    await expect.poll(async () => prisma.departure.count({ where: { tripId: copyId } })).toBe(4);

    const bulk = page.locator("form.dep-season").nth(1);
    await bulk.locator("input[name=from]").fill("2027-06-10");
    await bulk.locator("input[name=to]").fill("2027-06-30");
    await bulk.locator("select[name=action]").selectOption("add_delta");
    await bulk.locator("input[name=value]").fill("5000");
    await bulk.getByRole("button", { name: "Apply" }).click();
    await expect.poll(async () => (await prisma.departure.findMany({ where: { tripId: copyId }, orderBy: { date: "asc" } })).map((d) => d.priceDelta).join(",")).toBe("1000,6000,6000,6000");
    await expect(page.getByText("Price calendar")).toBeVisible();
  });

  test("group trip: invite a companion who joins, then a share is paid; GST receipt voucher, then the invoice", async ({ page, context }) => {
    const s = state();
    const e = await paidHoliday("RB-E2EGRP1");
    await prisma.payment.deleteMany({ where: { enquiryId: e.id } }); // start unpaid
    const m = await prisma.mission.create({ data: { customerId: s.customerId, title: "E2E group trip", goal: "E2E test", status: "active", adults: 2, tripId: e.tripId, tasks: { create: [{ kind: "choose_trip", title: "Choose trip", status: "done", order: 0 }, { kind: "price_hold", title: "Hold the price", status: "done", order: 1 }] } } });
    await prisma.enquiry.update({ where: { id: e.id }, data: { missionId: m.id, status: "new" } });

    // the planner copies the invite link from the trip page
    await signIn(context, "customer");
    await page.goto(`/me/trips/${m.id}`);
    await expect(page.getByRole("heading", { name: "Travelling together" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Invite travel companions" })).toBeVisible();

    // the friend opens the invite, joins, and sees the trip in their own app
    const { createHmac } = await import("node:crypto");
    const { env } = await import("./helpers");
    const t = createHmac("sha256", env().SESSION_SECRET).update(`join:${m.id}`).digest("base64url").slice(0, 24);
    await context.clearCookies();
    await signIn(context, "friend");
    await page.goto(`/join/${m.id}?t=${t}`);
    await page.getByLabel(/Your name as on your passport/).fill("E2E Friend");
    await page.getByRole("button", { name: "Join the trip" }).click();
    await expect(page).toHaveURL(new RegExp(`/me/trips/${m.id}`));
    await expect(page.getByText("E2E Friend").first()).toBeVisible();
    expect(await prisma.missionMember.count({ where: { missionId: m.id, customerId: s.friendId } })).toBe(1);

    // pay page offers a share; settle one share as if Razorpay confirmed it → receipt voucher
    await page.getByRole("link", { name: "Pay a share" }).click();
    await expect(page.getByText("Splitting the cost?")).toBeVisible();
    const p1 = await prisma.payment.create({ data: { enquiryId: e.id, kind: "share", amount: 58905, orderId: "order_E2E_share1", payerName: "E2E Friend" } });
    await page.request.post(`${BASE}/api/e2e/settle`, { data: { paymentRowId: p1.id } });
    const rv = await prisma.invoice.findFirst({ where: { enquiryId: e.id, kind: "receipt_voucher" } });
    expect(rv?.number).toMatch(/^TV\//);
    expect(rv!.total).toBe(5890500);

    // the second share completes the trip → the tax invoice, listing the advance it adjusts
    const p2 = await prisma.payment.create({ data: { enquiryId: e.id, kind: "share", amount: 58905, orderId: "order_E2E_share2", payerName: "E2E Traveller" } });
    await page.request.post(`${BASE}/api/e2e/settle`, { data: { paymentRowId: p2.id } });
    const inv = (await prisma.invoice.findFirst({ where: { enquiryId: e.id, kind: "invoice" } }))!;
    expect(inv.total).toBe(11781000);
    await context.clearCookies();
    await signIn(context, "admin");
    await page.goto(`/invoice/${inv.id}`);
    await expect(page.getByText(/Advances already received/)).toBeVisible();
    await expect(page.getByText(rv!.number)).toBeVisible();
  });

  test("team: system health page runs its checks", async ({ page, context }) => {
    await signIn(context, "admin");
    await page.goto("/admin/health");
    await expect(page.getByRole("heading", { name: "System health" })).toBeVisible();
    await expect(page.getByRole("row", { name: /Database/ })).toContainText("✅");
    const r = await page.request.get(`${BASE}/api/health`);
    expect(r.status()).toBe(200);
  });
});
