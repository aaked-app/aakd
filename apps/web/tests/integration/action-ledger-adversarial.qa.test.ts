import { beforeEach, describe, expect, it, vi } from "vitest"
import fc from "fast-check"
import { prisma } from "@/lib/db/client"
import { toActionListItem } from "@/lib/actions/dto"
import { enqueueNotification } from "@/lib/notifications/fanout"
import { emailQueue } from "@/lib/jobs/queues"
import { projectObligationAction } from "@/lib/actions/project"

const sessionCtx = {
  userId: "reviewer-1",
  organizationId: "org-1",
  role: "legal",
  source: "session" as const,
  requestId: "qa-request-1",
}

const actionRow = {
  id: "action-1",
  organizationId: "org-1",
  contractId: "contract-1",
  sourceObligationId: "obligation-1",
  sourceAlertId: null,
  sourceKey: "obligation:obligation-1",
  kind: "OBLIGATION",
  title: "Send report",
  description: null,
  condition: "Section 4",
  dueDate: null,
  noticeDate: null,
  assigneeId: "user-1",
  sourceText: "Provider shall send a report.",
  sourcePage: 3,
  confidence: 0.9,
  sourceHash: "private-hash",
  reviewStatus: "reviewed",
  status: "ACKNOWLEDGED",
  evidenceRequired: "completion_note",
  escalationState: null,
  acknowledgedAt: new Date("2026-08-18T00:00:00.000Z"),
  completedAt: null,
  completedById: null,
  staleAt: null,
  createdById: "user-1",
  version: 1,
  createdAt: new Date("2026-08-18T00:00:00.000Z"),
  updatedAt: new Date("2026-08-18T00:00:00.000Z"),
  contract: { id: "contract-1", title: "Northwind MSA", counterpartyName: "Northwind" },
  assignee: { id: "user-1", name: "Owner", email: "owner@example.test" },
  evidence: [],
  deliveries: [],
  activities: [],
}

vi.mock("@/lib/auth/middleware", () => ({
  resolveAuth: vi.fn().mockResolvedValue(sessionCtx),
  requireWriteScope: vi.fn(() => null),
}))

vi.mock("@/lib/db/activity", () => ({
  writeActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/notifications/fanout", () => ({
  enqueueNotification: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/notifications/write-in-app", () => ({
  writeInApp: vi.fn().mockResolvedValue(undefined),
}))

