/**
 * Miscellaneous Routes Integration Tests
 *
 * Covers:
 *  - GET/POST  /api/contracts/[id]/risk-score
 *  - POST      /api/contracts/[id]/extractions/rerun
 *  - POST      /api/contracts/extract-preview
 *  - POST/DELETE /api/org/invitations/[id]  (resend + revoke)
 *  - POST      /api/org/invitations/[id]/accept
 *  - GET/POST  /api/org/logo
 *  - GET/POST  /api/user/avatar
 *  - GET/PATCH /api/user/locale
 *  - POST      /api/import/clm-export
 *  - POST      /api/import/gdrive/import
 *  - GET       /api/import
 *  - POST      /api/crm/[provider]/sync/[contractId]
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { prisma } from "@/lib/db/client"

// ─── Module mocks (must be hoisted before imports) ────────────────────────────

vi.mock("@/lib/auth/middleware", () => ({
  resolveAuth: vi.fn(),
  requireWriteScope: vi.fn(() => null),
}))

vi.mock("@/lib/db/activity", () => ({
  writeActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/context", () => ({
  requestContext: { run: vi.fn((_ctx: unknown, fn: () => unknown) => fn()) },
}))

vi.mock("@/lib/storage", () => ({
  storage: {
    upload: vi.fn().mockResolvedValue("some/storage/key"),
    getSignedDownloadUrl: vi.fn().mockResolvedValue("https://s3.example.com/logo.png"),
    storageKey: vi.fn((_org: string, _id: string, filename: string) => filename),
    delete: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock("@/lib/types/import-queue", () => ({
  enqueueImportProcess: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/crm", () => ({
  getCrmProvider: vi.fn(),
}))

vi.mock("@/lib/crm/route-helpers", () => ({
  normalizeProvider: vi.fn((raw: string | undefined) => {
    if (!raw) return null
    const upper = raw.toUpperCase()
    return ["HUBSPOT", "SALESFORCE", "PIPEDRIVE"].includes(upper) ? upper : null
  }),
  getRedirectUri: vi.fn(
    (p: string) => `http://localhost:3000/api/crm/${p.toLowerCase()}/callback`,
  ),
  ensureFreshToken: vi.fn(),
}))

// AI resolve — returns no-provider by default so risk-score gets 503
vi.mock("@/lib/ai/resolve", () => ({
  resolveAiConfig: vi.fn().mockResolvedValue({
    provider: null,
    apiKey: null,
    model: null,
    source: null,
  }),
}))

// Email sender — fire-and-forget; avoid real SMTP
vi.mock("@/lib/email/invitation", () => ({
  sendInvitationEmail: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/utils/fire-and-log", () => ({
  fireAndLog: vi.fn((_p: unknown) => undefined),
}))

// pdf-parse crashes at module load time if its test fixture is absent.
// Mock it here so the extract-preview route module can be imported cleanly.
vi.mock("pdf-parse", () => ({
  default: vi.fn().mockResolvedValue({ text: "Extracted PDF text" }),
}))

// mammoth — mock to avoid binary loading
vi.mock("mammoth", () => ({
  extractRawText: vi.fn().mockResolvedValue({ value: "Extracted DOCX text" }),
}))

// isZipBuffer — mock to control zip validation in CLM export tests
vi.mock("@/lib/types/import-helpers", async (importOriginal) => {
  const actual = await importOriginal() as Record<string, unknown>
  return {
    ...actual,
    isZipBuffer: vi.fn(),
  }
})

// ─── Helper imports ────────────────────────────────────────────────────────────

import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { getCrmProvider } from "@/lib/crm"
import { ensureFreshToken } from "@/lib/crm/route-helpers"
import { enqueueImportProcess } from "@/lib/types/import-queue"
import { isZipBuffer } from "@/lib/types/import-helpers"

function resetMockQueues() {
  vi.mocked(resolveAuth).mockReset()
  vi.mocked(requireWriteScope).mockReturnValue(null)
  vi.mocked(ensureFreshToken).mockReset()
  vi.mocked(getCrmProvider).mockReset()
  vi.mocked(enqueueImportProcess).mockResolvedValue(undefined)
  vi.mocked(isZipBuffer).mockReturnValue(false) // conservative default
}

const adminCtx = {
  userId: "user-admin",
  organizationId: "org-1",
  role: "admin",
  source: "session" as const,
  requestId: "req-test",
}
const legalCtx = { ...adminCtx, role: "legal" }
const memberCtx = { ...adminCtx, role: "member" }
const viewerCtx = { ...adminCtx, role: "viewer" }

/**
 * jsdom's FormData serialization is not compatible with Node/undici's
 * multipart boundary parser — calling req.formData() on a jsdom-constructed
 * Request throws. Work around by replacing formData() with a function that
 * returns our controlled FormData directly.
 */
