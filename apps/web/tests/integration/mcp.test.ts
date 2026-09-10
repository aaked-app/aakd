import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@/lib/db/client"
import { resolveAuth } from "@/lib/auth/middleware"
import { createHash, randomUUID } from "node:crypto"

const mockCtx = {
  userId: "user-1",
  organizationId: "org-1",
  memberId: "member-1",
  role: "admin",
  source: "session" as const,
  requestId: "test-request-id",
}

const interactiveAiMocks = vi.hoisted(() => ({
  enqueue: vi.fn(),
  wait: vi.fn(),
  rateLimit: vi.fn(),
}))

vi.mock("@/lib/auth/middleware", () => ({
  resolveAuth: vi.fn(),
  requireWriteScope: vi.fn(() => null),
}))

vi.mock("@/lib/db/activity", () => ({
  writeActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/jobs/interactive-ai-client", () => ({
  enqueueInteractiveAiRequest: interactiveAiMocks.enqueue,
  waitForInteractiveAiRequest: interactiveAiMocks.wait,
}))
vi.mock("@/lib/rate-limit", () => ({ rateLimit: interactiveAiMocks.rateLimit }))

// Helper: build a JSON-RPC 2.0 POST request
function mcpRequest(method: string, params?: unknown) {
  return new Request("http://localhost/api/mcp", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer cf_live_test" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  })
}

// Restore resolveAuth to default authenticated context before each test
beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(resolveAuth).mockResolvedValue(mockCtx)
  vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValue({ id: "grant-1" } as never)
  interactiveAiMocks.enqueue.mockResolvedValue({ state: "completed", jobId: "00000000-0000-4000-8000-000000000001", response: { status: 200, body: {} } })
  interactiveAiMocks.wait.mockResolvedValue({ state: "completed", jobId: "00000000-0000-4000-8000-000000000001", response: { status: 200, body: { answer: "Complete" } } })
  interactiveAiMocks.rateLimit.mockResolvedValue({ allowed: true, retryAfter: 0 })
})

describe("GET /api/mcp — discovery", () => {
  it("returns 401 when no auth is provided", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)

    const { GET } = await import("@/app/api/mcp/route")
    const res = await GET(new Request("http://localhost/api/mcp"))

    expect(res.status).toBe(401)
  })

  it("returns MCP discovery metadata and tool list", async () => {
    const { GET } = await import("@/app/api/mcp/route")
    const res = await GET(new Request("http://localhost/api/mcp"))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe("Aakd MCP")
    expect(body.protocol).toBe("json-rpc-2.0")
    expect(body.endpoint).toBe("/api/mcp")
    expect(body.organizationId).toBeUndefined()
    expect(body.tools).toHaveLength(17)
  })
})

describe("POST /api/mcp — authentication", () => {
  it("returns 401 when no auth is provided", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    )

    expect(res.status).toBe(401)
  })
})

describe("POST /api/mcp — tools/call get_action", () => {
  const action = {
    id: "action-1", contractId: "contract-1", kind: "OBLIGATION", title: "Send report",
    description: null, condition: "Section 4", dueDate: null, noticeDate: null, assigneeId: "user-1",
    sourceText: "Confidential source excerpt", sourcePage: 3, confidence: 0.9, reviewStatus: "reviewed",
    status: "PROPOSED", evidenceRequired: "completion_note", acknowledgedAt: null, completedAt: null,
    staleAt: null, version: 1, createdAt: new Date("2026-08-18"), updatedAt: new Date("2026-08-18"),
    contract: { id: "contract-1", title: "Northwind", counterpartyName: "Northwind" },
    assignee: { id: "user-1", name: "Owner", email: "owner@example.test" },
    evidence: [], deliveries: [], activities: [], approvals: [], _count: { evidence: 0, deliveries: 0 },
  }

  it("returns minimized detail without raw text for an API key lacking text_read", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce({ ...mockCtx, source: "api_key", scopes: ["read"] })
    vi.mocked(prisma.contractAction.findFirst).mockResolvedValueOnce(action as never)
    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(mcpRequest("tools/call", { name: "get_action", arguments: { actionId: "action-1" } }))
    const data = JSON.parse((await res.json()).result.content[0].text)

    expect(data.sourceText).toBeUndefined()
    expect(data.assignee).toEqual({ id: "user-1", name: "Owner" })
    expect(data.sourcePage).toBe(3)
  })

  it("returns the source excerpt to an authorized human session", async () => {
    vi.mocked(prisma.contractAction.findFirst).mockResolvedValueOnce(action as never)
    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(mcpRequest("tools/call", { name: "get_action", arguments: { actionId: "action-1" } }))
    const data = JSON.parse((await res.json()).result.content[0].text)
    expect(data.sourceText).toBe("Confidential source excerpt")
  })
})

