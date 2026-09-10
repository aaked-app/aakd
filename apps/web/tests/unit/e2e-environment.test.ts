import { afterEach, describe, expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { loadRootComposeEnv } from "../e2e/root-env"

vi.mock("node:fs", async (importOriginal) => ({ ...await importOriginal<typeof import("node:fs")>(), readFileSync: vi.fn() }))
vi.mock("@next/env", () => ({ loadEnvConfig: vi.fn() }))

afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks() })

describe("disposable browser fixture database selection", () => {
  it("never replaces explicitly supplied test credentials with a local .env", () => {
    vi.stubEnv("AAKD_E2E_USE_PROCESS_ENV", "1")
    vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost:5432/disposable")
    loadRootComposeEnv()
    expect(readFileSync).not.toHaveBeenCalled()
    expect(process.env.DATABASE_URL).toBe("postgresql://test:test@localhost:5432/disposable")
  })

  it("fails closed if the explicit test database is missing", () => {
    vi.stubEnv("AAKD_E2E_USE_PROCESS_ENV", "1")
    vi.stubEnv("DATABASE_URL", "")
    expect(loadRootComposeEnv).toThrow("requires DATABASE_URL")
    expect(readFileSync).not.toHaveBeenCalled()
  })
})
