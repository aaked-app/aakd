import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db/client"
import { captureServerEvent } from "@/lib/posthog-server"
import { searchKeywordFallback } from "@/lib/search/keyword-fallback"

vi.mock("@/lib/posthog-server", () => ({ captureServerEvent: vi.fn() }))
vi.mock("@/lib/auth/middleware", () => ({ resolveAuth: vi.fn().mockResolvedValue({
  userId: "user-1", organizationId: "org-1", memberId: "member-1", role: "owner", source: "session", requestId: "search-test",
}) }))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: vi.fn().mockResolvedValue({ allowed: true }), rateLimitResponse: vi.fn() }))

describe("search privacy", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.contract.findMany).mockResolvedValue([])
    vi.mocked(prisma.contract.count).mockResolvedValue(0)
    vi.mocked(prisma.$queryRaw).mockResolvedValue([])
  })

  it("records query length but never searched contract content in analytics", async () => {
    const { GET } = await import("@/app/api/search/route")
    const query = "Private merger consideration 987654"
    expect((await GET(new Request(`http://localhost/api/search?q=${encodeURIComponent(query)}`))).status).toBe(200)
    expect(captureServerEvent).toHaveBeenCalledWith("user-1", "search_performed", {
      queryLength: query.length, organizationId: "org-1",
    })
    expect(JSON.stringify(vi.mocked(captureServerEvent).mock.calls)).not.toContain("Private merger")
  })

  it("keeps local fallback scoped to the exact member and returns no source text", async () => {
    await searchKeywordFallback({ organizationId: "org-1", memberId: "member-1" }, "renewal renewal Arabic", 200)
    const args = vi.mocked(prisma.contract.findMany).mock.calls[0][0]!
    expect(args.where).toEqual({ AND: [
      { organizationId: "org-1" },
      { accessGrants: { some: { organizationId: "org-1", memberId: "member-1" } } },
      { status: { not: "ARCHIVED" }, AND: ["renewal", "Arabic"].map(word => ({ OR: [
        { title: { contains: word, mode: "insensitive" } },
        { counterpartyName: { contains: word, mode: "insensitive" } },
        { extractedText: { contains: word, mode: "insensitive" } },
      ] })) },
    ] })
    expect(args.take).toBe(50)
    expect(args.select).not.toHaveProperty("extractedText")
  })

  it("makes no database query for whitespace and denies a missing member", async () => {
    expect(await searchKeywordFallback({ organizationId: "org-1" }, "  \n ", 10)).toEqual([])
    expect(prisma.contract.findMany).not.toHaveBeenCalled()
    await searchKeywordFallback({ organizationId: "org-1" }, "renewal", 0)
    const args = vi.mocked(prisma.contract.findMany).mock.calls[0][0]!
    expect(args.where).toMatchObject({ AND: [
      { organizationId: "org-1" },
      { AND: [{ id: "__denied__" }, { id: { not: "__denied__" } }] },
      { status: { not: "ARCHIVED" } },
    ] })
    expect(args.take).toBe(1)
  })
})