describe("POST /api/mcp — tools/list", () => {
  it("advertises read tools and governed action proposals without legacy mutations", async () => {
    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(mcpRequest("tools/list"))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.jsonrpc).toBe("2.0")
    expect(body.id).toBe(1)
    expect(body.result.tools).toHaveLength(17)

    const names = body.result.tools.map((t: { name: string }) => t.name)
    expect(names).toContain("search_contracts")
    expect(names).toContain("get_contract")
    expect(names).not.toContain("create_contract")
    expect(names).toContain("list_contracts")
    expect(names).toContain("semantic_search")
    expect(names).toContain("ask_contract")
    expect(names).toContain("get_ai_request")
    expect(names).toContain("list_obligations")
    expect(names).not.toContain("create_obligation")
    expect(names).not.toContain("update_obligation")
    expect(names).toContain("list_actions")
    expect(names).toContain("get_action")
    expect(names).toContain("preview_action_proposal")
    expect(names).toContain("propose_action")
    expect(names).toContain("preview_action_approval_request")
    expect(names).toContain("request_action_approval")
    expect(names).toContain("get_analytics_summary")
    expect(names).toContain("list_crm_links")
    expect(names).toContain("list_import_jobs")
    expect(names).toContain("get_import_job")
  })

  it("each tool has name, description, and inputSchema", async () => {
    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(mcpRequest("tools/list"))
    const body = await res.json()

    for (const tool of body.result.tools) {
      expect(tool).toHaveProperty("name")
      expect(tool).toHaveProperty("description")
      expect(tool).toHaveProperty("inputSchema")
      expect(tool.inputSchema).toHaveProperty("type", "object")
    }
  })
})

describe("POST /api/mcp — governed action proposal response", () => {
  const sourceText = "Provider shall deliver the monthly report by Friday."
  const excerpt = "Provider shall deliver the monthly report"
  const sourceHash = createHash("sha256").update(sourceText).digest("hex")
  const excerptHash = createHash("sha256").update(excerpt).digest("hex")
  const args = () => ({
    contractId: "contract-1",
    kind: "OBLIGATION",
    title: "Deliver monthly report",
    source: { fileId: "file-1", fileVersion: 2, page: null, excerpt, excerptHash },
    idempotencyKey: randomUUID(),
  })

  it("denies a metadata-only key before contract reads or mutation", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce({
      ...mockCtx,
      source: "api_key",
      apiKeyId: "key-1",
      scopes: ["read"],
    })
    const { POST } = await import("@/app/api/mcp/route")
    const response = await POST(mcpRequest("tools/call", { name: "preview_action_proposal", arguments: args() }))
    const body = await response.json()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("action_propose_forbidden")
    expect(prisma.contract.findFirst).not.toHaveBeenCalled()
    expect(prisma.contractAction.create).not.toHaveBeenCalled()
  })

  it("returns a bounded, attributable preview without raw principal or idempotency identity", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce({
      ...mockCtx,
      source: "api_key",
      apiKeyId: "key-secret-id",
      scopes: ["read", "text_read", "action_propose"],
    })
    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce({
      id: "contract-1",
      extractedText: sourceText,
      extractedSourceFileId: "file-1",
      extractedSourceFileVersion: 2,
      extractedSourceHash: sourceHash,
      files: [{ id: "file-1", version: 2 }],
    } as never)
    const input = args()
    const { POST } = await import("@/app/api/mcp/route")
    const response = await POST(mcpRequest("tools/call", { name: "preview_action_proposal", arguments: input }))
    const body = await response.json()
    const data = JSON.parse(body.result.content[0].text)
    expect(body.result.isError).not.toBe(true)
    expect(data).toMatchObject({
      policy: "human_review_required",
      sourceFreshness: "current",
      provenance: { principalType: "api_key", fileVersion: 2, sourcePage: null, citationHash: excerptHash },
      disclosure: { sensitivity: "not_classified", sourceExcerptIncluded: true, rawPrincipalId: false, rawApiKey: false },
    })
    expect(data.proposal.idempotencyKey).toBeUndefined()
    expect(JSON.stringify(data)).not.toContain(input.idempotencyKey)
    expect(JSON.stringify(data)).not.toContain("key-secret-id")
    expect(prisma.contractAction.create).not.toHaveBeenCalled()
  })
})