function makeFormRequest(url: string, fd: FormData, method = "POST"): Request {
  const req = new Request(url, { method, body: "" })
  Object.defineProperty(req, "formData", {
    value: () => Promise.resolve(fd),
    writable: true,
  })
  return req
}

// ─── GET /api/contracts/[id]/risk-score ───────────────────────────────────────

describe("GET /api/contracts/[id]/risk-score", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockQueues() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/risk-score/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/risk-score"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 when contract not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/risk-score/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/risk-score"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns risk score fields when contract exists", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce({
      riskScore: "HIGH",
      riskScoredAt: new Date("2025-01-01"),
      riskDetails: { overall: "HIGH" },
    } as any)
    const { GET } = await import("@/app/api/contracts/[id]/risk-score/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/risk-score"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty("riskScore", "HIGH")
  })

  it("returns null riskScore when not yet scored", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce({
      riskScore: null,
      riskScoredAt: null,
      riskDetails: null,
    } as any)
    const { GET } = await import("@/app/api/contracts/[id]/risk-score/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/risk-score"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.riskScore).toBeNull()
  })
})

// ─── POST /api/contracts/[id]/risk-score ──────────────────────────────────────

describe("POST /api/contracts/[id]/risk-score", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockQueues() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/risk-score/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/risk-score", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 when contract not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/risk-score/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/risk-score", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 400 when contract has no extracted text", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce({
      id: "contract-1",
      extractedText: null,
      organizationId: "org-1",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/risk-score/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/risk-score", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(400)
  })

  it("returns 503 when no AI provider configured", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce({
      id: "contract-1",
      extractedText: "Some contract text",
      organizationId: "org-1",
    } as any)
    // resolveAiConfig mock returns null provider (set globally)
    const { POST } = await import("@/app/api/contracts/[id]/risk-score/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/risk-score", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(503)
  })
})

// ─── POST /api/contracts/[id]/extractions/rerun ───────────────────────────────

describe("POST /api/contracts/[id]/extractions/rerun", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockQueues() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/extractions/rerun/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/extractions/rerun", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when user is a viewer (below member)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    const { POST } = await import("@/app/api/contracts/[id]/extractions/rerun/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/extractions/rerun", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when contract not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/extractions/rerun/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/extractions/rerun", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 422 when contract has no extracted text", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "contract-1",
      organizationId: "org-1",
      extractedText: null,
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/extractions/rerun/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/extractions/rerun", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("no_text")
  })

  it("enqueues AI extraction and returns queued:true", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "contract-1",
      organizationId: "org-1",
      extractedText: "Full contract text...",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/extractions/rerun/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/extractions/rerun", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.queued).toBe(true)
  })

  it("returns 404 when contract belongs to a different org (org isolation)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "contract-1",
      organizationId: "org-2",
      extractedText: "Some text",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/extractions/rerun/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/extractions/rerun", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })
})

// ─── POST /api/contracts/extract-preview ──────────────────────────────────────
// pdf-parse and mammoth are mocked above. We test auth and basic validation.
// The route uses OpenAI only if OPENAI_API_KEY is set.

describe("POST /api/contracts/extract-preview", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockQueues() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/extract-preview/route")
    const fd = new FormData()
    const res = await POST(makeFormRequest("http://localhost/api/contracts/extract-preview", fd))
    expect(res.status).toBe(401)
  })

  it("returns 400 when no file field is provided", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    const { POST } = await import("@/app/api/contracts/extract-preview/route")
    const fd = new FormData()
    const res = await POST(makeFormRequest("http://localhost/api/contracts/extract-preview", fd))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Missing file field")
  })

  it("returns 400 when file has unsupported magic bytes", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    const { POST } = await import("@/app/api/contracts/extract-preview/route")
    const bogusBuffer = Buffer.from("this is not a pdf or docx")
    const fd = new FormData()
    fd.append("file", new File([bogusBuffer], "contract.txt", { type: "text/plain" }))
    const res = await POST(makeFormRequest("http://localhost/api/contracts/extract-preview", fd))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("unsupported_file_type")
  })

  it("returns partial result (ai_unavailable) when OPENAI_API_KEY is not set", async () => {
    const saved = process.env.OPENAI_API_KEY
    delete process.env.OPENAI_API_KEY

    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    const { POST } = await import("@/app/api/contracts/extract-preview/route")
    // Use PDF magic bytes so file type detection passes
    const pdfBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
    const fd = new FormData()
    fd.append("file", new File([pdfBytes], "test.pdf", { type: "application/pdf" }))
    const res = await POST(makeFormRequest("http://localhost/api/contracts/extract-preview", fd))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.partial).toBe(true)
    expect(body.error).toBe("ai_unavailable")

    if (saved !== undefined) process.env.OPENAI_API_KEY = saved
  })
})

