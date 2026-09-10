import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@/lib/db/client"
import { requestContext } from "@/lib/context"

const mockCtx = {
  userId: "user-1",
  organizationId: "org-1",
  memberId: "member-1",
  role: "admin",
  source: "session" as const,
  requestId: "test-request-id",
}

const semanticMocks = vi.hoisted(() => ({
  enqueue: vi.fn(),
  rateLimit: vi.fn(),
}))

vi.mock("@/lib/auth/middleware", () => ({
  resolveAuth: vi.fn().mockResolvedValue(mockCtx),
  requireWriteScope: vi.fn(() => null),
}))

vi.mock("@/lib/embedding", () => ({
  generateEmbedding: vi.fn(),
}))

vi.mock("@/lib/db/worker-client", () => ({ getWorkerPrisma: () => prisma }))
vi.mock("@/lib/jobs/interactive-ai-client", () => ({
  enqueueInteractiveAiRequest: semanticMocks.enqueue,
}))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: semanticMocks.rateLimit,
  rateLimitResponse: (retryAfter: number) => Response.json({ error: "Too many requests", retryAfter }, { status: 429 }),
}))

beforeEach(() => {
  semanticMocks.rateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 })
  semanticMocks.enqueue.mockImplementation(async (ctx: typeof mockCtx, operation: "contract_question" | "semantic_search", contractId: string | null, payload: any) => {
    const { executeInteractiveAiOperation } = await import("@/lib/jobs/interactive-ai-executor")
    if (contractId) {
      const prior = vi.mocked(prisma.contract.findUnique).mock.results.at(-1)?.value
      if (prior) vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(await prior)
    }
    const response = await executeInteractiveAiOperation({
      jobId: "00000000-0000-4000-8000-000000000001",
      operation,
      organizationId: ctx.organizationId,
      requestedByUserId: ctx.userId,
      requestedByMemberId: ctx.memberId,
      source: ctx.source,
      apiKeyId: null,
      contractId,
      payloadKey: "test",
      createdAt: 0,
      expiresAt: 300_000,
    }, payload, async () => {})
    return { state: "completed", jobId: "00000000-0000-4000-8000-000000000001", response }
  })
})

// ─── /api/search/semantic ──────────────────────────────────────────────────────

describe("POST /api/search/semantic", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)

    const { POST } = await import("@/app/api/search/semantic/route")

    const req = new Request("http://localhost/api/search/semantic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "indemnification clause" }),
    })

    const res = await POST(req)
    expect(res.status).toBe(401)
  })

  it("returns explicit permission-scoped keyword results when embeddings are unavailable", async () => {
    const { generateEmbedding } = await import("@/lib/embedding")
    vi.mocked(generateEmbedding).mockResolvedValueOnce(null)
    vi.mocked(prisma.contract.findMany).mockResolvedValueOnce([{ id: "granted-contract", title: "Indemnification clause" }] as any)

    const { POST } = await import("@/app/api/search/semantic/route")

    const req = new Request("http://localhost/api/search/semantic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "indemnification clause" }),
    })

    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.mode).toBe("keyword")
    expect(body.results[0].id).toBe("granted-contract")
    expect(JSON.stringify(vi.mocked(prisma.contract.findMany).mock.calls)).toContain("member-1")
  })

  it("returns results when embedding provider is configured", async () => {
    const fakeEmbedding = Array.from({ length: 1536 }, (_, i) => i / 1536)

    const { generateEmbedding } = await import("@/lib/embedding")
    vi.mocked(generateEmbedding).mockResolvedValueOnce({ vector: fakeEmbedding, model: "openai:text-embedding-3-small:1536" })

    const mockRows = [
      {
        id: "contract-1",
        title: "NDA with Acme Corp",
        contractType: "NDA",
        status: "ACTIVE",
        counterpartyName: "Acme Corp",
        value: null,
        currency: "USD",
        endDate: null,
        createdAt: new Date("2026-01-01"),
        similarity: 0.87,
      },
    ]
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce(mockRows as any)

    const { POST } = await import("@/app/api/search/semantic/route")

    const req = new Request("http://localhost/api/search/semantic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "confidentiality agreement", limit: 5 }),
    })

    const res = await requestContext.run(mockCtx, () => POST(req))
    expect(res.status).toBe(200)

    const body = await res.json()
    expect(body.results).toHaveLength(1)
    expect(body.results[0].id).toBe("contract-1")
    expect(body.total).toBe(1)
  })

  it("returns 400 for empty query", async () => {
    const { POST } = await import("@/app/api/search/semantic/route")

    const req = new Request("http://localhost/api/search/semantic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "" }),
    })

    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it("fails closed without enqueueing when the rate limiter throws", async () => {
    semanticMocks.rateLimit.mockRejectedValueOnce(new Error("secret-rate-limiter-token"))
    const { POST } = await import("@/app/api/search/semantic/route")
    const res = await POST(new Request("http://localhost/api/search/semantic", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query: "confidential acquisition" }),
    }))
    expect(res.status).toBe(503)
    const responseText = await res.text()
    expect(responseText).toContain("Semantic search unavailable")
    expect(responseText).not.toContain("secret-rate-limiter-token")
    expect(semanticMocks.enqueue).not.toHaveBeenCalled()
  })
})

