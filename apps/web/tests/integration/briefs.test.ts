import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db/client"
import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"

const sessionCtx = { userId: "user-1", memberId: "member-publisher", organizationId: "org-1", role: "legal", source: "session" as const, requestId: "brief-request" }
const apiKeyCtx = { ...sessionCtx, source: "api_key" as const }

vi.mock("@/lib/auth/middleware", () => ({ resolveAuth: vi.fn(), requireWriteScope: vi.fn(() => null) }))
vi.mock("@/lib/context", () => ({ requestContext: { run: vi.fn((_ctx, fn) => fn()) } }))

Object.assign(prisma.teamBrief, { updateMany: vi.fn() })

type ActionFixture = {
  id: string
  contractId: string
  version: number
  title: string
  description: string | null
  condition: string | null
  dueDate: Date | null
  sourceText: string | null
  sourcePage: number | null
  confidence: number | null
  assigneeId: string | null
  status: string
  reviewStatus: string
}

const publishableAction: ActionFixture = {
  id: "action-1",
  contractId: "contract-1",
  version: 3,
  title: "Send report",
  description: "Monthly report",
  condition: "When the month closes",
  dueDate: null,
  sourceText: "Send a monthly report.",
  sourcePage: 2,
  confidence: 0.9,
  assigneeId: "user-3",
  status: "PROPOSED",
  reviewStatus: "reviewed",
}

function briefRequest(body: Record<string, unknown> = {}) {
  return new Request("http://localhost/api/briefs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "October handoff",
      audienceUserId: "user-2",
      actionIds: ["action-1"],
      expectedVersions: { "action-1": 3 },
      ...body,
    }),
  })
}

function prepareSuccessfulPublication(action = publishableAction) {
  vi.mocked(prisma.member.findFirst).mockResolvedValueOnce({ id: "member-recipient", userId: "user-2" } as never)
  vi.mocked(prisma.contractAction.findMany).mockResolvedValueOnce([action] as never)
  vi.mocked(prisma.contractAccessGrant.findMany).mockResolvedValueOnce([{ contractId: action.contractId }] as never)
  vi.mocked(prisma.teamBrief.create).mockResolvedValueOnce({
    id: "brief-1",
    title: "October handoff",
    status: "PUBLISHED",
    createdAt: new Date("2026-09-09T10:00:00.000Z"),
    audienceUserId: "user-2",
    audienceMemberId: "member-recipient",
    items: [{ id: "item-1", actionId: action.id, action: { contractId: action.contractId } }],
  } as never)
  vi.mocked(prisma.notification.create).mockResolvedValueOnce({ id: "notification-1" } as never)
}