// ─── POST /api/org/invitations/[id] (resend) ──────────────────────────────────

describe("POST /api/org/invitations/[id] (resend)", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockQueues() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/org/invitations/[id]/route")
    const res = await POST(
      new Request("http://localhost/api/org/invitations/inv-1", { method: "POST" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when user is member (below admin)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    const { POST } = await import("@/app/api/org/invitations/[id]/route")
    const res = await POST(
      new Request("http://localhost/api/org/invitations/inv-1", { method: "POST" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when invitation not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.invitation.findUnique).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/org/invitations/[id]/route")
    const res = await POST(
      new Request("http://localhost/api/org/invitations/inv-1", { method: "POST" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 404 when invitation belongs to another org (org isolation)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.invitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      organizationId: "org-2",
      status: "pending",
      email: "user@example.com",
    } as any)
    const { POST } = await import("@/app/api/org/invitations/[id]/route")
    const res = await POST(
      new Request("http://localhost/api/org/invitations/inv-1", { method: "POST" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 409 when invitation is already accepted", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.invitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      organizationId: "org-1",
      status: "accepted",
      email: "user@example.com",
    } as any)
    const { POST } = await import("@/app/api/org/invitations/[id]/route")
    const res = await POST(
      new Request("http://localhost/api/org/invitations/inv-1", { method: "POST" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(409)
  })

  it("refreshes expiry and returns resent:true for a valid pending invitation", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.invitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      organizationId: "org-1",
      status: "pending",
      email: "invitee@example.com",
    } as any)
    vi.mocked(prisma.invitation.update).mockResolvedValueOnce({ id: "inv-1" } as any)
    vi.mocked(prisma.organization.findUnique).mockResolvedValueOnce({ name: "Acme Corp" } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ name: "Admin", email: "admin@example.com" } as any)
    const { POST } = await import("@/app/api/org/invitations/[id]/route")
    const res = await POST(
      new Request("http://localhost/api/org/invitations/inv-1", { method: "POST" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.resent).toBe(true)
    expect(body).toHaveProperty("expiresAt")
  })
})

// ─── DELETE /api/org/invitations/[id] (revoke) ────────────────────────────────

describe("DELETE /api/org/invitations/[id] (revoke)", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockQueues() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { DELETE } = await import("@/app/api/org/invitations/[id]/route")
    const res = await DELETE(
      new Request("http://localhost/api/org/invitations/inv-1", { method: "DELETE" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when user is member (below admin)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    const { DELETE } = await import("@/app/api/org/invitations/[id]/route")
    const res = await DELETE(
      new Request("http://localhost/api/org/invitations/inv-1", { method: "DELETE" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when invitation not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.invitation.findUnique).mockResolvedValueOnce(null)
    const { DELETE } = await import("@/app/api/org/invitations/[id]/route")
    const res = await DELETE(
      new Request("http://localhost/api/org/invitations/inv-1", { method: "DELETE" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 404 when invitation belongs to another org (org isolation)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.invitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      organizationId: "org-2",
      status: "pending",
    } as any)
    const { DELETE } = await import("@/app/api/org/invitations/[id]/route")
    const res = await DELETE(
      new Request("http://localhost/api/org/invitations/inv-1", { method: "DELETE" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 204 and deletes invitation when valid", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.invitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      organizationId: "org-1",
      status: "pending",
    } as any)
    vi.mocked(prisma.invitation.delete).mockResolvedValueOnce({ id: "inv-1" } as any)
    const { DELETE } = await import("@/app/api/org/invitations/[id]/route")
    const res = await DELETE(
      new Request("http://localhost/api/org/invitations/inv-1", { method: "DELETE" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(204)
  })
})

// ─── POST /api/org/invitations/[id]/accept ────────────────────────────────────

describe("POST /api/org/invitations/[id]/accept", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockQueues() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/org/invitations/[id]/accept/route")
    const res = await POST(
      new Request("http://localhost/api/org/invitations/inv-1/accept", { method: "POST" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 when invitation not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.invitation.findUnique).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/org/invitations/[id]/accept/route")
    const res = await POST(
      new Request("http://localhost/api/org/invitations/inv-1/accept", { method: "POST" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 409 when invitation is already accepted", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.invitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      organizationId: "org-1",
      status: "accepted",
      email: "admin@example.com",
      expiresAt: new Date(Date.now() + 86400_000),
      role: "member",
    } as any)
    const { POST } = await import("@/app/api/org/invitations/[id]/accept/route")
    const res = await POST(
      new Request("http://localhost/api/org/invitations/inv-1/accept", { method: "POST" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(409)
  })

  it("returns 410 when invitation is expired", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.invitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      organizationId: "org-1",
      status: "pending",
      email: "admin@example.com",
      expiresAt: new Date(Date.now() - 1000), // past
      role: "member",
    } as any)
    const { POST } = await import("@/app/api/org/invitations/[id]/accept/route")
    const res = await POST(
      new Request("http://localhost/api/org/invitations/inv-1/accept", { method: "POST" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(410)
  })

  it("returns 403 when user email does not match invitation email", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.invitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      organizationId: "org-1",
      status: "pending",
      email: "other@example.com",
      expiresAt: new Date(Date.now() + 86400_000),
      role: "member",
    } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      email: "admin@example.com",
    } as any)
    const { POST } = await import("@/app/api/org/invitations/[id]/accept/route")
    const res = await POST(
      new Request("http://localhost/api/org/invitations/inv-1/accept", { method: "POST" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe("email_mismatch")
  })

  it("returns alreadyMember:true when user is already in org", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.invitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      organizationId: "org-1",
      status: "pending",
      email: "admin@example.com",
      expiresAt: new Date(Date.now() + 86400_000),
      role: "member",
    } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      email: "admin@example.com",
    } as any)
    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce({ id: "member-1" } as any)
    vi.mocked(prisma.invitation.update).mockResolvedValueOnce({ id: "inv-1" } as any)
    const { POST } = await import("@/app/api/org/invitations/[id]/accept/route")
    const res = await POST(
      new Request("http://localhost/api/org/invitations/inv-1/accept", { method: "POST" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.alreadyMember).toBe(true)
    expect(body.organizationId).toBe("org-1")
  })

  it("creates member and returns organizationId on successful accept", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.invitation.findUnique).mockResolvedValueOnce({
      id: "inv-1",
      organizationId: "org-1",
      status: "pending",
      email: "admin@example.com",
      expiresAt: new Date(Date.now() + 86400_000),
      role: "member",
    } as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({
      email: "admin@example.com",
    } as any)
    // Not already a member
    vi.mocked(prisma.member.findUnique).mockResolvedValueOnce(null)
    // $transaction returns [member, updated invitation]
    vi.mocked(prisma.$transaction).mockResolvedValueOnce([
      { id: "member-new", organizationId: "org-1", role: "member" },
      { id: "inv-1", status: "accepted" },
    ] as any)
    const { POST } = await import("@/app/api/org/invitations/[id]/accept/route")
    const res = await POST(
      new Request("http://localhost/api/org/invitations/inv-1/accept", { method: "POST" }),
      { params: { id: "inv-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.organizationId).toBe("org-1")
    expect(body.role).toBe("member")
  })
})

// ─── POST /api/org/logo ────────────────────────────────────────────────────────

describe("POST /api/org/logo (upload)", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockQueues() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/org/logo/route")
    const fd = new FormData()
    const res = await POST(makeFormRequest("http://localhost/api/org/logo", fd))
    expect(res.status).toBe(401)
  })

  it("returns 403 when user is a member (below legal)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    const { POST } = await import("@/app/api/org/logo/route")
    const fd = new FormData()
    const res = await POST(makeFormRequest("http://localhost/api/org/logo", fd))
    expect(res.status).toBe(403)
  })

  it("returns 400 when no file field provided", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    const { POST } = await import("@/app/api/org/logo/route")
    const fd = new FormData()
    const res = await POST(makeFormRequest("http://localhost/api/org/logo", fd))
    expect(res.status).toBe(400)
  })

  it("returns 400 for unsupported content type (GIF not allowed for logo)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    const { POST } = await import("@/app/api/org/logo/route")
    const fd = new FormData()
    fd.append("file", new File(["data"], "logo.gif", { type: "image/gif" }))
    const res = await POST(makeFormRequest("http://localhost/api/org/logo", fd))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/JPEG|PNG|WebP/)
  })

  it("returns 201 with url when valid PNG uploaded by admin", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    const { POST } = await import("@/app/api/org/logo/route")
    const fd = new FormData()
    fd.append("file", new File(["data"], "logo.png", { type: "image/png" }))
    const res = await POST(makeFormRequest("http://localhost/api/org/logo", fd))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty("url")
  })

  it("returns 201 when uploaded by legal user", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(legalCtx)
    const { POST } = await import("@/app/api/org/logo/route")
    const fd = new FormData()
    fd.append("file", new File(["data"], "logo.png", { type: "image/png" }))
    const res = await POST(makeFormRequest("http://localhost/api/org/logo", fd))
    expect(res.status).toBe(201)
  })
})

// ─── GET /api/org/logo ────────────────────────────────────────────────────────

describe("GET /api/org/logo", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockQueues() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/org/logo/route")
    const res = await GET(
      new Request("http://localhost/api/org/logo?key=orgs/org-1/logo/file.png"),
    )
    expect(res.status).toBe(401)
  })

  it("returns 400 when key param is missing", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    const { GET } = await import("@/app/api/org/logo/route")
    const res = await GET(
      new Request("http://localhost/api/org/logo"),
    )
    expect(res.status).toBe(400)
  })

  it("returns 302 redirect to signed URL when key is present", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    const { GET } = await import("@/app/api/org/logo/route")
    const res = await GET(
      new Request("http://localhost/api/org/logo?key=orgs/org-1/logo/file.png"),
    )
    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toBe("https://s3.example.com/logo.png")
  })
})

