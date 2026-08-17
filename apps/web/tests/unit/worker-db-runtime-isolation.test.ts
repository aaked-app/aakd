import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db/client", () => {
  throw new Error("request-scoped Prisma client must not load in worker helpers")
})

describe("worker database runtime isolation", () => {
  it("uses an injected worker client for the alert check without loading the request client", async () => {
    const { checkAndFireAlerts } = await import("@/lib/alerts/check")
    const db = {
      contractAlert: { findMany: vi.fn().mockResolvedValue([]) },
    }

    await expect(checkAndFireAlerts(db as never)).resolves.toEqual({ fired: 0, errors: 0 })
  })

  it("uses an injected worker client for alert email lookup without loading the request client", async () => {
    const { sendAlertEmailById } = await import("@/lib/email")
    const db = {
      contractAlert: { findUnique: vi.fn().mockResolvedValue(null) },
    }

    await expect(sendAlertEmailById("missing-alert", db as never)).resolves.toBeUndefined()
  })
})
