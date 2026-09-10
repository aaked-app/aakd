import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db/client"
import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"

const recipientCtx = {
  userId: "user-recipient",
  memberId: "member-recipient",
  organizationId: "org-1",
  role: "viewer",
  source: "session" as const,
  requestId: "brief-command-request",
}
const item = {
  itemId: "item-1",
  actionId: "action-1",
  actionVersion: 4,
  currentVersion: 4,
  contractId: "contract-1",
  status: "ACKNOWLEDGED",
}

vi.mock("@/lib/auth/middleware", () => ({ resolveAuth: vi.fn(), requireWriteScope: vi.fn(() => null) }))
vi.mock("@/lib/context", () => ({ requestContext: { run: vi.fn((_ctx, fn) => fn()) } }))

function request(path: "evidence" | "blocker", body: unknown) {
  return new Request(`http://localhost/api/briefs/brief-1/items/item-1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

function params(id = "brief-1", itemId = "item-1") {
  return { params: Promise.resolve({ id, itemId }) }
}

describe("Team Brief recipient commands", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(resolveAuth).mockResolvedValue(recipientCtx)
    vi.mocked(requireWriteScope).mockReturnValue(null)
    vi.mocked(prisma.$transaction).mockImplementation(async (fn: unknown) => (
      fn as (tx: typeof prisma) => Promise<unknown>
    )(prisma))
  })

  it("submits evidence through the exact current member and addressed item without returning action detail", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([item] as never)
    vi.mocked(prisma.contractActionEvidence.create).mockResolvedValueOnce({
      id: "evidence-1", kind: "URL", note: "Delivered", sourceUrl: "https://example.test/proof",
      reviewStatus: "SUBMITTED", createdAt: new Date("2026-09-09T10:00:00Z"),
    } as never)
    const { POST } = await import("@/app/api/briefs/[id]/items/[itemId]/evidence/route")
    const response = await POST(request("evidence", {
      expectedVersion: 4,
      kind: "URL",
      note: "Delivered",
      sourceUrl: "https://example.test/proof",
    }), params())
    const body = await response.json()

    expect(response.status).toBe(201)
    expect(body).toEqual(expect.objectContaining({ id: "evidence-1", reviewStatus: "SUBMITTED" }))
    expect(body).not.toHaveProperty("actionId")
    expect(body).not.toHaveProperty("contractId")
    expect(prisma.contractActionEvidence.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ actionId: "action-1", recordedById: "user-recipient" }),
    }))
    expect(prisma.activity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        contractId: "contract-1",
        contractActionId: "action-1",
        action: "ACTION_EVIDENCE_ADDED",
        metadata: expect.objectContaining({ briefId: "brief-1", itemId: "item-1", requestId: "brief-command-request" }),
      }),
    }))
  })

  it("binds access to audienceMemberId and parameterizes hostile identifiers", async () => {
    const hostile = "brief' OR true --"
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([] as never)
    const { POST } = await import("@/app/api/briefs/[id]/items/[itemId]/evidence/route")
    const response = await POST(request("evidence", { expectedVersion: 4, kind: "NOTE" }), params(hostile))

    expect(response.status).toBe(404)
    const sql = vi.mocked(prisma.$queryRaw).mock.calls[0][0] as { strings: readonly string[]; values: unknown[] }
    const text = sql.strings.join("?")
    expect(text).toContain('brief."audienceMemberId" = ?')
    expect(text).not.toContain("audienceUserId")
    expect(text).not.toContain(hostile)
    expect(sql.values).toContain(hostile)
  })

  it("does not revive access for a recreated membership or an unrelated same-org member", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce({ ...recipientCtx, memberId: "member-recreated" })
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([] as never)
    const { POST } = await import("@/app/api/briefs/[id]/items/[itemId]/blocker/route")
    const response = await POST(request("blocker", { expectedVersion: 4, reason: "Waiting for vendor" }), params())

    expect(response.status).toBe(404)
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
    expect(prisma.activity.create).not.toHaveBeenCalled()
  })

  it("rejects a stale snapshot before writing evidence", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ ...item, currentVersion: 5 }] as never)
    const { POST } = await import("@/app/api/briefs/[id]/items/[itemId]/evidence/route")
    const response = await POST(request("evidence", { expectedVersion: 4, kind: "NOTE" }), params())

    expect(response.status).toBe(409)
    await expect(response.json()).resolves.toEqual({ error: "brief_item_stale" })
    expect(prisma.contractActionEvidence.create).not.toHaveBeenCalled()
  })

  it("blocks a current addressed action atomically and returns only Brief-safe state", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([item] as never)
    vi.mocked(prisma.$executeRaw).mockResolvedValueOnce(1).mockResolvedValueOnce(1)
    const { POST } = await import("@/app/api/briefs/[id]/items/[itemId]/blocker/route")
    const response = await POST(request("blocker", { expectedVersion: 4, reason: "Waiting for vendor" }), params())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ itemId: "item-1", status: "BLOCKED", version: 5 })
    expect(body).not.toHaveProperty("actionId")
    expect(body).not.toHaveProperty("contractId")
    expect(prisma.$executeRaw).toHaveBeenCalledTimes(2)
    expect(prisma.activity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "ACTION_BLOCKED", userId: "user-recipient" }),
    }))
  })

  it.each([
    ["stale version", { ...item, currentVersion: 5 }, { expectedVersion: 4, reason: "Blocked" }, "brief_item_stale"],
    ["invalid transition", { ...item, status: "PROPOSED" }, { expectedVersion: 4, reason: "Blocked" }, "invalid_action_transition"],
  ])("rejects %s without changing the action", async (_label, row, body, error) => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([row] as never)
    const { POST } = await import("@/app/api/briefs/[id]/items/[itemId]/blocker/route")
    const response = await POST(request("blocker", body), params())

    expect(response.status).toBe(409)
    expect((await response.json()).error).toBe(error)
    expect(prisma.$executeRaw).not.toHaveBeenCalled()
  })

  it.each([
    ["API key", { ...recipientCtx, source: "api_key" as const }],
    ["missing membership", { ...recipientCtx, memberId: undefined }],
  ])("denies %s before querying Brief content", async (_label, context) => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(context)
    const { POST } = await import("@/app/api/briefs/[id]/items/[itemId]/evidence/route")
    const response = await POST(request("evidence", { expectedVersion: 4, kind: "NOTE" }), params())

    expect(response.status).toBe(403)
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })

  it.each([
    ["empty reason", { expectedVersion: 4, reason: "" }],
    ["oversized reason", { expectedVersion: 4, reason: "x".repeat(1001) }],
    ["negative version", { expectedVersion: -1, reason: "Blocked" }],
  ])("rejects malformed blocker input: %s", async (_label, body) => {
    const { POST } = await import("@/app/api/briefs/[id]/items/[itemId]/blocker/route")
    const response = await POST(request("blocker", body), params())

    expect(response.status).toBe(422)
    expect(prisma.$queryRaw).not.toHaveBeenCalled()
  })
})