// ─── POST /api/user/avatar ────────────────────────────────────────────────────

describe("POST /api/user/avatar (upload)", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockQueues() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/user/avatar/route")
    const fd = new FormData()
    const res = await POST(makeFormRequest("http://localhost/api/user/avatar", fd))
    expect(res.status).toBe(401)
  })

  it("returns 400 when no file field", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    const { POST } = await import("@/app/api/user/avatar/route")
    const fd = new FormData()
    const res = await POST(makeFormRequest("http://localhost/api/user/avatar", fd))
    expect(res.status).toBe(400)
  })

  it("returns 400 for unsupported content type (PDF)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    const { POST } = await import("@/app/api/user/avatar/route")
    const fd = new FormData()
    fd.append("file", new File(["data"], "avatar.pdf", { type: "application/pdf" }))
    const res = await POST(makeFormRequest("http://localhost/api/user/avatar", fd))
    expect(res.status).toBe(400)
  })

  it("returns 201 with url when valid GIF uploaded", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    const { POST } = await import("@/app/api/user/avatar/route")
    const fd = new FormData()
    fd.append("file", new File(["data"], "avatar.gif", { type: "image/gif" }))
    const res = await POST(makeFormRequest("http://localhost/api/user/avatar", fd))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toHaveProperty("url")
  })

  it("returns 201 with url when valid JPEG uploaded", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    const { POST } = await import("@/app/api/user/avatar/route")
    const fd = new FormData()
    fd.append("file", new File(["data"], "avatar.jpg", { type: "image/jpeg" }))
    const res = await POST(makeFormRequest("http://localhost/api/user/avatar", fd))
    expect(res.status).toBe(201)
  })
})

