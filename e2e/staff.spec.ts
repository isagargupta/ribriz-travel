import { expect, test } from "@playwright/test";
import { BASE, TEST_EMAIL, prisma, token } from "./helpers";

// Test employees never take new clients, so real requests are never assigned to them.
const AGENT = "e2e-agent@example.com";
const key = (email: string) => Buffer.from(email).toString("base64url");

test.describe.serial("employee workspace", () => {
  let enquiryId = "";

  test.beforeAll(async () => {
    const agent = await prisma.staff.upsert({ where: { email: AGENT }, create: { email: AGENT, name: "E2E Agent", role: "agent", takesNew: false }, update: { active: true, role: "agent", takesNew: false } });
    const e = await prisma.enquiry.create({ data: { ref: "RB-E2E-STF1", type: "custom", name: "E2E Traveller", phone: "9999999999", email: TEST_EMAIL, message: "E2E: honeymoon in Bali, 6 nights", adults: 2, assigneeId: agent.id, assignedAt: new Date() } });
    await prisma.clientCard.upsert({ where: { email: TEST_EMAIL }, create: { email: TEST_EMAIL, managerId: agent.id }, update: { managerId: agent.id } });
    enquiryId = e.id;
  });

  const asAgent = (ctx: import("@playwright/test").BrowserContext) => ctx.addCookies([{ name: "ribriz_admin", value: token(key(AGENT)), url: BASE }]);

  test("an agent signs in to My desk and sees the client assigned to them", async ({ page, context }) => {
    await asAgent(context);
    await page.goto("/admin");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("E2E");
    await expect(page.getByText("RB-E2E-STF1").first()).toBeVisible();
    // their own clients list
    await page.goto("/admin/clients");
    await expect(page.getByRole("link", { name: /E2E Traveller/ })).toBeVisible();
  });

  test("agents can't open money, catalogue or team pages", async ({ page, context }) => {
    await asAgent(context);
    for (const path of ["/admin/invoices", "/admin/trips", "/admin/team", "/admin/overview"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\?denied=/);
    }
    await expect(page.getByText("Your role doesn't include")).toBeVisible();
  });

  test("client page: follow-up and note are saved to the client's history", async ({ page, context }) => {
    await asAgent(context);
    await page.goto(`/admin/clients/${key(TEST_EMAIL)}`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("E2E Traveller");
    await expect(page.getByText("RB-E2E-STF1").first()).toBeVisible();
    await page.getByPlaceholder(/Follow up with E2E about/).fill("Send Bali hotel options");
    await page.locator("#followup").getByRole("button", { name: "Add" }).click();
    await expect(page.locator("#followup").getByText("Send Bali hotel options")).toBeVisible();
    await page.getByPlaceholder(/Something the team should know/).fill("Prefers a private pool villa");
    await page.getByRole("button", { name: "Save note" }).click();
    await expect(page.locator(".dk-tl").getByText("Prefers a private pool villa")).toBeVisible();
    // the follow-up shows on their desk, and can be ticked off
    await page.goto("/admin");
    await expect(page.getByText("Send Bali hotel options")).toBeVisible();
    const fu = await prisma.followUp.findFirst({ where: { email: TEST_EMAIL, title: "Send Bali hotel options" } });
    expect(fu?.doneAt).toBeNull();
  });

  test("owner adds an employee and moves a request to them", async ({ page, context }) => {
    const { signIn } = await import("./helpers");
    await signIn(context, "admin");
    await page.goto("/admin/team");
    const add = page.locator(".dk-form").filter({ hasText: "Add an employee" });
    await add.getByLabel("Name").fill("E2E Second Agent");
    await add.getByLabel("Email").fill("e2e-agent2@example.com");
    await add.getByLabel("Gets new clients").uncheck();
    await add.getByRole("button", { name: "Add employee" }).click();
    await expect(add.getByText("Added.")).toBeVisible();
    const second = await prisma.staff.findUnique({ where: { email: "e2e-agent2@example.com" } });
    expect(second).toMatchObject({ role: "agent", takesNew: false, active: true });
    // reassign the test request from the requests page
    await page.goto("/admin/enquiries?q=RB-E2E-STF1");
    await page.getByLabel("Assign to").selectOption(second!.id);
    await page.getByRole("button", { name: "Assign" }).click();
    await expect(page.getByText("Handled by E2E Second Agent")).toBeVisible();
    expect((await prisma.enquiry.findUnique({ where: { id: enquiryId } }))?.assigneeId).toBe(second!.id);
  });
});
