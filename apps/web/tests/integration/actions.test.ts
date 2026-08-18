import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db/client"
import { emailQueue } from "@/lib/jobs/queues"

vi.mock("@/lib/auth/middleware", () => ({
  resolveAuth: vi.fn(),
  requireWriteScope: vi.fn(() => null),
}))

vi.mock("@/lib/context", () => ({
  requestContext: { run: vi.fn((_ctx, fn) => fn()) },
}))

import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"

const sessionCtx = {
  userId: "user-1",
  organizationId: "org-1",
  role: "member",
  source: "session" as const,
  requestId: "request-1",
}

const apiKeyCtx = {
  ...sessionCtx,
  source: "api_key" as const,
  scopes: ["read", "write"],
}

const viewerCtx = {
  ...sessionCtx,
  role: "viewer",
}

const baseAction = {
  id: "action-1",
  organizationId: "org-1",
  contractId: "contract-1",
  sourceObligationId: "obligation-1",
  sourceAlertId: null,
  sourceKey: "obligation:obligation-1",
  kind: "OBLIGATION",
  title: "Send the usage report",
  description: "Send the monthly report",
  condition: "Section 4",
  dueDate: new Date("2026-09-01T00:00:00.000Z"),
  noticeDate: null,
  assigneeId: "user-1",
  sourceText: "Provider shall send a monthly usage report.",
  sourcePage: 3,
  confidence: 0.92,
  sourceHash: "private-source-hash",
  reviewStatus: "pending",
  status: "PENDING_REVIEW",
  evidenceRequired: "completion_note",
  escalationState: null,
  acknowledgedAt: null,
  completedAt: null,
  completedById: null,
  staleAt: null,
  createdById: "user-1",
  version: 1,
  createdAt: new Date("2026-08-18T10:00:00.000Z"),
  updatedAt: new Date("2026-08-18T10:00:00.000Z"),
  contract: { id: "contract-1", title: "Northwind MSA", counterpartyName: "Northwind" },
  assignee: { id: "user-1", name: "Wassim", email: "wassim@example.com" },
  evidence: [{
    id: "evidence-1",
    actionId: "action-1",
    kind: "completion_note",
    note: "Report sent",
    storageKey: "org-1/private/evidence.pdf",
    sourceUrl: null,
    recordedById: "user-1",
    createdAt: new Date("2026-08-18T11:00:00.000Z"),
    recordedBy: { id: "user-1", name: "Wassim" },
  }],
  deliveries: [],
  activities: [],
}

function resetActionMocks() {
  vi.resetAllMocks()
  vi.mocked(resolveAuth).mockResolvedValue(sessionCtx)
  vi.mocked(requireWriteScope).mockReturnValue(null)
  vi.mocked(prisma.$transaction).mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") return (arg as (tx: typeof prisma) => Promise<unknown>)(prisma)
    if (Array.isArray(arg)) return Promise.all(arg)
    return arg
  })
}