// ─── GET /api/user/avatar ─────────────────────────────────────────────────────

describe("GET /api/user/avatar", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockQueues() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/user/avatar/route")
    const res = await GET(
      new Request("http://localhost/api/user/avatar?key=avatars/user-1/file.png"),
    )
    expect(res.status).toBe(401)
  })

  it("returns 400 when key param is missing", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    const { GET } = await import("@/app/api/user/avatar/route")
    const res = await GET(
      new Request("http://localhost/api/user/avatar"),
    )
    expect(res.status).toBe(400)
  })

  it("returns 302 redirect to signed URL", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    const { GET } = await import("@/app/api/user/avatar/route")
    const res = await GET(
      new Request("http://localhost/api/user/avatar?key=avatars/user-1/file.png"),
    )
    expect(res.status).toBe(302)
    expect(res.headers.get("Location")).toBe("https://s3.example.com/logo.png")
  })
})

// ─── GET /api/user/locale ─────────────────────────────────────────────────────

describe("GET /api/user/locale", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockQueues() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/user/locale/route")
    const res = await GET(new Request("http://localhost/api/user/locale"))
    expect(res.status).toBe(401)
  })

  it("returns locale when user has one set", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ locale: "fr" } as any)
    const { GET } = await import("@/app/api/user/locale/route")
    const res = await GET(new Request("http://localhost/api/user/locale"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.locale).toBe("fr")
  })

  it("returns 'en' as default when user has no locale set", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.user.findUnique).mockResolvedValueOnce({ locale: null } as any)
    const { GET } = await import("@/app/api/user/locale/route")
    const res = await GET(new Request("http://localhost/api/user/locale"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.locale).toBe("en")
  })
})

// ─── PATCH /api/user/locale ───────────────────────────────────────────────────

describe("PATCH /api/user/locale", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockQueues() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { PATCH } = await import("@/app/api/user/locale/route")
    const res = await PATCH(
      new Request("http://localhost/api/user/locale", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: "fr" }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it("returns 422 for invalid locale", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    const { PATCH } = await import("@/app/api/user/locale/route")
    const res = await PATCH(
      new Request("http://localhost/api/user/locale", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: "zz" }),
      }),
    )
    expect(res.status).toBe(422)
  })

  it("updates locale and sets NEXT_LOCALE cookie", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: "user-admin", locale: "de" } as any)
    const { PATCH } = await import("@/app/api/user/locale/route")
    const res = await PATCH(
      new Request("http://localhost/api/user/locale", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: "de" }),
      }),
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.locale).toBe("de")
    expect(res.headers.get("Set-Cookie")).toContain("NEXT_LOCALE=de")
  })

  it("accepts all supported locales (en, fr, de, ar, es)", async () => {
    for (const locale of ["en", "fr", "de", "ar", "es"]) {
      vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
      vi.mocked(prisma.user.update).mockResolvedValueOnce({ id: "user-admin", locale } as any)
      const { PATCH } = await import("@/app/api/user/locale/route")
      const res = await PATCH(
        new Request("http://localhost/api/user/locale", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locale }),
        }),
      )
      expect(res.status).toBe(200)
      expect(res.headers.get("Set-Cookie")).toContain(`NEXT_LOCALE=${locale}`)
    }
  })
})

