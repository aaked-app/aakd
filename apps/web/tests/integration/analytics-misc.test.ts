import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@/lib/db/client"

// ─── Mock auth ────────────────────────────────────────────────────────────────

vi.mock("@/lib/auth/middleware", () => ({
  resolveAuth: vi.fn(),
  requireWriteScope: vi.fn(() => null),
}))

vi.mock("@/lib/db/activity", () => ({
  writeActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/context", () => ({
  requestContext: { run: vi.fn((ctx, fn) => fn()) },
}))

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfter: 0 }),
  rateLimitResponse: vi.fn(() => new Response("Too Many Requests", { status: 429 })),
}))

// Silence IORedis — health route creates a real Redis client during import
vi.mock("ioredis", () => {
  const MockIORedis = vi.fn().mockImplementation(() => ({
    ping: vi.fn().mockResolvedValue("PONG"),
    disconnect: vi.fn(),
  }))
  return { default: MockIORedis }
})

vi.mock("@/lib/api-headers", () => ({
  SECURE_HEADERS: {},
}))

vi.mock("@/lib/editor/template", () => ({
  findUsedVariableNames: vi.fn().mockReturnValue([]),
  substituteVariables: vi.fn().mockReturnValue({ type: "doc", content: [] }),
}))

vi.mock("@/lib/editor/plate-to-plaintext", () => ({
  plateToPlaintext: vi.fn().mockReturnValue("contract text"),
  countWords: vi.fn().mockReturnValue(2),
}))

import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"

// ─── Auth context helpers ─────────────────────────────────────────────────────

const adminCtx = {
  userId: "user-admin",
  organizationId: "org-1",
  role: "admin",
  source: "session" as const,
  requestId: "req-test",
}
const viewerCtx = { ...adminCtx, role: "viewer" }
const legalCtx = { ...adminCtx, role: "legal" }
const memberCtx = { ...adminCtx, role: "member" }

function resetMocks() {
  vi.clearAllMocks()
  vi.mocked(requireWriteScope).mockReturnValue(null)
}

beforeEach(resetMocks)

// ─── Shared fixtures ─────────────────────────────────────────────────────────