describe("GET /api/actions", () => {
  beforeEach(resetActionMocks)

  it("is a read-only minimized list that omits source, hashes, and evidence storage keys", async () => {
    vi.mocked(prisma.contractAction.findMany).mockResolvedValueOnce([baseAction] as never)
    vi.mocked(prisma.contractAction.count).mockResolvedValueOnce(1)

    const { GET } = await import("@/app/api/actions/route")
    const response = await GET(new Request("http://localhost/api/actions"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.actions[0]).toEqual(expect.objectContaining({
      id: "action-1",
      title: "Send the usage report",
      version: 1,
      hasCitation: true,
      evidenceCount: 1,
    }))
    expect(body.actions[0]).not.toHaveProperty("sourceText")
    expect(body.actions[0]).not.toHaveProperty("sourceHash")
    expect(body.actions[0]).not.toHaveProperty("sourceKey")
    expect(body.actions[0]).not.toHaveProperty("evidence")
    expect(body.actions[0].assignee).toEqual({ id: "user-1", name: "Wassim" })
    expect(body.actions[0].assignee).not.toHaveProperty("email")
    expect(prisma.contractAction.createMany).not.toHaveBeenCalled()
    expect(prisma.contractAction.upsert).not.toHaveBeenCalled()
    expect(prisma.contractAction.update).not.toHaveBeenCalled()
  })

  it("validates URL-backed views and scopes My work to the current user", async () => {
    vi.mocked(prisma.contractAction.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.contractAction.count).mockResolvedValueOnce(0)
    const { GET } = await import("@/app/api/actions/route")
    const response = await GET(new Request("http://localhost/api/actions?view=my_work"))

    expect(response.status).toBe(200)
    expect(prisma.contractAction.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: "org-1",
        assigneeId: "user-1",
        status: { in: ["PROPOSED", "PENDING_REVIEW", "ACKNOWLEDGED", "IN_PROGRESS", "BLOCKED", "STALE"] },
      }),
    }))

    const invalid = await GET(new Request("http://localhost/api/actions?view=everything"))
    expect(invalid.status).toBe(422)
  })

  it("returns the first five actions in the exact dashboard priority order", async () => {
    const rows = [
      { ...baseAction, id: "other", status: "ACKNOWLEDGED", dueDate: new Date("2026-10-01"), createdAt: new Date("2026-08-01") },
      { ...baseAction, id: "review", status: "PENDING_REVIEW", dueDate: null, createdAt: new Date("2026-08-01") },
      { ...baseAction, id: "blocked", status: "BLOCKED", dueDate: null, createdAt: new Date("2026-08-02") },
      { ...baseAction, id: "stale", status: "STALE", dueDate: new Date("2026-08-30"), createdAt: new Date("2026-08-01") },
      { ...baseAction, id: "unassigned", status: "ACKNOWLEDGED", dueDate: null, assigneeId: null, assignee: null, createdAt: new Date("2026-08-01") },
      { ...baseAction, id: "overdue", status: "ACKNOWLEDGED", dueDate: new Date("2026-08-01"), createdAt: new Date("2026-08-01") },
    ]
    vi.mocked(prisma.contractAction.findMany).mockResolvedValueOnce(rows as never)
    const { GET } = await import("@/app/api/actions/route")
    const response = await GET(new Request("http://localhost/api/actions?view=dashboard&limit=5"))
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.actions.map((item: { id: string }) => item.id)).toEqual(["stale", "blocked", "review", "overdue", "unassigned"])
    expect(prisma.contractAction.count).not.toHaveBeenCalled()
  })
})

describe("GET /api/actions/[id]", () => {
  beforeEach(resetActionMocks)

  it("returns a safe detail DTO without evidence storage keys", async () => {
    vi.mocked(prisma.contractAction.findFirst).mockResolvedValueOnce(baseAction as never)
    const { GET } = await import("@/app/api/actions/[id]/route")
    const response = await GET(new Request("http://localhost/api/actions/action-1"), { params: { id: "action-1" } })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.sourceText).toBe(baseAction.sourceText)
    expect(body).not.toHaveProperty("sourceHash")
    expect(body).not.toHaveProperty("sourceKey")
    expect(body.evidence[0]).not.toHaveProperty("storageKey")
    expect(body.evidence[0]).not.toHaveProperty("actionId")
  })

  it("requires text_read for API-key source excerpts", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(apiKeyCtx)
    vi.mocked(prisma.contractAction.findFirst).mockResolvedValueOnce(baseAction as never)
    const { GET } = await import("@/app/api/actions/[id]/route")
    const response = await GET(new Request("http://localhost/api/actions/action-1"), { params: { id: "action-1" } })
    const body = await response.json()

    expect(body).not.toHaveProperty("sourceText")
    expect(body.sourcePage).toBe(3)
  })

  it("returns 404 when the org-scoped action lookup cannot find the resource", async () => {
    vi.mocked(prisma.contractAction.findFirst).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/actions/[id]/route")
    const response = await GET(new Request("http://localhost/api/actions/other-org-action"), { params: { id: "other-org-action" } })

    expect(response.status).toBe(404)
    expect(prisma.contractAction.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "other-org-action", organizationId: "org-1" },
    }))
  })
})

