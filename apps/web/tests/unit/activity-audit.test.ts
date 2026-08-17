import { beforeEach, describe, expect, it, vi } from "vitest"

const { createActivity } = vi.hoisted(() => ({
  createActivity: vi.fn().mockResolvedValue({ id: "activity-1" }),
}))

vi.mock("@/lib/db/client", () => ({
  prisma: { activity: { create: createActivity } },
}))

import { requestContext } from "@/lib/context"
import { writeActivity } from "@/lib/db/activity"

describe("writeActivity request attribution", () => {
  beforeEach(() => createActivity.mockClear())

  it("records the request source and request ID for agent/API actions", async () => {
    await requestContext.run(
      {
        userId: "user-1",
        organizationId: "org-1",
        role: "admin",
        source: "api_key",
        requestId: "req-mcp-1",
      },
      () => writeActivity("contract-1", "user-1", "UPDATED", "Updated via agent"),
    )

    expect(createActivity).toHaveBeenCalledWith({
      data: expect.objectContaining({
        contractId: "contract-1",
        action: "UPDATED",
        metadata: {
          requestSource: "api_key",
          requestId: "req-mcp-1",
        },
      }),
    })
  })

  it("preserves caller metadata while adding request attribution", async () => {
    await requestContext.run(
      {
        userId: "user-1",
        organizationId: "org-1",
        role: "admin",
        source: "session",
        requestId: "req-ui-1",
      },
      () => writeActivity("contract-1", "user-1", "UPDATED", undefined, { reason: "review" }),
    )

    expect(createActivity.mock.calls[0]?.[0].data.metadata).toEqual({
      reason: "review",
      requestSource: "session",
      requestId: "req-ui-1",
    })
  })

  it("writes through the supplied transaction client", async () => {
    const transactionCreate = vi.fn().mockResolvedValue({ id: "activity-tx" })
    const transactionClient = { activity: { create: transactionCreate } }

    await writeActivity(
      "contract-1",
      "user-1",
      "OBLIGATION_UPDATED",
      "Sub-task updated",
      { obligationId: "obl-1" },
      transactionClient as Parameters<typeof writeActivity>[5],
    )

    expect(transactionCreate).toHaveBeenCalledOnce()
    expect(createActivity).not.toHaveBeenCalled()
  })
})