describe("POST /api/mcp — tools/call search_contracts", () => {
  it("returns matching results for a short query (ILIKE path)", async () => {
    const mockContracts = [
      {
        id: "c1",
        title: "AB NDA",
        contractType: "NDA",
        status: "ACTIVE",
        counterpartyName: "Acme",
        value: 5000,
        currency: "USD",
        endDate: null,
        createdAt: new Date("2024-01-01"),
      },
    ]

    vi.mocked(prisma.contract.findMany).mockResolvedValue(mockContracts as any)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "search_contracts", arguments: { query: "AB" } }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.content[0].type).toBe("text")
    expect(body.result.isError).toBeUndefined()

    const data = JSON.parse(body.result.content[0].text)
    expect(data.results).toHaveLength(1)
    expect(data.results[0].id).toBe("c1")
  })

  it("returns matching results for a longer query (FTS path)", async () => {
    const mockRows = [
      {
        id: "c2",
        title: "Service Agreement",
        contractType: "MSA",
        status: "DRAFT",
        counterpartyName: "Vendor Corp",
        value: null,
        currency: "USD",
        endDate: null,
        createdAt: new Date("2024-03-01"),
      },
    ]

    vi.mocked(prisma.$queryRaw as any).mockResolvedValue(mockRows)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", {
        name: "search_contracts",
        arguments: { query: "service agreement", limit: 5 },
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    const data = JSON.parse(body.result.content[0].text)
    expect(data.results).toHaveLength(1)
    expect(data.count).toBe(1)
  })

  it("returns isError:true for missing required query argument", async () => {
    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "search_contracts", arguments: {} }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.isError).toBe(true)
  })
})

describe("POST /api/mcp — tools/call get_contract", () => {
  it("returns contract data for a valid ID in the same org", async () => {
    const mockContract = {
      id: "c1",
      title: "My NDA",
      contractType: "NDA",
      status: "ACTIVE",
      organizationId: "org-1",
      counterpartyName: "Acme",
      value: 10000,
      currency: "USD",
      owner: { id: "user-1", name: "Alice", email: "alice@example.com" },
      tags: [],
      files: [],
      extractions: [],
    }

    vi.mocked(prisma.contract.findUnique).mockResolvedValue(mockContract as any)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "get_contract", arguments: { id: "c1" } }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.isError).toBeUndefined()

    const data = JSON.parse(body.result.content[0].text)
    expect(data.id).toBe("c1")
    expect(data.title).toBe("My NDA")
  })

  it("does not expose the full extracted contract text", async () => {
    vi.mocked(prisma.contract.findUnique).mockResolvedValue({
      id: "c1",
      title: "Private NDA",
      organizationId: "org-1",
      extractedText: "CONFIDENTIAL FULL CONTRACT BODY",
      owner: null,
      tags: [],
      files: [],
      extractions: [],
    } as any)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "get_contract", arguments: { id: "c1" } }),
    )
    const body = await res.json()
    expect(body.result.content[0].text).not.toContain("CONFIDENTIAL FULL CONTRACT BODY")
  })

  it("does not expose raw extraction values or source excerpts in contract detail", async () => {
    vi.mocked(prisma.contract.findUnique).mockResolvedValue({
      id: "c1",
      title: "Private NDA",
      organizationId: "org-1",
      owner: null,
      tags: [],
      files: [],
      extractions: [
        {
          id: "x1",
          field: "renewalDate",
          rawValue: "2030-01-01",
          sourceText: "CONFIDENTIAL RENEWAL CLAUSE",
          confidence: 0.99,
          sourcePage: 4,
          extractedBy: "AI",
          status: "PENDING",
        },
      ],
    } as any)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "get_contract", arguments: { id: "c1" } }),
    )
    const body = await res.json()
    const text = body.result.content[0].text as string
    expect(text).not.toContain("2030-01-01")
    expect(text).not.toContain("CONFIDENTIAL RENEWAL CLAUSE")
    expect(text).toContain('"sourcePage": 4')
  })

  it("omits notes and provider signing identifiers from metadata-only API keys", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce({
      ...mockCtx,
      source: "api_key",
      apiKeyId: "key-1",
      scopes: ["read"],
    })
    vi.mocked(prisma.contract.findUnique).mockResolvedValue({
      id: "c1",
      title: "Private NDA",
      organizationId: "org-1",
      notes: "Internal negotiation notes",
      docusealSubmissionId: "provider-submission-1",
      signingUrl: "https://signing.example.test/private",
      owner: null,
      tags: [],
      files: [],
      extractions: [],
    } as any)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(mcpRequest("tools/call", { name: "get_contract", arguments: { id: "c1" } }))
    const data = JSON.parse((await res.json()).result.content[0].text)

    expect(data.notes).toBeUndefined()
    expect(data.docusealSubmissionId).toBeUndefined()
    expect(data.signingUrl).toBeUndefined()
  })

  it("never advertises or calls legacy MCP mutation names", async () => {
    const { POST } = await import("@/app/api/mcp/route")
    for (const name of ["create_contract", "create_obligation", "update_obligation"]) {
      const res = await POST(mcpRequest("tools/call", { name, arguments: {} }))
      const body = await res.json()
      expect(body.result.isError).toBe(true)
      expect(body.result.content[0].text).toContain("Unknown tool")
    }
  })

  it("returns isError:true when contract belongs to a different org", async () => {
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValueOnce(null)
    const mockContract = {
      id: "c2",
      title: "Other Org Contract",
      organizationId: "org-2", // different org
      owner: { id: "user-2", name: "Bob", email: "bob@example.com" },
      tags: [],
      files: [],
      extractions: [],
    }

    vi.mocked(prisma.contract.findFirst).mockResolvedValue(mockContract as any)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "get_contract", arguments: { id: "c2" } }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.isError).toBe(true)
    // Must not reveal the contract exists — same message as "not found"
    expect(body.result.content[0].text).toMatch(/not found/i)
  })

  it("returns isError:true when contract does not exist", async () => {
    vi.mocked(prisma.contract.findUnique).mockResolvedValue(null)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "get_contract", arguments: { id: "ghost" } }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toMatch(/not found/i)
  })
})

