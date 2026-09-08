import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db/client"
import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"

const sessionCtx = { userId: "user-1", organizationId: "org-1", role: "legal", source: "session" as const, requestId: "brief-request" }

vi.mock("@/lib/auth/middleware", () => ({ resolveAuth: vi.fn(), requireWriteScope: vi.fn(() => null) }))
vi.mock("@/lib/context", () => ({ requestContext: { run: vi.fn((_ctx, fn) => fn()) } }))

describe("Team Brief API", () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(resolveAuth).mockResolvedValue(sessionCtx)
    vi.mocked(requireWriteScope).mockReturnValue(null)
    vi.mocked(prisma.$transaction).mockImplementation(async (arg: unknown) => typeof arg === "function" ? (arg as (tx: typeof prisma) => Promise<unknown>)(prisma) : Promise.all(arg as Promise<unknown>[]))
  })

  it("publishes only reviewed actions to a named organization member", async () => {
    vi.mocked(prisma.member.findFirst).mockResolvedValueOnce({ userId: "user-2" } as never)
    vi.mocked(prisma.contractAction.findMany).mockResolvedValueOnce([{
      id: "action-1", version: 3, title: "Send report", description: "Monthly report", condition: "Section 4", dueDate: new Date("2026-10-01"), sourceText: "Send a monthly report.", sourcePage: 2, confidence: 0.9, assigneeId: "user-2", status: "PROPOSED", reviewStatus: "reviewed",
    }] as never)
    vi.mocked(prisma.teamBrief.create).mockResolvedValueOnce({ id: "brief-1", title: "October handoff", status: "PUBLISHED", createdAt: new Date(), audienceUserId: "user-2" } as never)
    vi.mocked(prisma.notification.create).mockResolvedValueOnce({ id: "notification-1" } as never)

    const { POST } = await import("@/app/api/briefs/route")
    const response = await POST(new Request("http://localhost/api/briefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "October handoff", audienceUserId: "user-2", actionIds: ["action-1"] }) }))

    expect(response.status).toBe(201)
    expect(prisma.teamBrief.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: "org-1", publishedById: "user-1", audienceUserId: "user-2", items: expect.objectContaining({ create: [expect.objectContaining({ actionId: "action-1", actionVersion: 3, sourcePage: 2 })] }) }) }))
    expect(prisma.notification.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ userId: "user-2", eventName: "team_brief.published", actionUrl: "/briefs/brief-1" }) }))
  })

  it("rejects an audience outside the organization and hides a brief from other members", async () => {
    vi.mocked(prisma.member.findFirst).mockResolvedValueOnce(null)
    const { POST, GET } = await import("@/app/api/briefs/route")
    const rejected = await POST(new Request("http://localhost/api/briefs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: "Handoff", audienceUserId: "other-org-user", actionIds: ["action-1"] }) }))
    expect(rejected.status).toBe(422)

    vi.mocked(prisma.teamBrief.findMany).mockResolvedValueOnce([])
    const listed = await GET(new Request("http://localhost/api/briefs"))
    expect(listed.status).toBe(200)
    expect(prisma.teamBrief.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { organizationId: "org-1", OR: [{ publishedById: "user-1" }, { audienceUserId: "user-1" }] } }))
  })

  it("requires audience acknowledgement to come from the named recipient", async () => {
    vi.mocked(prisma.teamBrief.findFirst).mockResolvedValueOnce({ id: "brief-1", audienceUserId: "user-2" } as never)
    const { PATCH } = await import("@/app/api/briefs/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/briefs/brief-1", { method: "PATCH" }), { params: { id: "brief-1" } })
    expect(response.status).toBe(403)
    expect(prisma.teamBrief.update).not.toHaveBeenCalled()
  })
})