describe("Team Brief API", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(resolveAuth).mockResolvedValue(sessionCtx)
    vi.mocked(requireWriteScope).mockReturnValue(null)
    vi.mocked(prisma.member.findMany).mockResolvedValue([])
    vi.mocked(prisma.$transaction).mockImplementation(async (arg: unknown) => (
      typeof arg === "function"
        ? (arg as (tx: typeof prisma) => Promise<unknown>)(prisma)
        : Promise.all(arg as Promise<unknown>[])
    ))
  })

  it("publishes a reviewed, cited, owned, due-or-conditioned snapshot without requiring the assignee to be the recipient", async () => {
    prepareSuccessfulPublication()

    const { POST } = await import("@/app/api/briefs/route")
    const response = await POST(briefRequest())

    expect(response.status).toBe(201)
    expect(prisma.teamBrief.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        organizationId: "org-1",
        publishedById: "user-1",
        audienceUserId: "user-2",
        audienceMemberId: "member-recipient",
        items: expect.objectContaining({
          create: [expect.objectContaining({ actionId: "action-1", actionVersion: 3, assigneeId: "user-3", sourcePage: 2 })],
        }),
      }),
    }))
    expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ userId: "user-2", eventName: "team_brief.published", actionUrl: "/briefs/brief-1" }),
    }))
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" })
    expect(prisma.activity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        contractId: "contract-1",
        action: "TEAM_BRIEF_PUBLISHED",
        metadata: { requestId: "brief-request", briefId: "brief-1", targetMemberId: "member-recipient", itemIds: ["item-1"] },
      }),
    }))
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(3)
    expect(vi.mocked(prisma.$queryRaw).mock.invocationCallOrder[1]).toBeLessThan(
      vi.mocked(prisma.contractAction.findMany).mock.invocationCallOrder[0],
    )
  })

  it("requires a publisher grant for every represented agreement and reveals no missing contract", async () => {
    const second = { ...publishableAction, id: "action-2", contractId: "contract-2", version: 1 }
    vi.mocked(prisma.member.findFirst).mockResolvedValueOnce({ id: "member-recipient", userId: "user-2" } as never)
    vi.mocked(prisma.contractAction.findMany).mockResolvedValueOnce([publishableAction, second] as never)
    vi.mocked(prisma.contractAccessGrant.findMany).mockResolvedValueOnce([{ contractId: "contract-1" }] as never)
    const { POST } = await import("@/app/api/briefs/route")
    const response = await POST(briefRequest({
      actionIds: ["action-1", "action-2"],
      expectedVersions: { "action-1": 3, "action-2": 1 },
    }))

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "action_not_found" })
    expect(prisma.teamBrief.create).not.toHaveBeenCalled()
  })

  it("audits a multi-agreement publication once per contract with only that contract's item ids", async () => {
    const second = { ...publishableAction, id: "action-2", contractId: "contract-2", version: 1 }
    vi.mocked(prisma.member.findFirst).mockResolvedValueOnce({ id: "member-recipient", userId: "user-2" } as never)
    vi.mocked(prisma.contractAction.findMany).mockResolvedValueOnce([publishableAction, second] as never)
    vi.mocked(prisma.contractAccessGrant.findMany).mockResolvedValueOnce([{ contractId: "contract-1" }, { contractId: "contract-2" }] as never)
    vi.mocked(prisma.teamBrief.create).mockResolvedValueOnce({
      id: "brief-multi", title: "October handoff", status: "PUBLISHED", createdAt: new Date(),
      audienceUserId: "user-2", audienceMemberId: "member-recipient",
      items: [
        { id: "item-1", actionId: "action-1", action: { contractId: "contract-1" } },
        { id: "item-2", actionId: "action-2", action: { contractId: "contract-2" } },
      ],
    } as never)
    const { POST } = await import("@/app/api/briefs/route")
    const response = await POST(briefRequest({
      actionIds: ["action-1", "action-2"],
      expectedVersions: { "action-1": 3, "action-2": 1 },
    }))

    expect(response.status).toBe(201)
    expect(prisma.activity.create).toHaveBeenCalledTimes(2)
    expect(prisma.activity.create).toHaveBeenNthCalledWith(1, expect.objectContaining({
      data: expect.objectContaining({ contractId: "contract-1", metadata: expect.objectContaining({ itemIds: ["item-1"] }) }),
    }))
    expect(prisma.activity.create).toHaveBeenNthCalledWith(2, expect.objectContaining({
      data: expect.objectContaining({ contractId: "contract-2", metadata: expect.objectContaining({ itemIds: ["item-2"] }) }),
    }))
  })

  it("rejects duplicate action ids instead of silently deduplicating the requested publication", async () => {
    const { POST } = await import("@/app/api/briefs/route")
    const response = await POST(briefRequest({
      actionIds: ["action-1", "action-1"],
      expectedVersions: { "action-1": 3 },
    }))

    expect(response.status).toBe(422)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it.each([
    ["missing map", undefined],
    ["missing action version", {}],
    ["extra action version", { "action-1": 3, "action-2": 1 }],
    ["negative action version", { "action-1": -1 }],
    ["out-of-range action version", { "action-1": Number.MAX_SAFE_INTEGER }],
  ])("rejects an invalid expectedVersions precondition: %s", async (_label, expectedVersions) => {
    const { POST } = await import("@/app/api/briefs/route")
    const requestBody: Record<string, unknown> = {
      title: "October handoff",
      audienceUserId: "user-2",
      actionIds: ["action-1"],
    }
    if (expectedVersions !== undefined) requestBody.expectedVersions = expectedVersions
    const response = await POST(new Request("http://localhost/api/briefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    }))

    expect(response.status).toBe(422)
    expect(prisma.$transaction).not.toHaveBeenCalled()
  })

  it("rejects an audience outside the organization", async () => {
    vi.mocked(prisma.member.findFirst).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/briefs/route")
    const response = await POST(briefRequest({ audienceUserId: "other-org-user" }))

    expect(response.status).toBe(422)
    await expect(response.json()).resolves.toEqual({ error: "invalid_audience" })
    expect(prisma.teamBrief.create).not.toHaveBeenCalled()
  })

  it.each([
    ["pending review status", { status: "PENDING_REVIEW" }, "action_not_reviewed"],
    ["stale status", { status: "STALE" }, "action_not_reviewed"],
    ["dismissed status", { status: "DISMISSED" }, "action_not_reviewed"],
    ["unreviewed state", { reviewStatus: "pending" }, "action_not_reviewed"],
    ["missing citation", { sourceText: "  ", sourcePage: null }, "action_citation_required"],
    ["missing owner", { assigneeId: null }, "action_assignee_required"],
    ["missing due date and condition", { dueDate: null, condition: "  " }, "action_deadline_or_condition_required"],
  ])("rejects a non-publishable action with %s", async (_label, change, error) => {
    prepareSuccessfulPublication({ ...publishableAction, ...change })
    const { POST } = await import("@/app/api/briefs/route")
    const response = await POST(briefRequest())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error, actionId: "action-1" })
    expect(prisma.teamBrief.create).not.toHaveBeenCalled()
  })

  it("rejects a page-only citation because a recipient cannot verify the claim from an excerpt", async () => {
    prepareSuccessfulPublication({ ...publishableAction, sourceText: null, sourcePage: 4 })
    const { POST } = await import("@/app/api/briefs/route")
    const response = await POST(briefRequest())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: "action_citation_required", actionId: "action-1" })
  })

  it("rejects a stale expected version before creating a snapshot", async () => {
    prepareSuccessfulPublication({ ...publishableAction, version: 4 })
    const { POST } = await import("@/app/api/briefs/route")
    const response = await POST(briefRequest())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: "action_version_conflict", actionId: "action-1" })
    expect(prisma.teamBrief.create).not.toHaveBeenCalled()
  })

  it("returns not found when any requested action is outside the organization or missing", async () => {
    vi.mocked(prisma.member.findFirst).mockResolvedValueOnce({ id: "member-recipient", userId: "user-2" } as never)
    vi.mocked(prisma.contractAction.findMany).mockResolvedValueOnce([])
    const { POST } = await import("@/app/api/briefs/route")
    const response = await POST(briefRequest())

    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "action_not_found" })
    expect(prisma.teamBrief.create).not.toHaveBeenCalled()
  })

  it("maps a serializable transaction conflict to a retryable publication conflict", async () => {
    vi.mocked(prisma.$transaction).mockRejectedValueOnce(Object.assign(new Error("write conflict"), { code: "P2034" }))
    const { POST } = await import("@/app/api/briefs/route")
    const response = await POST(briefRequest())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: "brief_source_changed" })
  })

  it.each([
    ["list", async () => {
      const { GET } = await import("@/app/api/briefs/route")
      return GET(new Request("http://localhost/api/briefs"))
    }],
    ["detail", async () => {
      const { GET } = await import("@/app/api/briefs/[id]/route")
      return GET(new Request("http://localhost/api/briefs/brief-1"), { params: Promise.resolve({ id: "brief-1" }) })
    }],
  ])("requires a human session to read a brief %s", async (_label, callRoute) => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(apiKeyCtx)
    const response = await callRoute()

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: "human_session_required" })
    expect(prisma.teamBrief.findMany).not.toHaveBeenCalled()
    expect(prisma.teamBrief.findFirst).not.toHaveBeenCalled()
  })

  it("binds recipient visibility to the exact member and publisher visibility to every represented agreement grant", async () => {
    vi.mocked(prisma.teamBrief.findMany).mockResolvedValueOnce([])
    const { GET } = await import("@/app/api/briefs/route")
    const response = await GET(new Request("http://localhost/api/briefs"))

    expect(response.status).toBe(200)
    expect(prisma.teamBrief.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: "org-1",
        OR: expect.arrayContaining([
          { audienceMemberId: "member-publisher" },
          expect.objectContaining({ publishedById: "user-1", items: expect.objectContaining({ every: expect.any(Object) }) }),
        ]),
      }),
    }))
  })

  it.each([
    ["CURRENT", 3, "PROPOSED", "reviewed"],
    ["STALE", 4, "PROPOSED", "reviewed"],
    ["STALE", 3, "STALE", "reviewed"],
    ["STALE", 3, "PROPOSED", "pending"],
  ])("returns snapshot content with %s freshness and no replacement source disclosure", async (freshness, version, status, reviewStatus) => {
    vi.mocked(prisma.teamBrief.findFirst).mockResolvedValueOnce({
      id: "brief-1",
      title: "October handoff",
      status: "PUBLISHED",
      acknowledgedAt: null,
      createdAt: new Date("2026-09-09T10:00:00.000Z"),
      publishedBy: { id: "user-1", name: "Publisher" },
      audienceUser: { id: "user-2", name: "Recipient" },
      items: [{
        id: "item-1",
        actionId: "action-1",
        actionVersion: 3,
        title: "Snapshot title",
        description: "Snapshot description",
        condition: "Snapshot condition",
        dueDate: null,
        sourceText: "Snapshot source",
        sourcePage: 2,
        confidence: 0.9,
        assigneeId: "user-3",
        action: { version, status, reviewStatus },
      }],
    } as never)
    const { GET } = await import("@/app/api/briefs/[id]/route")
    const response = await GET(new Request("http://localhost/api/briefs/brief-1"), { params: Promise.resolve({ id: "brief-1" }) })
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.items[0]).toEqual(expect.objectContaining({ sourceText: "Snapshot source", freshness }))
    expect(body.items[0].assignee).toBeNull()
    expect(body.items[0]).not.toHaveProperty("action")
    expect(body.items[0]).not.toHaveProperty("currentVersion")
    expect(prisma.teamBrief.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.objectContaining({
        items: expect.objectContaining({
          select: expect.objectContaining({ action: { select: { version: true, status: true, reviewStatus: true } } }),
        }),
      }),
    }))
  })

  it("resolves a snapshot owner name only through current organization membership", async () => {
    vi.mocked(prisma.teamBrief.findFirst).mockResolvedValueOnce({
      id: "brief-1",
      title: "October handoff",
      status: "PUBLISHED",
      acknowledgedAt: null,
      createdAt: new Date("2026-09-09T10:00:00.000Z"),
      publishedBy: { id: "user-1", name: "Publisher" },
      audienceUser: { id: "user-2", name: "Recipient" },
      items: [{
        id: "item-1",
        actionId: "action-1",
        actionVersion: 3,
        title: "Snapshot title",
        description: null,
        condition: "Snapshot condition",
        dueDate: null,
        sourceText: "Snapshot source",
        sourcePage: 2,
        confidence: 0.9,
        assigneeId: "user-3",
        action: { version: 3, status: "PROPOSED", reviewStatus: "reviewed" },
      }],
    } as never)
    vi.mocked(prisma.member.findMany).mockResolvedValueOnce([{
      userId: "user-3",
      user: { id: "user-3", name: "Action owner" },
    }] as never)
    const { GET } = await import("@/app/api/briefs/[id]/route")
    const response = await GET(new Request("http://localhost/api/briefs/brief-1"), { params: Promise.resolve({ id: "brief-1" }) })
    const body = await response.json()

    expect(body.items[0].assignee).toEqual({ id: "user-3", name: "Action owner" })
    expect(body.items[0].assignee).not.toHaveProperty("email")
    expect(prisma.member.findMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", userId: { in: ["user-3"] } },
      select: { userId: true, user: { select: { id: true, name: true } } },
    })
  })

  it("hides a brief detail from an unrelated organization member", async () => {
    vi.mocked(prisma.teamBrief.findFirst).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/briefs/[id]/route")
    const response = await GET(new Request("http://localhost/api/briefs/brief-1"), { params: Promise.resolve({ id: "brief-1" }) })

    expect(response.status).toBe(404)
    expect(prisma.teamBrief.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({
        organizationId: "org-1",
        OR: expect.arrayContaining([{ audienceMemberId: "member-publisher" }]),
      }),
    }))
  })

  it("acknowledges once for the named recipient", async () => {
    const acknowledgedAt = new Date("2026-09-09T11:00:00.000Z")
    vi.mocked(prisma.teamBrief.updateMany).mockResolvedValueOnce({ count: 1 } as never)
    vi.mocked(prisma.teamBrief.findFirst).mockResolvedValueOnce({ id: "brief-1", acknowledgedAt, items: [{ action: { contractId: "contract-1" } }] } as never)
    vi.mocked(resolveAuth).mockResolvedValueOnce({ ...sessionCtx, userId: "user-2", memberId: "member-recipient" })
    const { PATCH } = await import("@/app/api/briefs/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/briefs/brief-1", { method: "PATCH" }), { params: Promise.resolve({ id: "brief-1" }) })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ id: "brief-1", acknowledgedAt: acknowledgedAt.toISOString(), acknowledged: true, alreadyAcknowledged: false })
    expect(prisma.teamBrief.updateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "brief-1", organizationId: "org-1", audienceMemberId: "member-recipient", acknowledgedAt: null },
    }))
    expect(prisma.activity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        contractId: "contract-1",
        action: "TEAM_BRIEF_ACKNOWLEDGED",
        metadata: expect.objectContaining({ briefId: "brief-1", targetMemberId: "member-recipient" }),
      }),
    }))
  })

  it("replays acknowledgement idempotently without changing the original timestamp", async () => {
    const acknowledgedAt = new Date("2026-09-09T11:00:00.000Z")
    vi.mocked(prisma.teamBrief.updateMany).mockResolvedValueOnce({ count: 0 } as never)
    vi.mocked(prisma.teamBrief.findFirst).mockResolvedValueOnce({ id: "brief-1", acknowledgedAt, items: [{ action: { contractId: "contract-1" } }] } as never)
    vi.mocked(resolveAuth).mockResolvedValueOnce({ ...sessionCtx, userId: "user-2", memberId: "member-recipient" })
    const { PATCH } = await import("@/app/api/briefs/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/briefs/brief-1", { method: "PATCH" }), { params: Promise.resolve({ id: "brief-1" }) })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ id: "brief-1", acknowledgedAt: acknowledgedAt.toISOString(), acknowledged: true, alreadyAcknowledged: true })
    expect(prisma.activity.create).not.toHaveBeenCalled()
  })

  it("does not report acknowledgement success when no timestamp was persisted", async () => {
    vi.mocked(prisma.teamBrief.updateMany).mockResolvedValueOnce({ count: 0 } as never)
    vi.mocked(prisma.teamBrief.findFirst).mockResolvedValueOnce({ id: "brief-1", acknowledgedAt: null, items: [{ action: { contractId: "contract-1" } }] } as never)
    vi.mocked(resolveAuth).mockResolvedValueOnce({ ...sessionCtx, userId: "user-2", memberId: "member-recipient" })
    const { PATCH } = await import("@/app/api/briefs/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/briefs/brief-1", { method: "PATCH" }), { params: Promise.resolve({ id: "brief-1" }) })

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: "brief_acknowledgement_conflict" })
  })

  it("returns not found rather than revealing a brief to a non-recipient", async () => {
    vi.mocked(prisma.teamBrief.updateMany).mockResolvedValueOnce({ count: 0 } as never)
    vi.mocked(prisma.teamBrief.findFirst).mockResolvedValueOnce(null)
    const { PATCH } = await import("@/app/api/briefs/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/briefs/brief-1", { method: "PATCH" }), { params: Promise.resolve({ id: "brief-1" }) })

    expect(response.status).toBe(404)
    expect(prisma.teamBrief.update).not.toHaveBeenCalled()
  })
})