describe("POST /api/mcp — text access boundary", () => {
  it("rejects contract Q&A for an API key without the text_read scope", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce({
      ...mockCtx,
      source: "api_key" as const,
      scopes: ["read"],
    })
    vi.mocked(prisma.contract.findUnique).mockClear()

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", {
        name: "ask_contract",
        arguments: { contractId: "c1", question: "What is the notice period?" },
      }),
    )

    const body = await res.json()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toMatch(/text_read/i)
    expect(prisma.contract.findUnique).not.toHaveBeenCalled()
  })

  it("does not leak tenant or private fields from obligation reads", async () => {
    vi.mocked(prisma.contract.findUnique).mockResolvedValue({ id: "c1", organizationId: "org-1" } as any)
    vi.mocked(prisma.contractObligation.findMany).mockResolvedValue([
      {
        id: "obl-1",
        contractId: "c1",
        organizationId: "org-1",
        title: "Send report",
        description: "Internal details",
        clauseReference: "4.2",
        priority: "HIGH",
        status: "PENDING",
        dueDate: new Date("2025-12-31"),
        assignee: { id: "user-2", name: "Bob", email: "bob@example.com" },
        createdBy: { id: "user-1", name: "Alice", email: "alice@example.com" },
        subTasks: [],
      },
    ] as any)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "list_obligations", arguments: { contractId: "c1" } }),
    )
    const text = (await res.json()).result.content[0].text as string
    expect(text).toContain('"title": "Send report"')
    expect(text).not.toContain('"organizationId"')
    expect(text).not.toContain("bob@example.com")
    expect(text).not.toContain("alice@example.com")
  })

  it("does not expose import storage keys or mappings", async () => {
    vi.mocked(prisma.importJob.findUnique).mockResolvedValue({
      id: "job-1",
      organizationId: "org-1",
      source: "CSV",
      status: "COMPLETED",
      storageKey: "private/source.csv",
      driveFileIds: "private-drive-id",
      mappingJson: "{\"title\":\"A\"}",
      errorReportKey: "private/errors.csv",
      totalRows: 1,
      succeededRows: 1,
      failedRows: 0,
      startedAt: new Date("2025-03-01"),
      completedAt: new Date("2025-03-01"),
      createdAt: new Date("2025-03-01"),
      createdById: "user-1",
      createdBy: { id: "user-1", name: "Alice", email: "alice@example.com" },
    } as any)
    vi.mocked(prisma.importRow.findMany).mockResolvedValue([])

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "get_import_job", arguments: { jobId: "job-1" } }),
    )
    const text = (await res.json()).result.content[0].text as string
    expect(text).toContain('"id": "job-1"')
    expect(text).not.toContain("private/source.csv")
    expect(text).not.toContain("private-drive-id")
    expect(text).not.toContain("mappingJson")
    expect(text).not.toContain("organizationId")
    expect(text).not.toContain("alice@example.com")
  })
})

