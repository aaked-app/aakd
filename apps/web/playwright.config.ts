import { randomBytes } from "node:crypto"
import { defineConfig, devices } from "@playwright/test"

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
const usesManagedDevServer = baseURL === "http://localhost:3000"
const baseHostname = new URL(baseURL).hostname
const usesLocalTarget = ["localhost", "127.0.0.1", "[::1]"].includes(baseHostname)

// A real reverse proxy supplies the client address. Direct localhost requests do
// not, which collapses repeated E2E runs into the shared `unknown` auth bucket.
// Give one whole local test run a valid RFC 3849 documentation address so the
// production 30/min shared-IP limit remains active without inheriting old runs.
const localAuthClientIp = usesLocalTarget
  ? `2001:db8:${Array.from({ length: 6 }, () => randomBytes(2).toString("hex")).join(":")}`
  : undefined

export default defineConfig({
  testDir: "./tests/e2e",
  // Keep functional cleanup away from the visual matrix and its auth files.
  outputDir: "test-results/functional",
  // The visual matrix has its own config with fixture seeding and auth-state
  // setup. Keep it out of the default functional suite so `test:e2e` cannot
  // run those tests without their required global setup.
  testIgnore: "visual-matrix.spec.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Auth failures must surface once; an immediate retry consumes the same
  // protected bucket and can turn rate-limit behavior into a misleading flake.
  retries: 0,
  workers: 1,
  timeout: 30_000,
  reporter: "html",
  use: {
    baseURL,
    extraHTTPHeaders: localAuthClientIp
      ? { "X-Forwarded-For": localAuthClientIp }
      : undefined,
    ignoreHTTPSErrors: process.env.PLAYWRIGHT_IGNORE_HTTPS_ERRORS === "1",
    trace: "retain-on-failure",
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