describe("PATCH /api/actions/[id] commands", () => {
  beforeEach(resetActionMocks)

  it("rejects API-key commands because consequential action transitions require a human session", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(apiKeyCtx)
    const { PATCH } = await import("@/app/api/actions/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/actions/action-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "validate", expectedVersion: 1 }),
    }), { params: { id: "action-1" } })

    expect(response.status).toBe(403)
    expect(prisma.contractAction.updateMany).not.toHaveBeenCalled()
  })

  it("rejects viewer commands before loading or mutating an action", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    const { PATCH } = await import("@/app/api/actions/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/actions/action-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "validate", expectedVersion: 1 }),
    }), { params: { id: "action-1" } })

    expect(response.status).toBe(403)
    expect(prisma.contractAction.findFirst).not.toHaveBeenCalled()
    expect(prisma.contractAction.updateMany).not.toHaveBeenCalled()
  })

  it("rejects an optimistic version conflict without writing activity", async () => {
    vi.mocked(prisma.contractAction.findFirst).mockResolvedValueOnce(baseAction as never)
    const { PATCH } = await import("@/app/api/actions/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/actions/action-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "validate", expectedVersion: 0 }),
    }), { params: { id: "action-1" } })

    expect(response.status).toBe(409)
    expect(prisma.contractAction.updateMany).not.toHaveBeenCalled()
    expect(prisma.activity.create).not.toHaveBeenCalled()
  })

  it("validates a cited action with an attributed, versioned transition", async () => {
    vi.mocked(prisma.contractAction.findFirst)
      .mockResolvedValueOnce(baseAction as never)
      .mockResolvedValueOnce({ ...baseAction, status: "PROPOSED", reviewStatus: "reviewed", version: 2 } as never)
    vi.mocked(prisma.contractAction.updateMany).mockResolvedValueOnce({ count: 1 })
    vi.mocked(prisma.activity.create).mockResolvedValueOnce({ id: "activity-1" } as never)

    const { PATCH } = await import("@/app/api/actions/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/actions/action-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "validate", expectedVersion: 1 }),
    }), { params: { id: "action-1" } })

    expect(response.status).toBe(200)
    expect(prisma.contractAction.updateMany).toHaveBeenCalledWith({
      where: { id: "action-1", organizationId: "org-1", version: 1 },
      data: expect.objectContaining({ status: "PROPOSED", reviewStatus: "reviewed", version: { increment: 1 } }),
    })
    expect(prisma.activity.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      contractActionId: "action-1",
      userId: "user-1",
      action: "ACTION_REVIEWED",
    }) })
  })

  it("requires the configured evidence kind before completion", async () => {
    vi.mocked(prisma.contractAction.findFirst).mockResolvedValueOnce({
      ...baseAction,
      status: "IN_PROGRESS",
      reviewStatus: "reviewed",
      evidence: [{ ...baseAction.evidence[0], kind: "external_link" }],
    } as never)
    const { PATCH } = await import("@/app/api/actions/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/actions/action-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "complete", expectedVersion: 1 }),
    }), { params: { id: "action-1" } })

    expect(response.status).toBe(422)
    expect(await response.json()).toEqual({ error: "completion_evidence_required", requiredKind: "completion_note" })
    expect(prisma.contractAction.updateMany).not.toHaveBeenCalled()
  })

  it("requires a required approval to match the current action version", async () => {
    vi.mocked(prisma.contractAction.findFirst).mockResolvedValueOnce({
      ...baseAction,
      status: "IN_PROGRESS",
      reviewStatus: "reviewed",
      version: 4,
      approvals: [{ required: true, status: "approved", actionVersion: 3 }],
    } as never)
    const { PATCH } = await import("@/app/api/actions/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/actions/action-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "complete", expectedVersion: 4 }),
    }), { params: { id: "action-1" } })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: "action_approval_pending" })
    expect(prisma.contractAction.updateMany).not.toHaveBeenCalled()
  })

  it("carries a current approval across a non-consequential workflow transition", async () => {
    const current = {
      ...baseAction,
      status: "ACKNOWLEDGED",
      reviewStatus: "reviewed",
      version: 4,
      approvals: [{ required: true, status: "approved", actionVersion: 4 }],
    }
    vi.mocked(prisma.contractAction.findFirst)
      .mockResolvedValueOnce(current as never)
      .mockResolvedValueOnce({ ...current, status: "IN_PROGRESS", version: 5 } as never)
    vi.mocked(prisma.contractAction.updateMany).mockResolvedValueOnce({ count: 1 })
    const { PATCH } = await import("@/app/api/actions/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/actions/action-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "start", expectedVersion: 4 }),
    }), { params: { id: "action-1" } })

    expect(response.status).toBe(200)
    expect(prisma.approval.updateMany).toHaveBeenCalledWith({
      where: { actionId: "action-1", actionVersion: 4, status: "approved" },
      data: { actionVersion: 5 },
    })
  })

  it("does not carry approvals across an assignee change", async () => {
    vi.mocked(prisma.contractAction.findFirst)
      .mockResolvedValueOnce({ ...baseAction, status: "ACKNOWLEDGED", reviewStatus: "reviewed", approvals: [{ required: true, status: "approved", actionVersion: 1 }] } as never)
      .mockResolvedValueOnce({ ...baseAction, status: "ACKNOWLEDGED", reviewStatus: "reviewed", assigneeId: "user-2", version: 2 } as never)
    vi.mocked(prisma.member.findFirst).mockResolvedValueOnce({ userId: "user-2" } as never)
    vi.mocked(prisma.contractAction.updateMany).mockResolvedValueOnce({ count: 1 })
    const { PATCH } = await import("@/app/api/actions/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/actions/action-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "assign", assigneeId: "user-2", expectedVersion: 1 }),
    }), { params: { id: "action-1" } })

    expect(response.status).toBe(200)
    expect(prisma.approval.updateMany).not.toHaveBeenCalled()
  })

  it("rejects illegal state jumps", async () => {
    vi.mocked(prisma.contractAction.findFirst).mockResolvedValueOnce(baseAction as never)
    const { PATCH } = await import("@/app/api/actions/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/actions/action-1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: "complete", expectedVersion: 1 }),
    }), { params: { id: "action-1" } })

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual(expect.objectContaining({ error: "invalid_action_transition" }))
  })
})

