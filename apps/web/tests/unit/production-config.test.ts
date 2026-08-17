import { describe, expect, it, vi } from "vitest"
import { assertProductionConfig } from "@/lib/security/production-config"

describe("production configuration", () => {
  it("does not validate non-production processes", () => {
    vi.stubEnv("NODE_ENV", "test")
    expect(() => assertProductionConfig()).not.toThrow()
    vi.unstubAllEnvs()
  })

  it("rejects missing and insecure production configuration", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PHASE", "phase-production-server")
    expect(() => assertProductionConfig()).toThrow(/Unsafe production configuration/)
    vi.unstubAllEnvs()
  })
})