describe("POST /api/mcp — durable AI continuation", () => {
  const jobId = "00000000-0000-4000-8000-000000000001"

  it("returns a structured pending receipt and polls the same job without re-enqueueing", async () => {
    interactiveAiMocks.enqueue.mockResolvedValueOnce({ state: "pending", jobId })
    interactiveAiMocks.wait
      .mockResolvedValueOnce({ state: "pending", jobId })
      .mockResolvedValueOnce({ state: "completed", jobId, response: { status: 200, body: { results: [], total: 0, mode: "keyword" } } })
    const { POST } = await import("@/app/api/mcp/route")

    const started = await POST(mcpRequest("tools/call", {
      name: "semantic_search",
      arguments: { query: "renewal" },
    }))
    const startedBody = await started.json()
    expect(startedBody.result.isError).toBeUndefined()
    expect(JSON.parse(startedBody.result.content[0].text)).toEqual({
      status: "pending",
      jobId,
      next: { tool: "get_ai_request", arguments: { jobId } },
    })

    const firstPoll = await POST(mcpRequest("tools/call", { name: "get_ai_request", arguments: { jobId } }))
    expect(JSON.parse((await firstPoll.json()).result.content[0].text).status).toBe("pending")
    const secondPoll = await POST(mcpRequest("tools/call", { name: "get_ai_request", arguments: { jobId } }))
    expect(JSON.parse((await secondPoll.json()).result.content[0].text)).toEqual({ results: [], total: 0, mode: "keyword" })
    expect(interactiveAiMocks.enqueue).toHaveBeenCalledOnce()
    expect(interactiveAiMocks.wait).toHaveBeenCalledTimes(2)
  })

  it("rejects malformed and inaccessible pending job identities without polling or leaking data", async () => {
    const { POST } = await import("@/app/api/mcp/route")
    const malformed = await POST(mcpRequest("tools/call", { name: "get_ai_request", arguments: { jobId: "not-a-uuid" } }))
    expect((await malformed.json()).result.isError).toBe(true)
    expect(interactiveAiMocks.wait).not.toHaveBeenCalled()

    interactiveAiMocks.wait.mockResolvedValueOnce(null)
    const inaccessible = await POST(mcpRequest("tools/call", { name: "get_ai_request", arguments: { jobId } }))
    const body = await inaccessible.json()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toMatch(/not found/i)
    expect(body.result.content[0].text).not.toContain("answer")
  })

  it("shares the semantic-search budget and does not enqueue when over limit", async () => {
    interactiveAiMocks.rateLimit.mockResolvedValueOnce({ allowed: false, retryAfter: 17 })
    const { POST } = await import("@/app/api/mcp/route")
    const response = await POST(mcpRequest("tools/call", { name: "semantic_search", arguments: { query: "renewal" } }))
    const body = await response.json()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("retry after 17s")
    expect(interactiveAiMocks.rateLimit).toHaveBeenCalledWith("org-1:semantic-search", 30, 60_000)
    expect(interactiveAiMocks.enqueue).not.toHaveBeenCalled()
  })

  it("fails closed without enqueueing when the MCP semantic limiter is unavailable", async () => {
    interactiveAiMocks.rateLimit.mockRejectedValueOnce(new Error("private limiter detail"))
    const { POST } = await import("@/app/api/mcp/route")
    const response = await POST(mcpRequest("tools/call", { name: "semantic_search", arguments: { query: "renewal" } }))
    const body = await response.json()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toContain("Semantic search unavailable")
    expect(body.result.content[0].text).not.toContain("private limiter detail")
    expect(interactiveAiMocks.enqueue).not.toHaveBeenCalled()
  })
})

