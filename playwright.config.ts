import { defineConfig } from "@playwright/test";

/**
 * Browser tests for the main journeys, run against a production build of the
 * app on this computer (E2E=1: no emails or pushes are sent, test invoices use
 * a separate TS/ series). Uses your installed Chrome, no browser download.
 * Run: npm run e2e   (Riya's AI test too: E2E_AI=1 npm run e2e)
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  globalSetup: "./e2e/global-setup.ts",
  globalTeardown: "./e2e/global-teardown.ts",
  use: { baseURL: "http://localhost:3200", channel: "chrome", headless: true, trace: "retain-on-failure" },
  webServer: {
    command: "npx next start -p 3200",
    url: "http://localhost:3200",
    reuseExistingServer: false,
    timeout: 120_000,
    env: { E2E: "1" },
  },
});
