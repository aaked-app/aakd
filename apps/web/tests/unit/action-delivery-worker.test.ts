import { describe, expect, it, vi } from "vitest"
import { processActionDelivery } from "@/lib/actions/delivery-worker"

const job = {
  kind: "action_delivery" as const,
  contractId: "contract-1",
  recipientUserId: "user-owner",
  deliveryId: "delivery-1",
  to: "owner@example.com",
  recipientName: "Owner",
  actionId: "action-1",
  actionTitle: "Send report",
  actionUrl: "/actions/action-1",
  contractTitle: "Northwind MSA",
  dueDate: null,
  sourceText: "Provider shall send a report.",
  sourcePage: 3,
}

function dependencies() {
  return {
    send: vi.fn().mockResolvedValue(undefined),
    db: {
      contractAccessGrant: { findFirst: vi.fn().mockResolvedValue({ id: "grant-1" }) },
      contractActionDelivery: {
        update: vi.fn().mockResolvedValue({
          actionId: "action-1",
          action: { contractId: "contract-1", title: "Send report" },
        }),
      },
      activity: { create: vi.fn().mockResolvedValue({ id: "activity-1" }) },
    },
  }
}

describe("action email delivery worker", () => {
  it("does not query or deliver while emergency deny-all is active", async () => {
    const original = process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL
    process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = "true"
    const deps = dependencies()
    try {
      await processActionDelivery(job, deps)
      expect(deps.db.contractAccessGrant.findFirst).not.toHaveBeenCalled()
      expect(deps.db.contractActionDelivery.update).not.toHaveBeenCalled()
      expect(deps.send).not.toHaveBeenCalled()
    } finally {
      if (original === undefined) delete process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL
      else process.env.AGREEMENT_ACCESS_EMERGENCY_DENY_ALL = original
    }
  })

  it("marks the durable delivery delivered only after SMTP succeeds", async () => {
    const deps = dependencies()

    await processActionDelivery(job, deps)

    expect(deps.send).toHaveBeenCalledWith(job)
    expect(deps.db.contractActionDelivery.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "delivery-1" },
      data: expect.objectContaining({ status: "delivered", deliveredAt: expect.any(Date), errorCode: null }),
    }))
    expect(deps.db.activity.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      action: "ACTION_DELIVERED",
      contractActionId: "action-1",
    }) })
  })

  it("records failure and never writes delivered activity when SMTP fails", async () => {
    const deps = dependencies()
    deps.send.mockRejectedValueOnce(new Error("smtp failure"))

    await expect(processActionDelivery(job, deps)).rejects.toThrow("smtp failure")

    expect(deps.db.contractActionDelivery.update).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      data: { status: "failed", errorCode: "email_delivery_failed" },
    })
    expect(deps.db.activity.create).not.toHaveBeenCalled()
  })

  it("does not send when the recipient grant was revoked after enqueue", async () => {
    const deps = dependencies()
    deps.db.contractAccessGrant.findFirst.mockResolvedValueOnce(null)

    await processActionDelivery(job, deps)

    expect(deps.send).not.toHaveBeenCalled()
    expect(deps.db.contractActionDelivery.update).toHaveBeenCalledWith({
      where: { id: "delivery-1" },
      data: { status: "failed", errorCode: "recipient_access_revoked" },
    })
    expect(deps.db.activity.create).not.toHaveBeenCalled()
  })

  it("does not relabel or retry a sent email when database reconciliation fails", async () => {
    const deps = dependencies()
    deps.db.contractActionDelivery.update.mockRejectedValueOnce(new Error("database unavailable"))

    await expect(processActionDelivery(job, deps)).rejects.toThrow("database unavailable")

    expect(deps.send).toHaveBeenCalledTimes(1)
    expect(deps.db.contractActionDelivery.update).toHaveBeenCalledTimes(1)
    expect(deps.db.activity.create).not.toHaveBeenCalled()
  })
})