// ─── POST /api/import/clm-export ─────────────────────────────────────────────

describe("POST /api/import/clm-export", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockQueues() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/import/clm-export/route")
    const fd = new FormData()
    const res = await POST(makeFormRequest("http://localhost/api/import/clm-export", fd))
    expect(res.status).toBe(401)
  })

  it("returns 403 when user is a viewer", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    const { POST } = await import("@/app/api/import/clm-export/route")
    const fd = new FormData()
    const res = await POST(makeFormRequest("http://localhost/api/import/clm-export", fd))
    expect(res.status).toBe(403)
  })

  it("returns 400 when no file is provided", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    const { POST } = await import("@/app/api/import/clm-export/route")
    const fd = new FormData()
    const res = await POST(makeFormRequest("http://localhost/api/import/clm-export", fd))
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("no_file")
  })

  it("returns 422 for invalid format parameter", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    const { POST } = await import("@/app/api/import/clm-export/route")
    // File passes `file instanceof File` check; format is invalid before zip check
    const fd = new FormData()
    fd.append("file", new File(["data"], "export.zip", { type: "application/zip" }))
    fd.append("format", "invalid_format")
    const res = await POST(makeFormRequest("http://localhost/api/import/clm-export", fd))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("invalid_format")
  })

  it("returns 422 when file is not a zip (isZipBuffer returns false)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(isZipBuffer).mockReturnValueOnce(false)
    const { POST } = await import("@/app/api/import/clm-export/route")
    const fd = new FormData()
    fd.append("file", new File(["not a zip"], "export.zip", { type: "application/zip" }))
    // No format appended -> defaults to "auto" which is valid
    const res = await POST(makeFormRequest("http://localhost/api/import/clm-export", fd))
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("not_a_zip")
  })

  it("returns 201 with jobId when valid zip is uploaded", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(isZipBuffer).mockReturnValueOnce(true)
    vi.mocked(prisma.importJob.create).mockResolvedValueOnce({
      id: "clm-job-1",
      totalRows: 0,
    } as any)
    const { POST } = await import("@/app/api/import/clm-export/route")
    const fd = new FormData()
    fd.append("file", new File(["zip content"], "export.zip", { type: "application/zip" }))
    const res = await POST(makeFormRequest("http://localhost/api/import/clm-export", fd))
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.jobId).toBe("clm-job-1")
  })
})

// ─── POST /api/import/gdrive/import ───────────────────────────────────────────

describe("POST /api/import/gdrive/import", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetMockQueues()
    process.env.GOOGLE_CLIENT_ID = "test-client-id"
  })

  afterEach(() => {
    delete process.env.GOOGLE_CLIENT_ID
  })

  it("returns 503 when GOOGLE_CLIENT_ID is not configured", async () => {
    delete process.env.GOOGLE_CLIENT_ID
    // Do NOT mock resolveAuth — route returns 503 before auth check
    const { POST } = await import("@/app/api/import/gdrive/import/route")
    const res = await POST(
      new Request("http://localhost/api/import/gdrive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: ["file-1"] }),
      }),
    )
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe("google_drive_not_configured")
  })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/import/gdrive/import/route")
    const res = await POST(
      new Request("http://localhost/api/import/gdrive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: ["file-1"] }),
      }),
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when user is a viewer", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    const { POST } = await import("@/app/api/import/gdrive/import/route")
    const res = await POST(
      new Request("http://localhost/api/import/gdrive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: ["file-1"] }),
      }),
    )
    expect(res.status).toBe(403)
  })

  it("returns 422 when fileIds is empty", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    const { POST } = await import("@/app/api/import/gdrive/import/route")
    const res = await POST(
      new Request("http://localhost/api/import/gdrive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: [] }),
      }),
    )
    expect(res.status).toBe(422)
  })

  it("returns 201 with jobId when valid fileIds are provided", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    vi.mocked(prisma.importJob.create).mockResolvedValueOnce({
      id: "gdrive-job-1",
      totalRows: 2,
    } as any)
    const { POST } = await import("@/app/api/import/gdrive/import/route")
    const res = await POST(
      new Request("http://localhost/api/import/gdrive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: ["file-1", "file-2"] }),
      }),
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.jobId).toBe("gdrive-job-1")
    expect(body.totalRows).toBe(2)
  })
})

