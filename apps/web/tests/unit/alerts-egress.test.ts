import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PrismaClient } from "@prisma/client"
import { checkAndFireAlerts } from "@/lib/alerts/check"
import { sendSlackAlert, sendTeamsAlert } from "@/lib/notifications/webhooks"
import { emailQueue } from "@/lib/jobs/queues"

vi.mock("@/lib/notifications/webhooks", () => ({ sendSlackAlert: vi.fn(), sendTeamsAlert: vi.fn() }))
vi.mock("@/lib/db/activity", () => ({ writeActivity: vi.fn() }))
vi.mock("@/lib/notifications/write-in-app", () => ({ writeInAppToOrgMembers: vi.fn() }))
vi.mock("@/lib/notifications/fanout", () => ({ enqueueNotification: vi.fn() }))

function client() {
  return {
    contractAlert: {
      findMany: vi.fn().mockResolvedValue([{
        id: "alert-a", contractId: "contract-a", alertType: "RENEWAL_DUE",
        contract: { id: "contract-a", organizationId: "org-a", title: "Private agreement", endDate: new Date(), organization: { id: "org-a" } },
      }]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
  }
}

describe("contract alert egress boundaries", () => {
  beforeEach(() => { vi.clearAllMocks(); vi.stubEnv("AGREEMENT_ACCESS_EMERGENCY_DENY_ALL", "false") })
  afterEach(() => vi.unstubAllEnvs())

  it("keeps authorized notification processing without sending tenant metadata to global connectors", async () => {
    vi.stubEnv("SLACK_WEBHOOK_URL", "https://hooks.slack.com/services/test")
    vi.stubEnv("TEAMS_WEBHOOK_URL", "https://example.webhook.office.com/test")
    const db = client()
    await expect(checkAndFireAlerts(db as unknown as PrismaClient)).resolves.toEqual({ fired: 1, errors: 0 })
    expect(emailQueue.add).toHaveBeenCalledWith("send", { kind: "alert", alertId: "alert-a" })
    expect(sendSlackAlert).not.toHaveBeenCalled()
    expect(sendTeamsAlert).not.toHaveBeenCalled()
  })

  it("does not query or claim agreements while emergency containment is active", async () => {
    vi.stubEnv("AGREEMENT_ACCESS_EMERGENCY_DENY_ALL", "true")
    const db = client()
    await expect(checkAndFireAlerts(db as unknown as PrismaClient)).resolves.toEqual({ fired: 0, errors: 0 })
    expect(db.contractAlert.findMany).not.toHaveBeenCalled()
    expect(db.contractAlert.updateMany).not.toHaveBeenCalled()
    expect(emailQueue.add).not.toHaveBeenCalled()
  })

  it("checks containment again after the due-alert query", async () => {
    const db = client()
    const rows = await db.contractAlert.findMany()
    db.contractAlert.findMany.mockImplementationOnce(async () => {
      process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = "true"
      return rows
    })
    await expect(checkAndFireAlerts(db as unknown as PrismaClient)).resolves.toEqual({ fired: 0, errors: 0 })
    expect(db.contractAlert.updateMany).not.toHaveBeenCalled()
    expect(emailQueue.add).not.toHaveBeenCalled()
  })
})
