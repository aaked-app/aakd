import { afterEach, describe, expect, it, vi } from "vitest"

// This unit test checks our configuration, not Playwright's loader. The actual
// browser gate imports the real runtime; loading it here competes with build
// workers and can exhaust the unit-test deadline before any assertion runs.
vi.mock("@playwright/test", () => ({
  defineConfig: (config: unknown) => config,
  devices: { "Desktop Chrome": {} },
}))

const originalBaseUrl = process.env.PLAYWRIGHT_BASE_URL

afterEach(() => {
  if (originalBaseUrl === undefined) delete process.env.PLAYWRIGHT_BASE_URL
  else process.env.PLAYWRIGHT_BASE_URL = originalBaseUrl
  vi.resetModules()
})

describe("Playwright auth rate-limit identity", () => {
  it("uses one valid documentation address for the entire local run without retries", async () => {
    process.env.PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3000"
    vi.resetModules()

    const { default: config } = await import("../../playwright.config")
    const clientIp = config.use?.extraHTTPHeaders?.["X-Forwarded-For"]

    expect(config.retries).toBe(0)
    expect(config.workers).toBe(1)
    expect(config.use?.trace).toBe("retain-on-failure")
    expect(clientIp).toMatch(/^2001:db8:(?:[0-9a-f]{4}:){5}[0-9a-f]{4}$/)
    expect(() => new URL(`http://[${clientIp}]/`)).not.toThrow()
  })

  it("never injects a synthetic client address into a remote target", async () => {
    process.env.PLAYWRIGHT_BASE_URL = "https://staging.invalid"
    vi.resetModules()

    const { default: config } = await import("../../playwright.config")

    expect(config.use?.extraHTTPHeaders).toBeUndefined()
  })
})
