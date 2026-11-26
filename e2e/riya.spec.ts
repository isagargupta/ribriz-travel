import { expect, test } from "@playwright/test";

// Costs a real AI call, so it only runs with E2E_AI=1.
test.skip(process.env.E2E_AI !== "1", "set E2E_AI=1 to include Riya");

test("Riya answers in words and hands an unsold destination to the trip designers", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ask Riya, our travel assistant" }).click();
  await page.getByRole("textbox", { name: "Message" }).fill("E2E test: do you have a Singapore trip for 2 in February? Can you book it?");
  await page.keyboard.press("Enter");
  await expect(page.getByText(/Custom trip from our trip designers/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(/Singapore/).last()).toBeVisible();
});