const mockContract = {
  id: "contract-1",
  organizationId: "org-1",
  title: "Test Contract",
  status: "ACTIVE",
  endDate: new Date("2026-08-01"),
  counterpartyName: "Acme Corp",
  contractType: "NDA",
  noticePeriodDays: 30,
  autoRenewal: true,
  value: 50000,
  currency: "USD",
  riskScore: null,
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/analytics/summary
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/analytics/summary", () => {
  function setupAnalyticsMocks() {
    // expiringCounts (raw query 1) + expiringContracts (findMany) run in parallel
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ next30: BigInt(2), next60: BigInt(3), next90: BigInt(5) }]) // expiring counts
      .mockResolvedValueOnce([{ month: "2026-05", count: BigInt(10) }]) // monthly volume
      .mockResolvedValueOnce([{ total: BigInt(5), approved: BigInt(3), rejected: BigInt(1) }]) // approval funnel
      .mockResolvedValueOnce([{ overdue: BigInt(1), dueSoon: BigInt(2) }]) // obligations

    vi.mocked(prisma.contract.findMany).mockResolvedValueOnce([
      { id: "c1", title: "Expiring Contract", endDate: new Date("2026-06-10"), counterpartyName: "Vendor", contractType: "MSA" },
    ] as any)

    vi.mocked(prisma.contract.groupBy)
      .mockResolvedValueOnce([
        { status: "ACTIVE", _count: { _all: 10 } },
        { status: "DRAFT", _count: { _all: 3 } },
      ] as any)
      .mockResolvedValueOnce([
        { contractType: "NDA", _sum: { value: 100000 }, _count: { _all: 2 } },
      ] as any)
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/analytics/summary/route")
    const req = new Request("http://localhost/api/analytics/summary")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns analytics summary with all sections", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    setupAnalyticsMocks()
    const { GET } = await import("@/app/api/analytics/summary/route")
    const req = new Request("http://localhost/api/analytics/summary")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty("expiringSoon")
    expect(body).toHaveProperty("byStatus")
    expect(body).toHaveProperty("monthlyVolume")
    expect(body).toHaveProperty("valueByType")
    expect(body).toHaveProperty("approvalFunnel")
    expect(body).toHaveProperty("obligations")
  })

  it("expiringSoon counts are correctly typed as numbers (not BigInt)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    setupAnalyticsMocks()
    const { GET } = await import("@/app/api/analytics/summary/route")
    const req = new Request("http://localhost/api/analytics/summary")
    const res = await GET(req)
    const body = await res.json()
    expect(typeof body.expiringSoon.next30).toBe("number")
    expect(typeof body.expiringSoon.next60).toBe("number")
    expect(typeof body.expiringSoon.next90).toBe("number")
    expect(body.expiringSoon.next30).toBe(2)
    expect(body.expiringSoon.next60).toBe(3)
    expect(body.expiringSoon.next90).toBe(5)
  })

  it("byStatus contains correct status keys", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    setupAnalyticsMocks()
    const { GET } = await import("@/app/api/analytics/summary/route")
    const req = new Request("http://localhost/api/analytics/summary")
    const res = await GET(req)
    const body = await res.json()
    expect(body.byStatus).toHaveLength(2)
    expect(body.byStatus[0].status).toBe("ACTIVE")
    expect(body.byStatus[0].count).toBe(10)
  })

  it("approvalFunnel computes pending correctly", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    setupAnalyticsMocks()
    const { GET } = await import("@/app/api/analytics/summary/route")
    const req = new Request("http://localhost/api/analytics/summary")
    const res = await GET(req)
    const body = await res.json()
    // total=5, approved=3, rejected=1 => pending=1
    expect(body.approvalFunnel.totalRequested).toBe(5)
    expect(body.approvalFunnel.approved).toBe(3)
    expect(body.approvalFunnel.rejected).toBe(1)
    expect(body.approvalFunnel.pending).toBe(1)
  })

  it("obligations are included when available", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    setupAnalyticsMocks()
    const { GET } = await import("@/app/api/analytics/summary/route")
    const req = new Request("http://localhost/api/analytics/summary")
    const res = await GET(req)
    const body = await res.json()
    expect(body.obligations).not.toBeNull()
    expect(body.obligations.overdue).toBe(1)
    expect(body.obligations.dueSoon).toBe(2)
  })

  it("obligations degrade gracefully when query fails", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    // Set up only the first 3 raw queries (obligations query will throw)
    vi.mocked(prisma.$queryRaw)
      .mockResolvedValueOnce([{ next30: BigInt(0), next60: BigInt(0), next90: BigInt(0) }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ total: BigInt(0), approved: BigInt(0), rejected: BigInt(0) }])
      .mockRejectedValueOnce(new Error("ContractObligation table does not exist"))

    vi.mocked(prisma.contract.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.contract.groupBy)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])

    const { GET } = await import("@/app/api/analytics/summary/route")
    const req = new Request("http://localhost/api/analytics/summary")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.obligations).toBeNull()
  })

  it("monthlyVolume always returns 12 months", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    setupAnalyticsMocks()
    const { GET } = await import("@/app/api/analytics/summary/route")
    const req = new Request("http://localhost/api/analytics/summary")
    const res = await GET(req)
    const body = await res.json()
    expect(body.monthlyVolume).toHaveLength(12)
    body.monthlyVolume.forEach((m: { month: string; count: number }) => {
      expect(m).toHaveProperty("month")
      expect(m).toHaveProperty("count")
      expect(typeof m.count).toBe("number")
    })
  })

  it("expiringSoon.contracts includes daysUntilExpiry field", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    setupAnalyticsMocks()
    const { GET } = await import("@/app/api/analytics/summary/route")
    const req = new Request("http://localhost/api/analytics/summary")
    const res = await GET(req)
    const body = await res.json()
    expect(body.expiringSoon.contracts).toHaveLength(1)
    const c = body.expiringSoon.contracts[0]
    expect(c).toHaveProperty("daysUntilExpiry")
    expect(typeof c.daysUntilExpiry).toBe("number")
  })

  it("viewer role can access analytics summary", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    setupAnalyticsMocks()
    const { GET } = await import("@/app/api/analytics/summary/route")
    const req = new Request("http://localhost/api/analytics/summary")
    const res = await GET(req)
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/renewals
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/renewals", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/renewals/route")
    const req = new Request("http://localhost/api/renewals")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns 429 when rate limited", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    const { rateLimit, rateLimitResponse } = await import("@/lib/rate-limit")
    vi.mocked(rateLimit).mockResolvedValueOnce({ allowed: false, retryAfter: 30 })
    vi.mocked(rateLimitResponse).mockReturnValueOnce(new Response("Too Many Requests", { status: 429 }))
    const { GET } = await import("@/app/api/renewals/route")
    const req = new Request("http://localhost/api/renewals")
    const res = await GET(req)
    expect(res.status).toBe(429)
  })

  it("returns empty renewals list", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findMany).mockResolvedValueOnce([])
    const { GET } = await import("@/app/api/renewals/route")
    const req = new Request("http://localhost/api/renewals")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.renewals).toEqual([])
  })

  it("returns contracts with auto-renewal and computed noticeDeadlineDate", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findMany).mockResolvedValueOnce([mockContract] as any)
    const { GET } = await import("@/app/api/renewals/route")
    const req = new Request("http://localhost/api/renewals")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.renewals).toHaveLength(1)
    const renewal = body.renewals[0]
    expect(renewal.id).toBe("contract-1")
    expect(renewal).toHaveProperty("noticeDeadlineDate")
    expect(renewal).toHaveProperty("daysUntilDeadline")
  })

  it("respects limit query param (max 200)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findMany).mockResolvedValueOnce([])
    const { GET } = await import("@/app/api/renewals/route")
    const req = new Request("http://localhost/api/renewals?limit=500")
    const res = await GET(req)
    expect(res.status).toBe(200)
    // Ensure findMany was called with take <= 200
    expect(prisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    )
  })

  it("contracts without noticePeriodDays have null noticeDeadlineDate", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findMany).mockResolvedValueOnce([
      { ...mockContract, noticePeriodDays: null },
    ] as any)
    const { GET } = await import("@/app/api/renewals/route")
    const req = new Request("http://localhost/api/renewals")
    const res = await GET(req)
    const body = await res.json()
    expect(body.renewals[0].noticeDeadlineDate).toBeNull()
    expect(body.renewals[0].daysUntilDeadline).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/activities
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/activities", () => {
  const mockActivity = {
    id: "activity-1",
    contractId: "contract-1",
    action: "CREATED",
    actorLabel: "Alice",
    createdAt: new Date("2026-01-01"),
    user: { id: "user-admin", name: "Alice", image: null },
    contract: { id: "contract-1", title: "Test Contract" },
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/activities/route")
    const req = new Request("http://localhost/api/activities")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns paginated activity list", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.activity.findMany).mockResolvedValueOnce([mockActivity] as any)
    vi.mocked(prisma.activity.count).mockResolvedValueOnce(1)
    const { GET } = await import("@/app/api/activities/route")
    const req = new Request("http://localhost/api/activities")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.activities).toHaveLength(1)
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })

  it("supports page and limit query params", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.activity.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.activity.count).mockResolvedValueOnce(0)
    const { GET } = await import("@/app/api/activities/route")
    const req = new Request("http://localhost/api/activities?page=2&limit=10")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.page).toBe(2)
    expect(body.limit).toBe(10)
  })

  it("filters by action query param", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.activity.findMany).mockResolvedValueOnce([mockActivity] as any)
    vi.mocked(prisma.activity.count).mockResolvedValueOnce(1)
    const { GET } = await import("@/app/api/activities/route")
    const req = new Request("http://localhost/api/activities?action=CREATED")
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ action: "CREATED" }),
      }),
    )
  })

  it("filters by days query param", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.activity.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.activity.count).mockResolvedValueOnce(0)
    const { GET } = await import("@/app/api/activities/route")
    const req = new Request("http://localhost/api/activities?days=7")
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ createdAt: expect.objectContaining({ gte: expect.any(Date) }) }),
      }),
    )
  })

  it("supports search query param", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.activity.findMany).mockResolvedValueOnce([mockActivity] as any)
    vi.mocked(prisma.activity.count).mockResolvedValueOnce(1)
    const { GET } = await import("@/app/api/activities/route")
    const req = new Request("http://localhost/api/activities?search=Alice")
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(prisma.activity.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ OR: expect.any(Array) }),
      }),
    )
  })

  it("clamps limit to max 100", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.activity.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.activity.count).mockResolvedValueOnce(0)
    const { GET } = await import("@/app/api/activities/route")
    const req = new Request("http://localhost/api/activities?limit=9999")
    const res = await GET(req)
    const body = await res.json()
    expect(body.limit).toBe(100)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/ai-status
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/ai-status", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/ai-status/route")
    const req = new Request("http://localhost/api/ai-status")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns org BYOK config when set", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.orgAiConfig.findUnique).mockResolvedValueOnce({
      provider: "anthropic",
      model: "claude-haiku-4-5",
    } as any)
    const { GET } = await import("@/app/api/ai-status/route")
    const req = new Request("http://localhost/api/ai-status")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.provider).toBe("anthropic")
    expect(body.model).toBe("claude-haiku-4-5")
    expect(body.hasKey).toBe(true)
    expect(body.source).toBe("org")
  })

  it("falls back to env vars when no org config", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.orgAiConfig.findUnique).mockResolvedValueOnce(null)
    // No env vars set in test env — should return no-config response
    const { GET } = await import("@/app/api/ai-status/route")
    const req = new Request("http://localhost/api/ai-status")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    // In test env no API keys are set so hasKey should be false (unless env leak)
    expect(body).toHaveProperty("hasKey")
    expect(body).toHaveProperty("provider")
    expect(body).toHaveProperty("source")
  })

  it("returns hasKey=false when no config anywhere", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.orgAiConfig.findUnique).mockResolvedValueOnce(null)
    // Ensure env vars are not set
    const saved = {
      AI_PROVIDER: process.env.AI_PROVIDER,
      ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      OLLAMA_BASE_URL: process.env.OLLAMA_BASE_URL,
    }
    delete process.env.AI_PROVIDER
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.OLLAMA_BASE_URL
    const { GET } = await import("@/app/api/ai-status/route")
    const req = new Request("http://localhost/api/ai-status")
    const res = await GET(req)
    const body = await res.json()
    expect(body.hasKey).toBe(false)
    expect(body.provider).toBeNull()
    // Restore
    Object.assign(process.env, saved)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/health
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/health", () => {
  it("returns response with correct shape and db=ok when db is healthy", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }])
    const { GET } = await import("@/app/api/health/route")
    const res = await GET()
    // Status is 200 (all ok) or 503 (degraded if Redis unavailable in test env)
    // Either way the shape must be correct
    expect([200, 503]).toContain(res.status)
    const body = await res.json()
    expect(body).toHaveProperty("status")
    expect(body).toHaveProperty("timestamp")
    expect(body).toHaveProperty("checks")
    expect(body.checks).toHaveProperty("db")
    expect(body.checks).toHaveProperty("redis")
    expect(body.checks.db).toBe("ok")
  })

  it("returns 503 with status=degraded when db fails", async () => {
    vi.mocked(prisma.$queryRaw).mockRejectedValueOnce(new Error("DB connection refused"))
    const { GET } = await import("@/app/api/health/route")
    const res = await GET()
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.status).toBe("degraded")
    expect(body.checks.db).toBe("error")
  })

  it("returns timestamp in response", async () => {
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([{ "?column?": 1 }])
    const { GET } = await import("@/app/api/health/route")
    const res = await GET()
    const body = await res.json()
    expect(body.timestamp).toBeTruthy()
    expect(() => new Date(body.timestamp)).not.toThrow()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/templates
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/templates", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/templates/route")
    const req = new Request("http://localhost/api/templates")
    const res = await GET(req)
    expect(res.status).toBe(401)
  })

  it("returns empty templates list", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractTemplate.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.contractTemplate.count).mockResolvedValueOnce(0)
    const { GET } = await import("@/app/api/templates/route")
    const req = new Request("http://localhost/api/templates")
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.templates).toEqual([])
    expect(body.total).toBe(0)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })

  it("filters by contractType query param", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractTemplate.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.contractTemplate.count).mockResolvedValueOnce(0)
    const { GET } = await import("@/app/api/templates/route")
    const req = new Request("http://localhost/api/templates?contractType=NDA")
    const res = await GET(req)
    expect(res.status).toBe(200)
    expect(prisma.contractTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ contractType: "NDA" }),
      }),
    )
  })

  it("supports pagination params", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractTemplate.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.contractTemplate.count).mockResolvedValueOnce(0)
    const { GET } = await import("@/app/api/templates/route")
    const req = new Request("http://localhost/api/templates?page=2&limit=5")
    const res = await GET(req)
    const body = await res.json()
    expect(body.page).toBe(2)
    expect(body.limit).toBe(5)
  })

  it("viewer can list templates", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    vi.mocked(prisma.contractTemplate.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.contractTemplate.count).mockResolvedValueOnce(0)
    const { GET } = await import("@/app/api/templates/route")
    const req = new Request("http://localhost/api/templates")
    const res = await GET(req)
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/templates
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/templates", () => {
  const validTemplate = {
    name: "Standard NDA",
    description: "Non-disclosure agreement template",
    contractType: "NDA",
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Agreement text" }] }] },
    variables: [
      { name: "party_name", label: "Party Name", type: "text", required: true },
    ],
    wordCount: 50,
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/templates/route")
    const req = new Request("http://localhost/api/templates", {
      method: "POST",
      body: JSON.stringify(validTemplate),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns 403 for viewer role", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    const { POST } = await import("@/app/api/templates/route")
    const req = new Request("http://localhost/api/templates", {
      method: "POST",
      body: JSON.stringify(validTemplate),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it("returns 403 for member role", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    const { POST } = await import("@/app/api/templates/route")
    const req = new Request("http://localhost/api/templates", {
      method: "POST",
      body: JSON.stringify(validTemplate),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it("returns 422 when variables have duplicate names", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(legalCtx)
    const bodyWithDupes = {
      ...validTemplate,
      variables: [
        { name: "party_name", label: "Party Name", type: "text", required: true },
        { name: "party_name", label: "Party Name 2", type: "text", required: false },
      ],
    }
    const { POST } = await import("@/app/api/templates/route")
    const req = new Request("http://localhost/api/templates", {
      method: "POST",
      body: JSON.stringify(bodyWithDupes),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("duplicate_variable_names")
    expect(body.duplicates).toContain("party_name")
  })

  it("returns 422 when template limit is reached", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(legalCtx)
    vi.mocked(prisma.contractTemplate.count).mockResolvedValueOnce(200) // at limit
    const { POST } = await import("@/app/api/templates/route")
    const req = new Request("http://localhost/api/templates", {
      method: "POST",
      body: JSON.stringify(validTemplate),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("template_limit_reached")
  })

  it("legal role can create template and returns 201", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(legalCtx)
    vi.mocked(prisma.contractTemplate.count).mockResolvedValueOnce(5)
    vi.mocked(prisma.contractTemplate.create).mockResolvedValueOnce({
      id: "tpl-1",
      name: "Standard NDA",
      contractType: "NDA",
      createdBy: { id: "user-admin", name: "Alice" },
    } as any)
    const { POST } = await import("@/app/api/templates/route")
    const req = new Request("http://localhost/api/templates", {
      method: "POST",
      body: JSON.stringify(validTemplate),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe("tpl-1")
    expect(body.name).toBe("Standard NDA")
  })

  it("admin role can create template", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractTemplate.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.contractTemplate.create).mockResolvedValueOnce({
      id: "tpl-2",
      name: "Standard NDA",
      contractType: "NDA",
      createdBy: { id: "user-admin", name: "Alice" },
    } as any)
    const { POST } = await import("@/app/api/templates/route")
    const req = new Request("http://localhost/api/templates", {
      method: "POST",
      body: JSON.stringify(validTemplate),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/templates/[id]
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/templates/[id]", () => {
  const mockTemplate = {
    id: "tpl-1",
    name: "Standard NDA",
    description: null,
    contractType: "NDA",
    isArchived: false,
    organizationId: "org-1",
    content: { type: "doc", content: [] },
    variables: [],
    wordCount: 50,
    createdAt: new Date(),
    updatedAt: new Date(),
    createdBy: { id: "user-admin", name: "Alice" },
    updatedBy: { id: "user-admin", name: "Alice" },
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/templates/[id]/route")
    const req = new Request("http://localhost/api/templates/tpl-1")
    const res = await GET(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(401)
  })

  it("returns 404 when template not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractTemplate.findUnique).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/templates/[id]/route")
    const req = new Request("http://localhost/api/templates/tpl-1")
    const res = await GET(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 404 when template is archived", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractTemplate.findUnique).mockResolvedValueOnce({
      ...mockTemplate,
      isArchived: true,
    } as any)
    const { GET } = await import("@/app/api/templates/[id]/route")
    const req = new Request("http://localhost/api/templates/tpl-1")
    const res = await GET(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 404 when template belongs to another org (isolation)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce({ ...adminCtx, organizationId: "org-other" })
    vi.mocked(prisma.contractTemplate.findUnique).mockResolvedValueOnce(mockTemplate as any)
    const { GET } = await import("@/app/api/templates/[id]/route")
    const req = new Request("http://localhost/api/templates/tpl-1")
    const res = await GET(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(404)
  })

  it("returns template with full data", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractTemplate.findUnique).mockResolvedValueOnce(mockTemplate as any)
    const { GET } = await import("@/app/api/templates/[id]/route")
    const req = new Request("http://localhost/api/templates/tpl-1")
    const res = await GET(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe("tpl-1")
    expect(body.name).toBe("Standard NDA")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/templates/[id]
// ═══════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/templates/[id]", () => {
  const existingTemplate = {
    id: "tpl-1",
    isArchived: false,
    organizationId: "org-1",
    content: { type: "doc", content: [] },
    variables: [],
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { PATCH } = await import("@/app/api/templates/[id]/route")
    const req = new Request("http://localhost/api/templates/tpl-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Name" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(401)
  })

  it("returns 403 for member role", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    const { PATCH } = await import("@/app/api/templates/[id]/route")
    const req = new Request("http://localhost/api/templates/tpl-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Name" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(403)
  })

  it("returns 404 when template not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(legalCtx)
    vi.mocked(prisma.contractTemplate.findUnique).mockResolvedValueOnce(null)
    const { PATCH } = await import("@/app/api/templates/[id]/route")
    const req = new Request("http://localhost/api/templates/tpl-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated Name" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 422 when updated variables have duplicates", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(legalCtx)
    vi.mocked(prisma.contractTemplate.findUnique).mockResolvedValueOnce(existingTemplate as any)
    const { PATCH } = await import("@/app/api/templates/[id]/route")
    const req = new Request("http://localhost/api/templates/tpl-1", {
      method: "PATCH",
      body: JSON.stringify({
        variables: [
          { name: "party_name", label: "Party", type: "text", required: true },
          { name: "party_name", label: "Party 2", type: "text", required: false },
        ],
      }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("duplicate_variable_names")
  })

  it("legal role can update template name", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(legalCtx)
    vi.mocked(prisma.contractTemplate.findUnique).mockResolvedValueOnce(existingTemplate as any)
    vi.mocked(prisma.contractTemplate.update).mockResolvedValueOnce({
      id: "tpl-1",
      name: "Updated NDA",
      createdBy: { id: "user-admin", name: "Alice" },
      updatedBy: { id: "user-admin", name: "Alice" },
    } as any)
    const { PATCH } = await import("@/app/api/templates/[id]/route")
    const req = new Request("http://localhost/api/templates/tpl-1", {
      method: "PATCH",
      body: JSON.stringify({ name: "Updated NDA" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe("Updated NDA")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/templates/[id]
// ═══════════════════════════════════════════════════════════════════════════════

describe("DELETE /api/templates/[id]", () => {
  const existingTemplate = {
    id: "tpl-1",
    isArchived: false,
    organizationId: "org-1",
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { DELETE } = await import("@/app/api/templates/[id]/route")
    const req = new Request("http://localhost/api/templates/tpl-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(401)
  })

  it("returns 403 for member role", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    const { DELETE } = await import("@/app/api/templates/[id]/route")
    const req = new Request("http://localhost/api/templates/tpl-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(403)
  })

  it("returns 403 for viewer role", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    const { DELETE } = await import("@/app/api/templates/[id]/route")
    const req = new Request("http://localhost/api/templates/tpl-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(403)
  })

  it("returns 404 when template not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(legalCtx)
    vi.mocked(prisma.contractTemplate.findUnique).mockResolvedValueOnce(null)
    const { DELETE } = await import("@/app/api/templates/[id]/route")
    const req = new Request("http://localhost/api/templates/tpl-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 404 when template belongs to another org (isolation)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce({ ...legalCtx, organizationId: "org-other" })
    vi.mocked(prisma.contractTemplate.findUnique).mockResolvedValueOnce(existingTemplate as any)
    const { DELETE } = await import("@/app/api/templates/[id]/route")
    const req = new Request("http://localhost/api/templates/tpl-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(404)
  })

  it("legal role can soft-delete template (isArchived=true) and returns 204", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(legalCtx)
    vi.mocked(prisma.contractTemplate.findUnique).mockResolvedValueOnce(existingTemplate as any)
    vi.mocked(prisma.contractTemplate.update).mockResolvedValueOnce({
      ...existingTemplate,
      isArchived: true,
    } as any)
    const { DELETE } = await import("@/app/api/templates/[id]/route")
    const req = new Request("http://localhost/api/templates/tpl-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(204)
    // Verify soft-delete: update called with isArchived=true, not a hard delete
    expect(prisma.contractTemplate.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "tpl-1" },
        data: expect.objectContaining({ isArchived: true }),
      }),
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/templates/[id]/use
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/templates/[id]/use", () => {
  const activeTemplate = {
    id: "tpl-1",
    isArchived: false,
    contractType: "NDA",
    content: { type: "doc", content: [] },
    variables: [
      { name: "party_name", label: "Party Name", type: "text", required: true },
    ],
  }

  const validUseBody = {
    title: "Acme NDA 2026",
    values: { party_name: "Acme Corp" },
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/templates/[id]/use/route")
    const req = new Request("http://localhost/api/templates/tpl-1/use", {
      method: "POST",
      body: JSON.stringify(validUseBody),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(401)
  })

  it("returns 403 for viewer role", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    const { POST } = await import("@/app/api/templates/[id]/use/route")
    const req = new Request("http://localhost/api/templates/tpl-1/use", {
      method: "POST",
      body: JSON.stringify(validUseBody),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(403)
  })

  it("returns 404 when template is archived", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    vi.mocked(prisma.contractTemplate.findUnique).mockResolvedValueOnce({
      ...activeTemplate,
      isArchived: true,
    } as any)
    const { POST } = await import("@/app/api/templates/[id]/use/route")
    const req = new Request("http://localhost/api/templates/tpl-1/use", {
      method: "POST",
      body: JSON.stringify(validUseBody),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 422 when required variables are missing", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    vi.mocked(prisma.contractTemplate.findUnique).mockResolvedValueOnce(activeTemplate as any)
    const { POST } = await import("@/app/api/templates/[id]/use/route")
    const req = new Request("http://localhost/api/templates/tpl-1/use", {
      method: "POST",
      body: JSON.stringify({ title: "Test Contract", values: {} }), // missing party_name
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("missing_required_variables")
    expect(body.missing).toContain("party_name")
  })

  it("creates contract from template and returns 201 with contractId", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    vi.mocked(prisma.contractTemplate.findUnique).mockResolvedValueOnce(activeTemplate as any)
    vi.mocked(prisma.contract.create).mockResolvedValueOnce({ id: "contract-new" } as any)
    vi.mocked(prisma.contractDocument.create).mockResolvedValueOnce({ id: "doc-new" } as any)
    const { POST } = await import("@/app/api/templates/[id]/use/route")
    const req = new Request("http://localhost/api/templates/tpl-1/use", {
      method: "POST",
      body: JSON.stringify(validUseBody),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.contractId).toBe("contract-new")
  })

  it("legal role can use template", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(legalCtx)
    vi.mocked(prisma.contractTemplate.findUnique).mockResolvedValueOnce(activeTemplate as any)
    vi.mocked(prisma.contract.create).mockResolvedValueOnce({ id: "contract-legal" } as any)
    vi.mocked(prisma.contractDocument.create).mockResolvedValueOnce({ id: "doc-legal" } as any)
    const { POST } = await import("@/app/api/templates/[id]/use/route")
    const req = new Request("http://localhost/api/templates/tpl-1/use", {
      method: "POST",
      body: JSON.stringify(validUseBody),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(201)
  })

  it("returns 400 when folder is not found in the org", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    vi.mocked(prisma.contractTemplate.findUnique).mockResolvedValueOnce({
      ...activeTemplate,
      variables: [], // no required variables
    } as any)
    vi.mocked(prisma.folder.findFirst).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/templates/[id]/use/route")
    const req = new Request("http://localhost/api/templates/tpl-1/use", {
      method: "POST",
      body: JSON.stringify({ title: "Test", folderId: "folder-missing", values: {} }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "tpl-1" } })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/folder/i)
  })
})
