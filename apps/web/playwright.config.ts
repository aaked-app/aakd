import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const usesManagedDevServer = baseURL === "http://localhost:3000"

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  timeout: 30_000,
  reporter: "html",
  use: {
    baseURL,
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
