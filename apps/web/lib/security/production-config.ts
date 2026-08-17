const REQUIRED_PRODUCTION_ENV = [
  "BETTER_AUTH_SECRET",
  "BETTER_AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
  "DATABASE_URL",
  "REDIS_URL",
  "STORAGE_ENDPOINT",
  "STORAGE_ACCESS_KEY",
  "STORAGE_SECRET_KEY",
  "STORAGE_BUCKET",
  "NOTIFICATION_ENCRYPTION_KEY",
] as const

const MAX_DATABASE_POOL_SIZE = 50

export function getDatabasePoolSize(value = process.env.DATABASE_POOL_SIZE): number {
  if (value === undefined || value === "") return 20
  if (!/^[1-9]\d*$/.test(value)) {
    throw new Error("DATABASE_POOL_SIZE must be a whole number between 1 and 50")
  }

  const poolSize = Number(value)
  if (poolSize > MAX_DATABASE_POOL_SIZE) {
    throw new Error("DATABASE_POOL_SIZE must be a whole number between 1 and 50")
  }

  return poolSize
}

/**
 * Fail fast on an unsafe production process instead of starting a partially
 * configured tenant-bearing service. Build-time execution is explicitly
 * excluded because Next evaluates instrumentation while compiling.
 */
export function assertProductionConfig(): void {
  if (process.env.NODE_ENV !== "production" || process.env.NEXT_PHASE === "phase-production-build") return

  const missing = REQUIRED_PRODUCTION_ENV.filter((name) => !process.env[name]?.trim())
  const shortSecrets = ["BETTER_AUTH_SECRET", "NOTIFICATION_ENCRYPTION_KEY"].filter(
    (name) => (process.env[name]?.length ?? 0) < 32,
  )
  const insecureUrls = ["BETTER_AUTH_URL", "NEXT_PUBLIC_APP_URL"].filter((name) => {
    try {
      return new URL(process.env[name] ?? "").protocol !== "https:"
    } catch {
      return true
    }
  })

  if (missing.length || shortSecrets.length || insecureUrls.length) {
    const details = [
      missing.length ? `missing: ${missing.join(", ")}` : "",
      shortSecrets.length ? `short secrets: ${shortSecrets.join(", ")}` : "",
      insecureUrls.length ? `HTTPS required: ${insecureUrls.join(", ")}` : "",
    ].filter(Boolean).join("; ")
    throw new Error(`Unsafe production configuration: ${details}`)
  }

  getDatabasePoolSize()
}