// ─── GET /api/import ──────────────────────────────────────────────────────────

describe("GET /api/import", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockQueues() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/import/route")
    const res = await GET(new Request("http://localhost/api/import"))
    expect(res.status).toBe(401)
  })

  it("returns paginated job list", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    const mockJobs = [
      {
        id: "job-1",
        source: "CLM_EXPORT",
        status: "COMPLETE",
        totalRows: 5,
        succeededRows: 5,
        failedRows: 0,
        createdAt: new Date(),
        completedAt: new Date(),
        createdBy: { id: "user-admin", name: "Admin" },
      },
    ]
    vi.mocked(prisma.importJob.findMany).mockResolvedValueOnce(mockJobs as any)
    vi.mocked(prisma.importJob.count).mockResolvedValueOnce(1)
    const { GET } = await import("@/app/api/import/route")
    const res = await GET(new Request("http://localhost/api/import"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.jobs).toHaveLength(1)
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(20)
  })

  it("respects page and limit query params", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.importJob.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.importJob.count).mockResolvedValueOnce(0)
    const { GET } = await import("@/app/api/import/route")
    const res = await GET(new Request("http://localhost/api/import?page=2&limit=5"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.page).toBe(2)
    expect(body.limit).toBe(5)
  })

  it("returns empty list when no jobs exist", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    vi.mocked(prisma.importJob.findMany).mockResolvedValueOnce([])
    vi.mocked(prisma.importJob.count).mockResolvedValueOnce(0)
    const { GET } = await import("@/app/api/import/route")
    const res = await GET(new Request("http://localhost/api/import"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.jobs).toHaveLength(0)
    expect(body.total).toBe(0)
  })
})

// ─── POST /api/crm/[provider]/sync/[contractId] ───────────────────────────────

