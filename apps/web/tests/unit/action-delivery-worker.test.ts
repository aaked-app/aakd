import { describe, expect, it, vi } from "vitest"
import { processActionDelivery } from "@/lib/actions/delivery-worker"

const job = {
  kind: "action_delivery" as const,
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

  it("does not relabel or retry a sent email when database reconciliation fails", async () => {
    const deps = dependencies()
    deps.db.contractActionDelivery.update.mockRejectedValueOnce(new Error("database unavailable"))

    await expect(processActionDelivery(job, deps)).rejects.toThrow("database unavailable")

    expect(deps.send).toHaveBeenCalledTimes(1)
    expect(deps.db.contractActionDelivery.update).toHaveBeenCalledTimes(1)
    expect(deps.db.activity.create).not.toHaveBeenCalled()
  })
})