// ─── /api/contracts/[id]/ask ───────────────────────────────────────────────────

describe("POST /api/contracts/[id]/ask", () => {
  it("rejects whitespace-only questions before reading a contract", async () => {
    vi.clearAllMocks()
    const { POST } = await import("@/app/api/contracts/[id]/ask/route")
    const response = await POST(new Request("http://localhost/api/contracts/c1/ask", { method: "POST", body: JSON.stringify({ question: " \n\t " }) }), { params: Promise.resolve({ id: "c1" }) })
    expect(response.status).toBe(400)
    expect(prisma.contract.findUnique).not.toHaveBeenCalled()
  })
  beforeEach(() => {
    vi.clearAllMocks()
    // Ensure env vars are unset for isolation
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
  })

  it("returns 401 when unauthenticated", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)

    const { POST } = await import("@/app/api/contracts/[id]/ask/route")

    const req = new Request("http://localhost/api/contracts/c1/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is the notice period?" }),
    })

    const res = await POST(req, { params: Promise.resolve({ id: "c1" }) })
    expect(res.status).toBe(401)
  })

  it("returns 400 when contract has no extracted text", async () => {
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "c1",
      title: "Test Contract",
      extractedText: null,
      organizationId: "org-1",
    } as any)

    const { POST } = await import("@/app/api/contracts/[id]/ask/route")

    const req = new Request("http://localhost/api/contracts/c1/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is the notice period?" }),
    })

    const res = await requestContext.run(mockCtx, () =>
      POST(req, { params: Promise.resolve({ id: "c1" }) }),
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("No extracted text available for this contract")
  })

  it("returns 404 for cross-org contract access", async () => {
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "c1",
      title: "Other Org Contract",
      extractedText: "Some text",
      organizationId: "org-2", // different org
    } as any)

    const { POST } = await import("@/app/api/contracts/[id]/ask/route")

    const req = new Request("http://localhost/api/contracts/c1/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is the governing law?" }),
    })

    const res = await requestContext.run(mockCtx, () =>
      POST(req, { params: Promise.resolve({ id: "c1" }) }),
    )
    expect(res.status).toBe(404)
  })

  it("returns 503 when no AI provider is configured", async () => {
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "c1",
      title: "Test Contract",
      extractedText: "This is the contract text.",
      organizationId: "org-1",
    } as any)

    // No API keys set (cleared in beforeEach)
    const { POST } = await import("@/app/api/contracts/[id]/ask/route")

    const req = new Request("http://localhost/api/contracts/c1/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is the notice period?" }),
    })

    const res = await requestContext.run(mockCtx, () =>
      POST(req, { params: Promise.resolve({ id: "c1" }) }),
    )
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe("No AI provider configured")
  })

  it("returns 404 when contract does not exist", async () => {
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(null)

    const { POST } = await import("@/app/api/contracts/[id]/ask/route")

    const req = new Request("http://localhost/api/contracts/missing/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What are the payment terms?" }),
    })

    const res = await requestContext.run(mockCtx, () =>
      POST(req, { params: Promise.resolve({ id: "missing" }) }),
    )
    expect(res.status).toBe(404)
  })

  it("filters chunk retrieval by the caller's organizationId (cross-tenant isolation)", async () => {
    process.env.OPENAI_API_KEY = "test-key"

    const { generateEmbedding } = await import("@/lib/embedding")
    vi.mocked(generateEmbedding).mockResolvedValueOnce(
      { vector: Array.from({ length: 1536 }, () => 0.2), model: "openai:text-embedding-3-small:1536" },
    )

    // Caller is in org-1; the contract row also lives in org-1.
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "c1",
      title: "Org-1 contract",
      extractedText: "Confidentiality applies for 5 years.",
      organizationId: "org-1",
    } as any)

    // Capture the SQL fragment passed into $queryRaw so we can assert that
    // the chunk query carries an organizationId filter — without it, an
    // attacker who guessed a contract id could pull chunks from another org.
    const queryRawSpy = vi.mocked(prisma.$queryRaw).mockImplementationOnce(((
      sql: any,
    ) => {
      // Prisma.sql produces an object with `strings` and `values`
      const stringsJoined: string = (sql?.strings ?? []).join(" ")
      const values: unknown[] = sql?.values ?? []

      expect(stringsJoined).toMatch(/JOIN\s+"Contract"/i)
      expect(stringsJoined).toMatch(/c\."organizationId"/)
      // org-1 must appear among the bound parameters; org-2 must not.
      expect(values).toContain("org-1")
      expect(values).not.toContain("org-2")

      return Promise.resolve([
        {
          chunkIndex: 0,
          text: "Confidentiality applies for 5 years.",
          similarity: 0.92,
        },
      ]) as any
    }) as any)

    global.fetch = vi.fn().mockResolvedValueOnce(Response.json({
      choices: [{ message: { content: "Five years per Excerpt 1." } }],
    }))

    const { POST } = await import("@/app/api/contracts/[id]/ask/route")
    const req = new Request("http://localhost/api/contracts/c1/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "How long does confidentiality last?" }),
    })

    const res = await requestContext.run(mockCtx, () =>
      POST(req, { params: Promise.resolve({ id: "c1" }) }),
    )

    expect(res.status).toBe(200)
    expect(queryRawSpy).toHaveBeenCalled()
  })

  it("answers using retrieved chunks and returns citations", async () => {
    process.env.OPENAI_API_KEY = "test-key"

    const { generateEmbedding } = await import("@/lib/embedding")
    vi.mocked(generateEmbedding).mockResolvedValueOnce({ vector: Array.from({ length: 1536 }, () => 0.1), model: "openai:text-embedding-3-small:1536" })

    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "c1",
      title: "Test Contract",
      extractedText: "The customer may terminate on 30 days notice.",
      organizationId: "org-1",
    } as any)
    vi.mocked(prisma.$queryRaw).mockResolvedValueOnce([
      {
        chunkIndex: 0,
        text: "The customer may terminate on 30 days notice.",
        similarity: 0.91,
      },
    ] as any)

    global.fetch = vi.fn().mockResolvedValueOnce(Response.json({
      choices: [{ message: { content: "The notice period is 30 days. See Excerpt 1." } }],
    }))

    const { POST } = await import("@/app/api/contracts/[id]/ask/route")

    const req = new Request("http://localhost/api/contracts/c1/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What is the notice period?" }),
    })

    const res = await requestContext.run(mockCtx, () =>
      POST(req, { params: Promise.resolve({ id: "c1" }) }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.answer).toContain("30 days")
    expect(body.citations).toHaveLength(1)
    expect(body.citations[0].chunkIndex).toBe(0)
    expect(body.citations[0].similarity).toBe(0.91)
  })

  it("finds a final short legal-acronym clause through the full-text fallback", async () => {
    process.env.OPENAI_API_KEY = "test-key"

    const { generateEmbedding } = await import("@/lib/embedding")
    vi.mocked(generateEmbedding).mockResolvedValueOnce(null)
    const finalClause = "IP ownership remains exclusively with Vendor."

    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "c1",
      title: "Large Contract",
      extractedText: `${"A".repeat(720_000)}\n${finalClause}`,
      organizationId: "org-1",
    } as any)

    global.fetch = vi.fn().mockResolvedValueOnce(Response.json({
      choices: [{ message: { content: "Vendor owns the IP. See Excerpt 1." } }],
    }))

    const { POST } = await import("@/app/api/contracts/[id]/ask/route")
    const req = new Request("http://localhost/api/contracts/c1/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "Who owns IP?" }),
    })

    const res = await requestContext.run(mockCtx, () =>
      POST(req, { params: Promise.resolve({ id: "c1" }) }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.citations.some((citation: { text: string }) => citation.text.includes(finalClause))).toBe(true)
  })
})