describe("POST /api/mcp — tools/call list_contracts", () => {
  it("returns contracts with pagination metadata", async () => {
    const mockContracts = [
      {
        id: "c1",
        title: "NDA 1",
        status: "ACTIVE",
        organizationId: "org-1",
        owner: { id: "user-1", name: "Alice", email: "alice@example.com" },
        tags: [],
      },
      {
        id: "c2",
        title: "MSA 2",
        status: "DRAFT",
        organizationId: "org-1",
        owner: { id: "user-1", name: "Alice", email: "alice@example.com" },
        tags: [],
      },
    ]

    vi.mocked(prisma.contract.findMany).mockResolvedValue(mockContracts as any)
    vi.mocked(prisma.contract.count as any).mockResolvedValue(2)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", {
        name: "list_contracts",
        arguments: { limit: 20, page: 1 },
      }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.isError).toBeUndefined()

    const data = JSON.parse(body.result.content[0].text)
    expect(data.contracts).toHaveLength(2)
    expect(data.total).toBe(2)
    expect(data.page).toBe(1)
  })

  it("does not expose extracted contract text or tenant identifiers", async () => {
    vi.mocked(prisma.contract.findMany).mockResolvedValue([
      {
        id: "c1",
        title: "NDA",
        status: "ACTIVE",
        organizationId: "org-1",
        extractedText: "CONFIDENTIAL FULL CONTRACT BODY",
        owner: null,
        tags: [],
      },
    ] as any)
    vi.mocked(prisma.contract.count as any).mockResolvedValue(1)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "list_contracts", arguments: { limit: 20, page: 1 } }),
    )
    await res.json()

    const query = vi.mocked(prisma.contract.findMany).mock.calls.at(-1)?.[0] as {
      select?: Record<string, unknown>
    }
    expect(query.select).toBeDefined()
    expect(query.select).not.toHaveProperty("extractedText")
    expect(query.select).not.toHaveProperty("organizationId")
  })

  it("applies status filter when provided", async () => {
    vi.mocked(prisma.contract.findMany).mockResolvedValue([])
    vi.mocked(prisma.contract.count as any).mockResolvedValue(0)

    const { POST } = await import("@/app/api/mcp/route")
    await POST(
      mcpRequest("tools/call", {
        name: "list_contracts",
        arguments: { status: "ACTIVE" },
      }),
    )

    expect(prisma.contract.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          AND: [
            { organizationId: "org-1" },
            { accessGrants: { some: { organizationId: "org-1", memberId: "member-1" } } },
            { status: "ACTIVE" },
          ],
        },
      }),
    )
  })
})

describe("POST /api/mcp — error handling", () => {
  it("returns -32601 error for an unknown method", async () => {
    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(mcpRequest("tools/unknown_method"))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.jsonrpc).toBe("2.0")
    expect(body.id).toBe(1)
    expect(body.error.code).toBe(-32601)
    expect(body.error.message).toMatch(/method not found/i)
  })

  it("returns isError:true for an unknown tool name", async () => {
    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "nonexistent_tool", arguments: {} }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toMatch(/unknown tool/i)
  })

  it("returns 202 for a JSON-RPC notification (no id)", async () => {
    // In JSON-RPC 2.0, a message without an `id` is a notification. The server
    // must NOT return a response body — 202 is the correct acknowledgement.
    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "tools/list" }), // no id → notification
      }),
    )

    expect(res.status).toBe(202)
  })
})

// ---------------------------------------------------------------------------
// MCP protocol — initialize + ping
// ---------------------------------------------------------------------------