describe("POST /api/actions/[id]/deliver", () => {
  beforeEach(resetActionMocks)

  it("queues one direct email to the assigned workspace member without generic fanout", async () => {
    vi.mocked(prisma.contractAction.findFirst).mockResolvedValueOnce({
      ...baseAction,
      status: "ACKNOWLEDGED",
      reviewStatus: "reviewed",
    } as never)
    vi.mocked(prisma.member.findFirst).mockResolvedValueOnce({
      userId: "user-1",
      user: { id: "user-1", name: "Wassim", email: "wassim@example.com" },
    } as never)
    vi.mocked(prisma.contractActionDelivery.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.contractActionDelivery.create).mockResolvedValueOnce({
      id: "delivery-1",
      actionId: "action-1",
      channel: "email",
      idempotencyKey: "key",
      status: "queued",
    } as never)
    vi.mocked(prisma.activity.create).mockResolvedValueOnce({ id: "activity-1" } as never)

    const { POST } = await import("@/app/api/actions/[id]/deliver/route")
    const response = await POST(new Request("http://localhost/api/actions/action-1/deliver", { method: "POST" }), { params: { id: "action-1" } })

    expect(response.status).toBe(202)
    expect(emailQueue.add).toHaveBeenCalledWith("send", expect.objectContaining({
      kind: "action_delivery",
      to: "wassim@example.com",
      actionId: "action-1",
      actionUrl: "/actions/action-1",
    }), expect.objectContaining({ jobId: expect.any(String) }))
  })
})

describe("POST /api/actions/[id]/approval", () => {
  beforeEach(resetActionMocks)

  it("rejects API-key approval requests because action approval is human-attributed", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(apiKeyCtx)
    const { POST } = await import("@/app/api/actions/[id]/approval/route")
    const response = await POST(new Request("http://localhost/api/actions/action-1/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId: "reviewer-1", expectedVersion: 1 }),
    }), { params: { id: "action-1" } })

    expect(response.status).toBe(403)
    expect(prisma.approval.create).not.toHaveBeenCalled()
  })

  it("creates an action-scoped approval and captures the post-request action version atomically", async () => {
    vi.mocked(prisma.contractAction.findFirst).mockResolvedValueOnce({
      ...baseAction,
      status: "PROPOSED",
      reviewStatus: "reviewed",
    } as never)
    vi.mocked(prisma.member.findFirst).mockResolvedValueOnce({ userId: "reviewer-1" } as never)
    vi.mocked(prisma.approval.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.contractAction.updateMany).mockResolvedValueOnce({ count: 1 })
    vi.mocked(prisma.approval.create).mockResolvedValueOnce({ id: "approval-1", actionVersion: 2 } as never)
    vi.mocked(prisma.activity.create).mockResolvedValueOnce({ id: "activity-1" } as never)

    const { POST } = await import("@/app/api/actions/[id]/approval/route")
    const response = await POST(new Request("http://localhost/api/actions/action-1/approval", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId: "reviewer-1", expectedVersion: 1 }),
    }), { params: { id: "action-1" } })

    expect(response.status).toBe(201)
    expect(prisma.contractAction.updateMany).toHaveBeenCalledWith({
      where: { id: "action-1", organizationId: "org-1", status: "PROPOSED", version: 1 },
      data: { version: { increment: 1 } },
    })
    expect(prisma.approval.create).toHaveBeenCalledWith({ data: expect.objectContaining({
      actionId: "action-1",
      actionVersion: 2,
      assignedToId: "reviewer-1",
    }) })
  })
})

