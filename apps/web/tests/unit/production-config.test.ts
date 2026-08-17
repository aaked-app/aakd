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

  it.each(["0", "-1", "NaN", "999999999999"])(
    "rejects unsafe DATABASE_POOL_SIZE value %s",
    (poolSize) => {
      vi.stubEnv("NODE_ENV", "production")
      vi.stubEnv("NEXT_PHASE", "phase-production-server")
      vi.stubEnv("BETTER_AUTH_SECRET", "a".repeat(32))
      vi.stubEnv("BETTER_AUTH_URL", "https://app.example.com")
      vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://app.example.com")
      vi.stubEnv("DATABASE_URL", "postgresql://postgres:password@db:5432/clauseflow")
      vi.stubEnv("REDIS_URL", "redis://:password@redis:6379")
      vi.stubEnv("STORAGE_ENDPOINT", "http://minio:9000")
      vi.stubEnv("STORAGE_ACCESS_KEY", "storage-access-key")
      vi.stubEnv("STORAGE_SECRET_KEY", "storage-secret-key")
      vi.stubEnv("STORAGE_BUCKET", "clauseflow")
      vi.stubEnv("NOTIFICATION_ENCRYPTION_KEY", "a".repeat(64))
      vi.stubEnv("DATABASE_POOL_SIZE", poolSize)

      expect(() => assertProductionConfig()).toThrow(/DATABASE_POOL_SIZE/)
      vi.unstubAllEnvs()
    },
  )
})