describe("POST /api/mcp — initialize", () => {
  it("supports the standard Claude/Codex-style handshake sequence", async () => {
    const { POST } = await import("@/app/api/mcp/route")

    const initialize = await POST(mcpRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "compatibility-fixture", version: "1.0.0" },
    }))
    expect(initialize.status).toBe(200)
    expect((await initialize.json()).result.protocolVersion).toBe("2024-11-05")

    const initialized = await POST(new Request("http://localhost/api/mcp", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer cf_live_test" },
      body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
    }))
    expect(initialized.status).toBe(202)

    const tools = await POST(mcpRequest("tools/list"))
    expect(tools.status).toBe(200)
    expect((await tools.json()).result.tools.length).toBeGreaterThan(0)

    const ping = await POST(mcpRequest("ping"))
    expect(ping.status).toBe(200)
    expect((await ping.json()).result).toEqual({})
  })

  it("returns protocolVersion, capabilities, and serverInfo", async () => {
    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(mcpRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "test-client", version: "0.0.1" },
    }))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.jsonrpc).toBe("2.0")
    expect(body.result.protocolVersion).toBe("2024-11-05")
    expect(body.result.capabilities).toHaveProperty("tools")
    expect(body.result.serverInfo.name).toBe("Aakd MCP")
  })

  it("returns 202 for notifications/initialized (no id)", async () => {
    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      new Request("http://localhost/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer cf_live_test" },
        body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }), // no id
      }),
    )

    expect(res.status).toBe(202)
  })

  it("returns empty result for ping", async () => {
    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(mcpRequest("ping"))

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// M7: obligations tools
// ---------------------------------------------------------------------------

describe("POST /api/mcp — tools/call list_obligations", () => {
  it("returns obligations for a valid contract in the same org", async () => {
    const mockContract = { id: "c1", organizationId: "org-1" }
    const mockObligations = [
      {
        id: "obl-1",
        contractId: "c1",
        title: "Pay invoice",
        status: "PENDING",
        priority: "HIGH",
        dueDate: new Date("2025-12-31"),
        assignee: null,
        createdBy: { id: "user-1", name: "Alice" },
        subTasks: [],
      },
    ]

    vi.mocked(prisma.contract.findUnique).mockResolvedValue(mockContract as any)
    vi.mocked(prisma.contractObligation.findMany).mockResolvedValue(mockObligations as any)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "list_obligations", arguments: { contractId: "c1" } }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.isError).toBeUndefined()
    const data = JSON.parse(body.result.content[0].text)
    expect(data.obligations).toHaveLength(1)
    expect(data.count).toBe(1)
  })

  it("returns isError:true when contract belongs to a different org", async () => {
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValueOnce(null)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "list_obligations", arguments: { contractId: "c2" } }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toMatch(/not found/i)
  })

  it("returns isError:true when contractId is missing", async () => {
    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "list_obligations", arguments: {} }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// M8: analytics
// ---------------------------------------------------------------------------

describe("POST /api/mcp — tools/call get_analytics_summary", () => {
  it("returns all expected analytics fields", async () => {
    // Mock the five parallel prisma calls
    vi.mocked(prisma.contract.count)
      .mockResolvedValueOnce(2)  // next30
      .mockResolvedValueOnce(4)  // next60
      .mockResolvedValueOnce(6)  // next90
    vi.mocked(prisma.contract.findMany).mockResolvedValue([])
    vi.mocked(prisma.contract.groupBy as any)
      .mockResolvedValueOnce([{ status: "ACTIVE", _count: { _all: 10 } }])
      .mockResolvedValueOnce([]) // valueByType
    vi.mocked(prisma.$queryRaw as any).mockResolvedValue([])
    vi.mocked(prisma.approval.count as any)
      .mockResolvedValueOnce(5)  // totalRequested
      .mockResolvedValueOnce(3)  // approved
      .mockResolvedValueOnce(1)  // rejected
    vi.mocked(prisma.contractObligation.count as any)
      .mockResolvedValueOnce(2)  // overdue
      .mockResolvedValueOnce(3)  // dueSoon

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "get_analytics_summary", arguments: {} }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.isError).toBeUndefined()
    const data = JSON.parse(body.result.content[0].text)
    expect(data).toHaveProperty("expiringSoon")
    expect(data).toHaveProperty("byStatus")
    expect(data).toHaveProperty("monthlyVolume")
    expect(data).toHaveProperty("valueByType")
    expect(data).toHaveProperty("approvalFunnel")
    expect(data).toHaveProperty("obligations")
  })
})

// ---------------------------------------------------------------------------
// M9: CRM links
// ---------------------------------------------------------------------------

describe("POST /api/mcp — tools/call list_crm_links", () => {
  it("returns CRM links for a contract", async () => {
    const mockContract = { id: "c1", organizationId: "org-1" }
    const mockLinks = [
      {
        id: "link-1",
        provider: "HUBSPOT",
        externalDealId: "hs-123",
        externalDealName: "Deal A",
        externalDealUrl: null,
        lastSyncedAt: null,
        lastSyncStatus: null,
        createdAt: new Date("2025-01-01"),
      },
    ]

    vi.mocked(prisma.contract.findUnique).mockResolvedValue(mockContract as any)
    vi.mocked(prisma.crmLink.findMany).mockResolvedValue(mockLinks as any)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "list_crm_links", arguments: { contractId: "c1" } }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.isError).toBeUndefined()
    const data = JSON.parse(body.result.content[0].text)
    expect(data.links).toHaveLength(1)
    expect(data.count).toBe(1)
  })

  it("returns isError:true when contract belongs to a different org", async () => {
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.contract.findFirst).mockResolvedValue({
      id: "c-other",
      organizationId: "org-2",
    } as any)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "list_crm_links", arguments: { contractId: "c-other" } }),
    )

    const body = await res.json()
    expect(body.result.isError).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// M10: import jobs