describe("action approval freshness composed journey", () => {
  beforeEach(resetActionMocks)

  it("keeps the approved version fresh through start, direct delivery and completion", async () => {
    let action = { ...baseAction, status: "PROPOSED", reviewStatus: "reviewed", version: 1 }
    let approval: null | { id: string; contractId: string; actionId: string; actionVersion: number; requestedById: string; assignedToId: string; status: string; required: boolean; step: number } = null

    ;(prisma.contractAction.findFirst as any).mockImplementation(async () => ({
      ...action,
      approvals: approval ? [approval] : [],
    }) as never)
    ;(prisma.contractAction.updateMany as any).mockImplementation(async ({ where, data }: any) => {
      if (where.version !== action.version) return { count: 0 }
      if (data.status) action = { ...action, status: data.status }
      if (data.reviewStatus) action = { ...action, reviewStatus: data.reviewStatus }
      if (data.version?.increment) action = { ...action, version: action.version + data.version.increment }
      return { count: 1 }
    })
    vi.mocked(prisma.member.findFirst).mockResolvedValue({
      userId: "user-1",
      user: { id: "user-1", name: "Wassim", email: "wassim@example.com" },
    } as never)
    vi.mocked(prisma.approval.findFirst).mockResolvedValue(null)
    ;(prisma.approval.create as any).mockImplementation(async ({ data }: any) => {
      approval = { id: "approval-1", step: 1, ...data }
      return approval as never
    })
    vi.mocked(prisma.contract.findUnique).mockResolvedValue({ id: "contract-1", organizationId: "org-1", status: "ACTIVE" } as never)
    ;(prisma.approval.findUnique as any).mockImplementation(async () => approval)
    ;(prisma.approval.update as any).mockImplementation(async ({ data }: any) => {
      approval = { ...approval!, ...data }
      return approval as never
    })
    ;(prisma.approval.updateMany as any).mockImplementation(async ({ where, data }: any) => {
      const currentApproval = approval
      if (currentApproval && currentApproval.actionVersion === where.actionVersion && currentApproval.status === where.status) {
        approval = { ...currentApproval, ...data }
        return { count: 1 }
      }
      return { count: 0 }
    })
    vi.mocked(prisma.activity.create).mockResolvedValue({ id: "activity-1" } as never)
    vi.mocked(prisma.contractObligation.updateMany).mockResolvedValue({ count: 1 })
    vi.mocked(prisma.contractActionDelivery.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.contractActionDelivery.create).mockResolvedValue({ id: "delivery-1", status: "pending" } as never)
    vi.mocked(prisma.contractActionDelivery.update).mockResolvedValue({ id: "delivery-1", status: "queued" } as never)

    const { POST: requestApproval } = await import("@/app/api/actions/[id]/approval/route")
    const requested = await requestApproval(new Request("http://localhost/api/actions/action-1/approval", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedToId: "user-1", expectedVersion: 1 }),
    }), { params: { id: "action-1" } })
    expect(requested.status).toBe(201)
    expect(action.version).toBe(2)
    expect(approval).toEqual(expect.objectContaining({ status: "pending", actionVersion: 2 }))

    const { PATCH: decideApproval } = await import("@/app/api/contracts/[id]/approvals/[approvalId]/route")
    const decided = await decideApproval(new Request("http://localhost/api/contracts/contract-1/approvals/approval-1", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "approved" }),
    }), { params: { id: "contract-1", approvalId: "approval-1" } })
    expect(decided.status).toBe(200)
    expect(action).toEqual(expect.objectContaining({ status: "ACKNOWLEDGED", version: 3 }))
    expect(approval).toEqual(expect.objectContaining({ status: "approved", actionVersion: 3 }))

    const { PATCH: commandAction } = await import("@/app/api/actions/[id]/route")
    const started = await commandAction(new Request("http://localhost/api/actions/action-1", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: "start", expectedVersion: 3 }),
    }), { params: { id: "action-1" } })
    expect(started.status).toBe(200)
    expect(approval).toEqual(expect.objectContaining({ actionVersion: 4 }))

    const { POST: deliver } = await import("@/app/api/actions/[id]/deliver/route")
    expect((await deliver(new Request("http://localhost/api/actions/action-1/deliver", { method: "POST" }), { params: { id: "action-1" } })).status).toBe(202)

    const completed = await commandAction(new Request("http://localhost/api/actions/action-1", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ command: "complete", expectedVersion: 4 }),
    }), { params: { id: "action-1" } })
    expect(completed.status).toBe(200)
    expect(action).toEqual(expect.objectContaining({ status: "COMPLETED", version: 5 }))
  })
})
