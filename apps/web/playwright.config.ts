import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const usesManagedDevServer = baseURL === "http://localhost:3000"

export default defineConfig({
  testDir: "./tests/e2e",
  // The visual matrix has its own config with fixture seeding and auth-state
  // setup. Keep it out of the default functional suite so `test:e2e` cannot
  // run those tests without their required global setup.
  testIgnore: "visual-matrix.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  reporter: "html",
  use: {
    baseURL,
    ignoreHTTPSErrors: process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS === "1",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: usesManagedDevServer
    ? {
        command: "pnpm dev",
        url: baseURL,
        reuseExistingServer: !process.env.CI,
      }
    : undefined,
})