// ---------------------------------------------------------------------------

describe("POST /api/mcp — tools/call list_import_jobs", () => {
  it("rejects viewers before querying import jobs", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce({ ...mockCtx, role: "viewer" })
    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(mcpRequest("tools/call", { name: "list_import_jobs", arguments: {} }))
    const body = await res.json()
    expect(body.result.isError).toBe(true)
    expect(prisma.importJob.findMany).not.toHaveBeenCalled()
  })

  it("returns import jobs with pagination metadata", async () => {
    const mockJobs = [
      {
        id: "job-1",
        source: "CSV",
        status: "COMPLETED",
        totalRows: 50,
        succeededRows: 48,
        failedRows: 2,
        createdAt: new Date("2025-03-01"),
        completedAt: new Date("2025-03-01"),
        createdBy: { id: "user-1", name: "Alice" },
      },
    ]

    vi.mocked(prisma.$queryRaw).mockResolvedValue(mockJobs.map((job) => ({
      ...job,
      createdById: job.createdBy.id,
      createdByName: job.createdBy.name,
      accessibleTotal: BigInt(1),
    })) as never)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "list_import_jobs", arguments: {} }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.isError).toBeUndefined()
    const data = JSON.parse(body.result.content[0].text)
    expect(data.jobs).toHaveLength(1)
    expect(data.total).toBe(1)
  })
})

describe("POST /api/mcp — tools/call get_import_job", () => {
  it("returns summary rows but redacts source references and errors without text_read", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce({ ...mockCtx, source: "api_key", scopes: ["read"] })
    vi.mocked(prisma.importJob.findUnique).mockResolvedValueOnce({
      id: "job-1", organizationId: "org-1", source: "CSV", status: "COMPLETED", totalRows: 1,
      succeededRows: 0, failedRows: 1, createdAt: new Date("2025-03-01"), completedAt: new Date("2025-03-01"), createdById: "user-1", createdBy: null,
    } as any)
    const failedRow = [
      { id: "row-1", rowIndex: 1, sourceRef: "CONFIDENTIAL SOURCE", status: "failed", errorMessage: "SECRET ERROR", contractId: null },
    ]
    vi.mocked(prisma.importRow.findMany).mockResolvedValueOnce(failedRow as any).mockResolvedValueOnce(failedRow as any)
    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(mcpRequest("tools/call", { name: "get_import_job", arguments: { jobId: "job-1" } }))
    const text = (await res.json()).result.content[0].text as string
    expect(text).toContain('"status": "failed"')
    expect(text).not.toContain("CONFIDENTIAL SOURCE")
    expect(text).not.toContain("SECRET ERROR")
  })

  it("rejects viewers before querying import details", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce({ ...mockCtx, role: "viewer" })
    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(mcpRequest("tools/call", { name: "get_import_job", arguments: { jobId: "job-1" } }))
    const body = await res.json()
    expect(body.result.isError).toBe(true)
    expect(prisma.importJob.findUnique).not.toHaveBeenCalled()
  })

  it("returns job details and rows", async () => {
    const mockJob = {
      id: "job-1",
      organizationId: "org-1",
      source: "CSV",
      status: "COMPLETED",
      totalRows: 3,
      succeededRows: 3,
      failedRows: 0,
      createdById: "user-1",
      createdAt: new Date("2025-03-01"),
      completedAt: new Date("2025-03-01"),
      createdBy: { id: "user-1", name: "Alice" },
    }

    vi.mocked(prisma.importJob.findUnique).mockResolvedValue(mockJob as any)
    vi.mocked(prisma.importRow.findMany).mockResolvedValue([])

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "get_import_job", arguments: { jobId: "job-1" } }),
    )

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.result.isError).toBeUndefined()
    const data = JSON.parse(body.result.content[0].text)
    expect(data.job.id).toBe("job-1")
    expect(data.rows).toBeDefined()
  })

  it("returns isError:true when job belongs to a different org", async () => {
    vi.mocked(prisma.importJob.findUnique).mockResolvedValue({
      id: "job-other",
      organizationId: "org-2",
    } as any)

    const { POST } = await import("@/app/api/mcp/route")
    const res = await POST(
      mcpRequest("tools/call", { name: "get_import_job", arguments: { jobId: "job-other" } }),
    )

    const body = await res.json()
    expect(body.result.isError).toBe(true)
    expect(body.result.content[0].text).toMatch(/not found/i)
  })
})