describe("POST /api/crm/[provider]/sync/[contractId]", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMockQueues() })

  const mockIntegration = {
    id: "integration-1",
    provider: "HUBSPOT",
    organizationId: "org-1",
    accessToken: "enc:token",
    refreshToken: "enc:refresh",
    tokenExpiresAt: new Date(Date.now() + 3600_000),
    syncOnActiveStage: null,
    portalId: "portal-123",
    instanceUrl: null,
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/crm/[provider]/sync/[contractId]/route")
    const res = await POST(
      new Request("http://localhost/api/crm/hubspot/sync/contract-1", { method: "POST" }),
      { params: { provider: "HUBSPOT", contractId: "contract-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 400 for invalid provider", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    const { POST } = await import("@/app/api/crm/[provider]/sync/[contractId]/route")
    const res = await POST(
      new Request("http://localhost/api/crm/bogus/sync/contract-1", { method: "POST" }),
      { params: { provider: "bogus", contractId: "contract-1" } },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("invalid_provider")
  })

  it("returns 403 when user is a member (only admin/legal can sync)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    const { POST } = await import("@/app/api/crm/[provider]/sync/[contractId]/route")
    const res = await POST(
      new Request("http://localhost/api/crm/HUBSPOT/sync/contract-1", { method: "POST" }),
      { params: { provider: "HUBSPOT", contractId: "contract-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when contract not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/crm/[provider]/sync/[contractId]/route")
    const res = await POST(
      new Request("http://localhost/api/crm/HUBSPOT/sync/contract-1", { method: "POST" }),
      { params: { provider: "HUBSPOT", contractId: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 404 when contract belongs to another org (org isolation)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "contract-1",
      organizationId: "org-2", // different org
      status: "ACTIVE",
    } as any)
    const { POST } = await import("@/app/api/crm/[provider]/sync/[contractId]/route")
    const res = await POST(
      new Request("http://localhost/api/crm/HUBSPOT/sync/contract-1", { method: "POST" }),
      { params: { provider: "HUBSPOT", contractId: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 404 (not_linked) when no CRM link exists for this contract", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "contract-1",
      organizationId: "org-1",
      status: "ACTIVE",
    } as any)
    vi.mocked(prisma.crmLink.findFirst).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/crm/[provider]/sync/[contractId]/route")
    const res = await POST(
      new Request("http://localhost/api/crm/HUBSPOT/sync/contract-1", { method: "POST" }),
      { params: { provider: "HUBSPOT", contractId: "contract-1" } },
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("not_linked")
  })

  it("returns 404 (integration_missing) when CRM integration record is gone", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "contract-1",
      organizationId: "org-1",
      status: "ACTIVE",
    } as any)
    vi.mocked(prisma.crmLink.findFirst).mockResolvedValueOnce({
      id: "link-1",
      externalDealId: "deal-42",
      integrationId: "integration-1",
    } as any)
    vi.mocked(prisma.crmIntegration.findUnique).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/crm/[provider]/sync/[contractId]/route")
    const res = await POST(
      new Request("http://localhost/api/crm/HUBSPOT/sync/contract-1", { method: "POST" }),
      { params: { provider: "HUBSPOT", contractId: "contract-1" } },
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("integration_missing")
  })

  it("returns 502 when token refresh fails", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "contract-1",
      organizationId: "org-1",
      status: "ACTIVE",
    } as any)
    vi.mocked(prisma.crmLink.findFirst).mockResolvedValueOnce({
      id: "link-1",
      externalDealId: "deal-42",
      integrationId: "integration-1",
    } as any)
    vi.mocked(prisma.crmIntegration.findUnique).mockResolvedValueOnce(mockIntegration as any)
    vi.mocked(ensureFreshToken).mockRejectedValueOnce(new Error("Token refresh failed"))
    vi.mocked(prisma.crmLink.update).mockResolvedValueOnce({} as any)
    const { POST } = await import("@/app/api/crm/[provider]/sync/[contractId]/route")
    const res = await POST(
      new Request("http://localhost/api/crm/HUBSPOT/sync/contract-1", { method: "POST" }),
      { params: { provider: "HUBSPOT", contractId: "contract-1" } },
    )
    expect(res.status).toBe(502)
    const body = await res.json()
    expect(body.error).toBe("token_refresh_failed")
  })

  it("returns synced:true with deal data when getDeal succeeds", async () => {
    const mockDeal = {
      id: "deal-42",
      name: "Big Deal",
      url: "https://app.hubspot.com/deal/42",
      stage: "closed_won",
    }
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "contract-1",
      organizationId: "org-1",
      status: "ACTIVE",
    } as any)
    vi.mocked(prisma.crmLink.findFirst).mockResolvedValueOnce({
      id: "link-1",
      externalDealId: "deal-42",
      integrationId: "integration-1",
    } as any)
    vi.mocked(prisma.crmIntegration.findUnique).mockResolvedValueOnce(mockIntegration as any)
    vi.mocked(ensureFreshToken).mockResolvedValueOnce(mockIntegration as any)
    vi.mocked(getCrmProvider).mockReturnValueOnce({
      getDeal: vi.fn().mockResolvedValue(mockDeal),
    } as any)
    vi.mocked(prisma.crmLink.update).mockResolvedValueOnce({} as any)
    const { POST } = await import("@/app/api/crm/[provider]/sync/[contractId]/route")
    const res = await POST(
      new Request("http://localhost/api/crm/HUBSPOT/sync/contract-1", { method: "POST" }),
      { params: { provider: "HUBSPOT", contractId: "contract-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.synced).toBe(true)
    expect(body.deal).toMatchObject({ id: "deal-42" })
  })

  it("transitions contract to ACTIVE when deal stage matches syncOnActiveStage", async () => {
    const { writeActivity } = await import("@/lib/db/activity")
    const mockDeal = { id: "deal-42", name: "Won Deal", url: null, stage: "closed_won" }
    const integrationWithStage = { ...mockIntegration, syncOnActiveStage: "closed_won" }

    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "contract-1",
      organizationId: "org-1",
      status: "AWAITING_SIGNATURE",
    } as any)
    vi.mocked(prisma.crmLink.findFirst).mockResolvedValueOnce({
      id: "link-1",
      externalDealId: "deal-42",
      integrationId: "integration-1",
    } as any)
    vi.mocked(prisma.crmIntegration.findUnique).mockResolvedValueOnce(integrationWithStage as any)
    vi.mocked(ensureFreshToken).mockResolvedValueOnce(integrationWithStage as any)
    vi.mocked(getCrmProvider).mockReturnValueOnce({
      getDeal: vi.fn().mockResolvedValue(mockDeal),
    } as any)
    vi.mocked(prisma.crmLink.update).mockResolvedValueOnce({} as any)
    vi.mocked(prisma.contract.update).mockResolvedValueOnce({ id: "contract-1", status: "ACTIVE" } as any)

    const { POST } = await import("@/app/api/crm/[provider]/sync/[contractId]/route")
    const res = await POST(
      new Request("http://localhost/api/crm/HUBSPOT/sync/contract-1", { method: "POST" }),
      { params: { provider: "HUBSPOT", contractId: "contract-1" } },
    )
    expect(res.status).toBe(200)
    expect(vi.mocked(prisma.contract.update)).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "ACTIVE" } }),
    )
    expect(vi.mocked(writeActivity)).toHaveBeenCalledWith(
      "contract-1",
      "user-admin",
      "CRM_SYNCED",
      expect.stringContaining("ACTIVE"),
      expect.any(Object),
    )
  })
})