describe("Phase 1 action-ledger adversarial regressions", () => {
  beforeEach(() => vi.clearAllMocks())

  it("keeps action approvals isolated from contract lifecycle and generic fanout", async () => {
    vi.mocked(prisma.contract.findUnique).mockResolvedValue({
      id: "contract-1",
      organizationId: "org-1",
      status: "PENDING_APPROVAL",
      title: "Northwind MSA",
    } as never)
    vi.mocked(prisma.approval.findUnique).mockResolvedValue({
      id: "approval-action-1",
      contractId: "contract-1",
      actionId: "action-1",
      actionVersion: 2,
      assignedToId: "reviewer-1",
      status: "pending",
      required: true,
    } as never)
    vi.mocked(prisma.contractAction.updateMany).mockResolvedValue({ count: 1 })
    vi.mocked(prisma.activity.create).mockResolvedValue({ id: "activity-1" } as never)
    vi.mocked(prisma.approval.update).mockResolvedValue({
      id: "approval-action-1",
      contractId: "contract-1",
      actionId: "action-1",
      status: "approved",
      assignedTo: { id: "reviewer-1", name: "Reviewer", email: "reviewer@example.test", image: null },
      requestedBy: { id: "requester-1", name: "Requester", email: "requester@example.test", image: null },
    } as never)
    vi.mocked(prisma.approval.findFirst).mockResolvedValue(null)
    vi.mocked(prisma.approval.findMany).mockResolvedValue([])
    vi.mocked(prisma.approval.count).mockResolvedValue(1)
    vi.mocked(prisma.contract.update).mockResolvedValue({ id: "contract-1" } as never)

    const { PATCH } = await import("@/app/api/contracts/[id]/approvals/[approvalId]/route")
    const response = await PATCH(new Request(
      "http://localhost/api/contracts/contract-1/approvals/approval-action-1",
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision: "approved" }),
      },
    ), { params: { id: "contract-1", approvalId: "approval-action-1" } })

    expect(response.status).toBe(200)
    expect.soft(prisma.contract.update).not.toHaveBeenCalled()
    expect.soft(enqueueNotification).not.toHaveBeenCalled()
  })

  it("never returns member email addresses from minimized action-list DTOs", () => {
    fc.assert(fc.property(fc.emailAddress(), (email) => {
      const dto = toActionListItem({
        id: "action-1",
        contractId: "contract-1",
        kind: "OBLIGATION",
        title: "Send report",
        description: null,
        condition: "Section 4",
        dueDate: null,
        noticeDate: null,
        assigneeId: "user-1",
        sourcePage: 3,
        confidence: 0.9,
        reviewStatus: "reviewed",
        status: "PROPOSED",
        evidenceRequired: "completion_note",
        acknowledgedAt: null,
        completedAt: null,
        staleAt: null,
        version: 1,
        createdAt: new Date("2026-08-18T00:00:00.000Z"),
        updatedAt: new Date("2026-08-18T00:00:00.000Z"),
        contract: { id: "contract-1", title: "Northwind MSA", counterpartyName: "Northwind" },
        assignee: { id: "user-1", name: "Owner", email },
      })

      expect(JSON.stringify(dto)).not.toContain(email)
    }), { numRuns: 100 })
  })

  it("round-trips unicode and metacharacter action titles without exposing private source fields", () => {
    fc.assert(fc.property(fc.fullUnicodeString({ maxLength: 300 }), (title) => {
      const dto = toActionListItem({
        ...actionRow,
        title,
        assignee: { id: "user-1", name: "Owner" },
      })

      expect(dto.title).toBe(title)
      expect(dto).not.toHaveProperty("sourceHash")
      expect(dto).not.toHaveProperty("sourceKey")
      expect(dto).not.toHaveProperty("sourceText")
    }), { numRuns: 100 })
  })

  it("rejects empty and huge command bodies without reading or mutating an action", async () => {
    const { PATCH } = await import("@/app/api/actions/[id]/route")
    const empty = await PATCH(new Request("http://localhost/api/actions/action-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    }), { params: { id: "action-1" } })
    const huge = await PATCH(new Request("http://localhost/api/actions/action-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "block", expectedVersion: 1, reason: "x".repeat(10 * 1024 * 1024) }),
    }), { params: { id: "action-1" } })

    expect(empty.status).toBe(422)
    expect(huge.status).toBe(422)
    expect(prisma.contractAction.findFirst).not.toHaveBeenCalled()
    expect(prisma.contractAction.updateMany).not.toHaveBeenCalled()
  })

  it("rejects expectedVersion values outside the database integer range", async () => {
    const { PATCH } = await import("@/app/api/actions/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/actions/action-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "start", expectedVersion: Number.MAX_SAFE_INTEGER }),
    }), { params: { id: "action-1" } })

    expect(response.status).toBe(422)
    expect(prisma.contractAction.findFirst).not.toHaveBeenCalled()
  })

  it("deduplicates a concurrent direct-email insert instead of throwing a unique-constraint 500", async () => {
    vi.mocked(prisma.contractAction.findFirst).mockResolvedValue(actionRow as never)
    vi.mocked(prisma.member.findFirst).mockResolvedValue({
      userId: "user-1",
      user: { id: "user-1", name: "Owner", email: "owner@example.test" },
    } as never)
    vi.mocked(prisma.contractActionDelivery.findUnique)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "delivery-existing", actionId: "action-1", channel: "email", status: "queued" } as never)
    vi.mocked(prisma.contractActionDelivery.create).mockRejectedValueOnce({ code: "P2002" })

    const { POST } = await import("@/app/api/actions/[id]/deliver/route")
    const response = await POST(new Request("http://localhost/api/actions/action-1/deliver", { method: "POST" }), {
      params: { id: "action-1" },
    })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(expect.objectContaining({ deduplicated: true }))
    expect(emailQueue.add).not.toHaveBeenCalled()
  })

  it("blocks completion and delivery while a required action approval is pending", async () => {
    vi.mocked(prisma.contractAction.findFirst).mockResolvedValueOnce({
      ...actionRow,
      status: "IN_PROGRESS",
      evidence: [{ kind: "completion_note" }],
      approvals: [{ required: true, status: "pending" }],
    } as never)

    const { PATCH } = await import("@/app/api/actions/[id]/route")
    const completion = await PATCH(new Request("http://localhost/api/actions/action-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "complete", expectedVersion: 1 }),
    }), { params: { id: "action-1" } })

    vi.mocked(prisma.contractAction.findFirst).mockResolvedValueOnce({
      ...actionRow,
      approvals: [{ required: true, status: "pending" }],
    } as never)
    const { POST } = await import("@/app/api/actions/[id]/deliver/route")
    const delivery = await POST(new Request("http://localhost/api/actions/action-1/deliver", { method: "POST" }), {
      params: { id: "action-1" },
    })

    expect(completion.status).toBe(409)
    expect(await completion.json()).toEqual({ error: "action_approval_pending" })
    expect(delivery.status).toBe(409)
    expect(await delivery.json()).toEqual({ error: "action_approval_pending" })
    expect(prisma.contractAction.updateMany).not.toHaveBeenCalled()
    expect(emailQueue.add).not.toHaveBeenCalled()
  })

  it("clears obsolete source-derived fields instead of retaining stale private data", async () => {
    vi.mocked(prisma.contractAction.findUnique).mockResolvedValueOnce({
      sourceHash: "sha256:old",
      status: "ACKNOWLEDGED",
    } as never)
    vi.mocked(prisma.contractAction.upsert).mockResolvedValueOnce({ id: "action-1" } as never)

    await projectObligationAction({
      id: "obligation-1",
      contractId: "contract-1",
      organizationId: "org-1",
      title: "Corrected action",
      dueDate: new Date("2026-09-01T00:00:00.000Z"),
      description: null,
      clauseReference: null,
      assigneeId: null,
      sourceHash: null,
      sourceText: null,
      sourcePage: null,
      confidence: null,
    })

    expect(prisma.contractAction.upsert).toHaveBeenCalledWith(expect.objectContaining({
      update: expect.objectContaining({
        description: null,
        condition: null,
        assigneeId: null,
        sourceHash: null,
        sourceText: null,
        sourcePage: null,
        confidence: null,
        status: "STALE",
      }),
    }))
  })

  it("rolls back MCP obligation creation when its required action projection fails", async () => {
    let obligationPersisted = false
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "contract-1",
      organizationId: "org-1",
      status: "ACTIVE",
    } as never)
    vi.mocked(prisma.contractObligation.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.contractObligation.create).mockImplementationOnce((async () => {
      obligationPersisted = true
      return {
        id: "obligation-new",
        contractId: "contract-1",
        organizationId: "org-1",
        title: "Send report",
        description: null,
        clauseReference: null,
        dueDate: new Date("2026-09-01T00:00:00.000Z"),
        assigneeId: null,
        createdById: "reviewer-1",
        status: "PENDING",
        priority: "MEDIUM",
        assignee: null,
        subTasks: [],
      } as never
    }) as never)
    vi.mocked(prisma.contractAction.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.contractAction.upsert).mockRejectedValueOnce(new Error("projection failed"))
    vi.mocked(prisma.$transaction).mockImplementationOnce(async (callback: unknown) => {
      const before = obligationPersisted
      try {
        return await (callback as (tx: typeof prisma) => Promise<unknown>)(prisma)
      } catch (error) {
        obligationPersisted = before
        throw error
      }
    })

    const { POST } = await import("@/app/api/mcp/route")
    const call = POST(new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "create_obligation",
          arguments: {
            contractId: "contract-1",
            title: "Send report",
            dueDate: "2026-09-01T00:00:00.000Z",
          },
        },
      }),
    }))

    await expect(call).rejects.toThrow("projection failed")
    expect(obligationPersisted).toBe(false)
  })

  it("rejects invalid REST and MCP action filters before querying Prisma", async () => {
    const { GET } = await import("@/app/api/actions/route")
    const rest = await GET(new Request("http://localhost/api/actions?kind=not-an-enum&page=999999999999999999"))

    const { POST } = await import("@/app/api/mcp/route")
    const mcp = await POST(new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "list_actions", arguments: { page: Number.MAX_SAFE_INTEGER } },
      }),
    }))

    expect(rest.status).toBe(422)
    expect((await mcp.json()).result.isError).toBe(true)
    expect(prisma.contractAction.findMany).not.toHaveBeenCalled()
  })
})
