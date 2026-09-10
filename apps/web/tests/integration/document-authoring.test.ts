/**
 * Integration tests for document authoring routes (M6).
 *
 * Routes covered:
 *  1. GET  /api/contracts/[id]/document           — fetch document
 *  2. PUT  /api/contracts/[id]/document           — save document
 *  3. POST /api/contracts/[id]/document/export    — start export job
 *  4. GET  /api/contracts/[id]/document/export/[jobId] — poll export job
 *  5. POST /api/contracts/[id]/document/extract   — extract text → AI queue
 *  6. POST /api/contracts/[id]/document/image     — upload inline image
 *  7. POST /api/contracts/[id]/document/import    — start DOCX/PDF import job
 *  8. GET  /api/contracts/[id]/document/import/[jobId] — poll import job
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"
import { lockCurrentAgreementPermission } from "@/lib/auth/agreement-access"
import { documentContentHash } from "@/lib/jobs/document-export-access"
import { MAX_CONTRACT_FILE_BYTES } from "@/lib/contracts/file-validation"

vi.mock("@/lib/auth/agreement-access", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/auth/agreement-access")>(),
  lockCurrentAgreementPermission: vi.fn(),
}))

// ─── Global mocks (must precede dynamic imports) ───────────────────────────────

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
    upload: vi.fn().mockResolvedValue("contracts/contract-1/images/abc.png"),
    getSignedDownloadUrl: vi.fn().mockResolvedValue("https://storage.example.com/signed/img.png"),
    getObject: vi.fn().mockResolvedValue({ body: Buffer.from("export") }),
    delete: vi.fn().mockResolvedValue(undefined),
    storageKey: vi.fn().mockReturnValue("orgs/org-1/contracts/contract-1/file.pdf"),
  },
}))

// Queue job mock objects returned by .add() and .getJob()
const exportContent = { type: "doc", content: [] }
const exportContentHash = documentContentHash(exportContent)
const mockExportJob = {
  id: "export-job-1",
  data: {
    contractId: "contract-1",
    organizationId: "org-1",
    requestedByMemberId: "member-admin",
    requestedById: "user-admin",
    documentId: "doc-1",
    documentVersion: 1,
    documentContentHash: exportContentHash,
    format: "docx",
    jobId: "export-job-1",
  },
  updateData: vi.fn().mockResolvedValue(undefined),
  getState: vi.fn().mockResolvedValue("pending"),
  returnvalue: null,
  failedReason: null,
}

const mockConvertJob = {
  id: "convert-job-1",
  data: { contractId: "contract-1", requestedById: "user-admin", storageKey: "tmp/key.docx", fileType: "docx", jobId: "convert-job-1" },
  updateData: vi.fn().mockResolvedValue(undefined),
  getState: vi.fn().mockResolvedValue("pending"),
  returnvalue: null,
  failedReason: null,
}

const mockDocumentConvertQueue = {
  add: vi.fn().mockResolvedValue(mockConvertJob),
  close: vi.fn(),
  getJob: vi.fn().mockResolvedValue(mockConvertJob),
}
const mockDocumentExportQueue = {
  add: vi.fn().mockImplementation(async (_name: string, data: typeof mockExportJob.data) => ({
    ...mockExportJob,
    id: data.jobId,
    data,
  })),
  close: vi.fn(),
}

// The export/import poll routes use getDocumentExportQueue() / getDocumentConvertQueue()
// getters. We expose them alongside the named exports already mocked in setup.ts.
vi.mock("@/lib/jobs/queues", () => ({
  contractExtractQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  contractAiExtractQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  contractEmbedQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  alertsCheckQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  signingSyncQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  emailQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  notificationFanoutQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  notificationDeliverQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  documentConvertQueue: mockDocumentConvertQueue,
  documentExportQueue: mockDocumentExportQueue,
  obligationsCheckQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  salesforcePollQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  importProcessQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  obligationExtractQueue: { add: vi.fn().mockResolvedValue(undefined), close: vi.fn() },
  // Getter functions used by the poll routes
  getDocumentExportQueue: vi.fn().mockReturnValue({
    getJob: vi.fn().mockResolvedValue(mockExportJob),
  }),
  getDocumentConvertQueue: vi.fn().mockReturnValue(mockDocumentConvertQueue),
}))

vi.mock("@/lib/editor/plate-to-plaintext", () => ({
  plateToPlaintext: vi.fn().mockReturnValue("Sample extracted text."),
}))

// ─── Import auth middleware after mocks ────────────────────────────────────────

import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"

// ─── Auth contexts ─────────────────────────────────────────────────────────────

const adminCtx = {
  userId: "user-admin",
  memberId: "member-admin",
  organizationId: "org-1",
  role: "admin",
  source: "session" as const,
  requestId: "req-test",
}
const viewerCtx = { ...adminCtx, role: "viewer" }
const legalCtx = { ...adminCtx, role: "legal" }
const memberCtx = { ...adminCtx, role: "member" }

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const draftContract = {
  id: "contract-1",
  organizationId: "org-1",
  status: "DRAFT",
}

const otherOrgContract = {
  id: "contract-1",
  organizationId: "org-other",
  status: "DRAFT",
}

const mockDocument = {
  id: "doc-1",
  content: { type: "doc", content: [] },
  wordCount: 0,
  version: 1,
  updatedAt: new Date(),
}

const mockExportArtifact = {
  jobId: "export-job-1",
  organizationId: "org-1",
  contractId: "contract-1",
  requestedByMemberId: "member-admin",
  requestedById: "user-admin",
  documentId: "doc-1",
  documentVersion: 1,
  documentContentHash: exportContentHash,
  format: "docx",
  state: "QUEUED",
  storageKey: null,
  publishedAt: null,
  expiresAt: new Date(Date.now() + 86_400_000),
  cleanedAt: null,
  cleanupError: null,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const validContent = { type: "doc", content: [] }

// ─── Helpers ───────────────────────────────────────────────────────────────────

function resetMocks() {
  const artifact = (prisma as any).documentExportArtifact ??= {
    findFirst: vi.fn(),
    create: vi.fn(),
  }
  artifact.findFirst.mockResolvedValue(mockExportArtifact)
  artifact.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ jobId: data.jobId, state: "QUEUED" }))
  mockDocumentConvertQueue.add.mockResolvedValue(mockConvertJob)
  mockDocumentConvertQueue.getJob.mockResolvedValue(mockConvertJob)
  vi.mocked(lockCurrentAgreementPermission).mockResolvedValue({ contractOwnerId: "user-admin", role: "admin" })
  vi.mocked(prisma.contract.findUnique).mockResolvedValue(draftContract as never)
  vi.mocked(prisma.contract.findFirst).mockResolvedValue(draftContract as never)
  vi.mocked(resolveAuth).mockReset()
  vi.mocked(requireWriteScope).mockReturnValue(null)
  vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValue({ id: "grant-contract-1" } as never)
  vi.mocked(prisma.member.findFirst).mockResolvedValue({ id: "member-admin" } as never)
  vi.mocked(prisma.contractDocument.findUnique).mockResolvedValue(mockDocument as never)
  mockDocumentExportQueue.add.mockImplementation(async (_name: string, data: typeof mockExportJob.data) => ({
    ...mockExportJob,
    id: data.jobId,
    data,
  }))
}

// ══════════════════════════════════════════════════════════════════════════════
// 1. GET /api/contracts/[id]/document
// ══════════════════════════════════════════════════════════════════════════════

describe("GET /api/contracts/[id]/document", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMocks() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(null)
    const { GET } = await import("@/app/api/contracts/[id]/document/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document"),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 when contract belongs to another org", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(otherOrgContract as any)
    const { GET } = await import("@/app/api/contracts/[id]/document/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document"),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(404)
  })

  it("returns 404 when contract does not exist", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/document/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document"),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(404)
  })

  it("returns 200 with { document: null } when contract exists but no document saved yet", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/document/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document"),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ document: null })
  })

  it("returns 200 with the document when it exists", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce(mockDocument as any)
    const { GET } = await import("@/app/api/contracts/[id]/document/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document"),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.document).toMatchObject({ id: "doc-1", version: 1 })
  })

  it("allows viewer role to read", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(viewerCtx as any)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce(mockDocument as any)
    const { GET } = await import("@/app/api/contracts/[id]/document/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document"),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(200)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 2. PUT /api/contracts/[id]/document
// ══════════════════════════════════════════════════════════════════════════════

describe("PUT /api/contracts/[id]/document", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMocks() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(null)
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    const res = await PUT(
      new Request("http://localhost/api/contracts/contract-1/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: validContent, wordCount: 0, clientVersion: 0 }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 for viewer role", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(viewerCtx as any)
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    const res = await PUT(
      new Request("http://localhost/api/contracts/contract-1/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: validContent, wordCount: 0, clientVersion: 0 }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when contract belongs to another org", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(otherOrgContract as any)
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    const res = await PUT(
      new Request("http://localhost/api/contracts/contract-1/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: validContent, wordCount: 0, clientVersion: 0 }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(404)
  })

  it("returns 422 for invalid body (missing content)", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    const res = await PUT(
      new Request("http://localhost/api/contracts/contract-1/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wordCount: 0, clientVersion: 0 }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(422)
  })

  it("returns 422 for invalid body (negative wordCount)", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    const res = await PUT(
      new Request("http://localhost/api/contracts/contract-1/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: validContent, wordCount: -1, clientVersion: 0 }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(422)
  })

  it("returns 400 for malformed JSON", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    const res = await PUT(
      new Request("http://localhost/api/contracts/contract-1/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(400)
  })

  it("returns 422 read_only_status for ACTIVE contracts", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...draftContract,
      status: "ACTIVE",
    } as any)
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    const res = await PUT(
      new Request("http://localhost/api/contracts/contract-1/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: validContent, wordCount: 0, clientVersion: 0 }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("read_only_status")
  })

  it("returns 422 read_only_status for AWAITING_SIGNATURE contracts", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...draftContract,
      status: "AWAITING_SIGNATURE",
    } as any)
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    const res = await PUT(
      new Request("http://localhost/api/contracts/contract-1/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: validContent, wordCount: 0, clientVersion: 0 }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("read_only_status")
  })

  it("returns 409 conflict on first save when clientVersion !== 0", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce(null) // no existing doc
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    const res = await PUT(
      new Request("http://localhost/api/contracts/contract-1/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: validContent, wordCount: 5, clientVersion: 3 }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe("conflict")
    expect(body.serverVersion).toBe(0)
  })

  it("creates document on first save (clientVersion = 0)", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.contractDocument.create).mockResolvedValueOnce({
      id: "doc-new",
      wordCount: 10,
      version: 1,
      updatedAt: new Date(),
    } as any)
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    const res = await PUT(
      new Request("http://localhost/api/contracts/contract-1/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: validContent, wordCount: 10, clientVersion: 0 }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.document.version).toBe(1)
    expect(prisma.contractDocument.create).toHaveBeenCalledOnce()
  })

  it("returns 409 conflict when clientVersion does not match existing version", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce({
      id: "doc-1",
      version: 5,
    } as any)
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    const res = await PUT(
      new Request("http://localhost/api/contracts/contract-1/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: validContent, wordCount: 5, clientVersion: 3 }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe("conflict")
    expect(body.serverVersion).toBe(5)
  })

  it("updates document and increments version on subsequent save", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce({
      id: "doc-1",
      version: 2,
    } as any)
    vi.mocked(prisma.contractDocument.update).mockResolvedValueOnce({
      id: "doc-1",
      wordCount: 20,
      version: 3,
      updatedAt: new Date(),
    } as any)
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    const res = await PUT(
      new Request("http://localhost/api/contracts/contract-1/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: validContent, wordCount: 20, clientVersion: 2 }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.document.version).toBe(3)
    expect(prisma.contractDocument.update).toHaveBeenCalledOnce()
    expect(prisma.contractDocument.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { contractId: "contract-1", version: 2 },
    }))
  })

  it.each([
    [null, 404],
    [{ contractOwnerId: "user-admin", role: "viewer" }, 403],
  ] as const)("rechecks current permission inside the save transaction (%s)", async (permission, status) => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as never)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce(null)
    vi.mocked(lockCurrentAgreementPermission).mockResolvedValueOnce(permission)
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    const res = await PUT(new Request("http://localhost/api/contracts/contract-1/document", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: validContent, wordCount: 0, clientVersion: 0 }),
    }), { params: Promise.resolve({ id: "contract-1" }) })
    expect(res.status).toBe(status)
    expect(prisma.contractDocument.create).not.toHaveBeenCalled()
    expect(prisma.contractDocument.update).not.toHaveBeenCalled()
    expect(writeActivity).not.toHaveBeenCalled()
  })

  it("rejects a contract that became read-only while the save was waiting", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as never)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.contract.findFirst).mockResolvedValueOnce({ ...draftContract, status: "ACTIVE" } as never)
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    const res = await PUT(new Request("http://localhost/api/contracts/contract-1/document", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: validContent, wordCount: 0, clientVersion: 0 }),
    }), { params: Promise.resolve({ id: "contract-1" }) })
    expect(res.status).toBe(422)
    expect(prisma.contractDocument.create).not.toHaveBeenCalled()
    expect(writeActivity).not.toHaveBeenCalled()
  })

  it("sanitizes XSS payloads in text nodes before persisting", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.contractDocument.create).mockResolvedValueOnce({
      id: "doc-xss",
      wordCount: 5,
      version: 1,
      updatedAt: new Date(),
    } as any)
    const xssContent = {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Hello <script>alert(1)</script> World" }],
        },
      ],
    }
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    await PUT(
      new Request("http://localhost/api/contracts/contract-1/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: xssContent, wordCount: 5, clientVersion: 0 }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    const createCall = vi.mocked(prisma.contractDocument.create).mock.calls[0][0] as any
    const paragraph = createCall.data.content.content[0]
    const textNode = paragraph.content[0]
    expect(textNode.text).not.toContain("<script>")
    expect(textNode.text).toContain("Hello")
    expect(textNode.text).toContain("World")
  })

  it("accepts legacy Slate array format", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.contractDocument.create).mockResolvedValueOnce({
      id: "doc-slate",
      wordCount: 3,
      version: 1,
      updatedAt: new Date(),
    } as any)
    const slateContent = [{ type: "p", children: [{ text: "Hello world" }] }]
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    const res = await PUT(
      new Request("http://localhost/api/contracts/contract-1/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: slateContent, wordCount: 3, clientVersion: 0 }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(200)
  })

  it("writes an activity row on successful save", async () => {
    const { writeActivity } = await import("@/lib/db/activity")
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce(null)
    vi.mocked(prisma.contractDocument.create).mockResolvedValueOnce({
      id: "doc-act",
      wordCount: 5,
      version: 1,
      updatedAt: new Date(),
    } as any)
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    await PUT(
      new Request("http://localhost/api/contracts/contract-1/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: validContent, wordCount: 5, clientVersion: 0 }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(writeActivity).toHaveBeenCalledWith("contract-1", "user-admin", "DOCUMENT_SAVED", undefined, undefined, prisma)
  })

  it("returns 413 when content payload exceeds 5 MB", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    // Build a content string larger than 5 MB
    const bigContent = {
      type: "doc",
      content: [{ type: "text", text: "x".repeat(6 * 1024 * 1024) }],
    }
    const { PUT } = await import("@/app/api/contracts/[id]/document/route")
    const res = await PUT(
      new Request("http://localhost/api/contracts/contract-1/document", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: bigContent, wordCount: 1, clientVersion: 0 }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(413)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 3. POST /api/contracts/[id]/document/export
// ══════════════════════════════════════════════════════════════════════════════

describe("POST /api/contracts/[id]/document/export", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMocks() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(null)
    const { POST } = await import("@/app/api/contracts/[id]/document/export/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "docx" }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(401)
  })

  it("does not allow a generic API key to create an export job", async () => {
    const { documentExportQueue } = await import("@/lib/jobs/queues")
    vi.mocked(resolveAuth).mockResolvedValue({ ...adminCtx, source: "api_key", scopes: ["read", "write"] } as never)
    const { POST } = await import("@/app/api/contracts/[id]/document/export/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "docx" }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(403)
    expect(documentExportQueue.add).not.toHaveBeenCalled()
  })

  it("returns 404 when contract not in org", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/document/export/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "docx" }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(404)
  })

  it("returns 422 when contract has no document", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/document/export/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "docx" }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("no_document")
  })

  it("returns 404 when access is revoked while the export binding transaction waits", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(lockCurrentAgreementPermission).mockResolvedValueOnce(null)
    const { documentExportQueue } = await import("@/lib/jobs/queues")
    const { POST } = await import("@/app/api/contracts/[id]/document/export/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "docx" }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(404)
    expect(documentExportQueue.add).not.toHaveBeenCalled()
  })

  it("returns 422 for invalid format", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    const { POST } = await import("@/app/api/contracts/[id]/document/export/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "txt" }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(422)
  })

  it("enqueues export job and returns 202 with jobId for docx format", async () => {
    const { documentExportQueue } = await import("@/lib/jobs/queues")
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce(mockDocument as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/export/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "docx" }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.jobId).toEqual(expect.any(String))
    expect(documentExportQueue.add).toHaveBeenCalledWith("export", {
      jobId: expect.any(String),
    }, expect.objectContaining({ jobId: expect.any(String) }))
  })

  it("enqueues export job for pdf format", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce(mockDocument as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/export/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "pdf" }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(202)
  })

  it("reuses the exact unexpired ready artifact without another conversion", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    ;(prisma as any).documentExportArtifact.findFirst.mockResolvedValueOnce({
      jobId: "existing-export-job",
      state: "READY",
    })
    const { POST } = await import("@/app/api/contracts/[id]/document/export/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "docx" }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(202)
    expect(await res.json()).toEqual({ jobId: "existing-export-job" })
    expect(mockDocumentExportQueue.add).not.toHaveBeenCalled()
  })

  it("creates a fresh artifact and Bull job after a prior durable export failed", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    ;(prisma as any).documentExportArtifact.findFirst.mockResolvedValueOnce(null)
    const createdIds: string[] = []
    ;(prisma as any).documentExportArtifact.create.mockImplementationOnce(async ({ data }: { data: { jobId: string } }) => {
      createdIds.push(data.jobId)
      return { jobId: data.jobId, state: "QUEUED" }
    })
    const { POST } = await import("@/app/api/contracts/[id]/document/export/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format: "docx" }),
      }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(202)
    expect(createdIds).toHaveLength(1)
    expect(createdIds[0]).not.toBe("failed-export-job")
    expect(mockDocumentExportQueue.add).toHaveBeenCalledWith("export", { jobId: createdIds[0] }, { jobId: createdIds[0] })
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 4. GET /api/contracts/[id]/document/export/[jobId]
// ══════════════════════════════════════════════════════════════════════════════

describe("GET /api/contracts/[id]/document/export/[jobId]", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    resetMocks()
    const { getDocumentExportQueue } = await import("@/lib/jobs/queues")
    vi.mocked(getDocumentExportQueue).mockReset()
    vi.mocked(getDocumentExportQueue).mockReturnValue({
      getJob: vi.fn().mockResolvedValue(mockExportJob),
    } as never)
  })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(null)
    const { GET } = await import("@/app/api/contracts/[id]/document/export/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/export/export-job-1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "export-job-1" }) },
    )
    expect(res.status).toBe(401)
  })

  it("does not expose export job state or bytes to a generic API key", async () => {
    const { getDocumentExportQueue } = await import("@/lib/jobs/queues")
    vi.mocked(resolveAuth).mockResolvedValue({ ...adminCtx, source: "api_key", scopes: ["read"] } as never)
    const { GET } = await import("@/app/api/contracts/[id]/document/export/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/export/export-job-1?download=1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "export-job-1" }) },
    )
    expect(res.status).toBe(403)
    expect(getDocumentExportQueue).not.toHaveBeenCalled()
    const { storage } = await import("@/lib/storage")
    expect(storage.getObject).not.toHaveBeenCalled()
  })

  it("does not expose job state or sign an export after the requester's grant is revoked", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/document/export/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/export/export-job-1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "export-job-1" }) },
    )
    expect(res.status).toBe(404)
    const { storage } = await import("@/lib/storage")
    expect(storage.getSignedDownloadUrl).not.toHaveBeenCalled()
  })

  it("returns 404 when contract not in org", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(otherOrgContract as any)
    const { GET } = await import("@/app/api/contracts/[id]/document/export/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/export/export-job-1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "export-job-1" }) },
    )
    expect(res.status).toBe(404)
  })

  it("returns 404 when the durable artifact does not exist", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    ;(prisma as any).documentExportArtifact.findFirst.mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/document/export/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/export/no-such-job"),
      { params: Promise.resolve({ id: "contract-1", jobId: "no-such-job" }) },
    )
    expect(res.status).toBe(404)
  })

  it("returns 404 when job belongs to a different user", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    ;(prisma as any).documentExportArtifact.findFirst.mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/document/export/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/export/export-job-1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "export-job-1" }) },
    )
    expect(res.status).toBe(404)
  })

  it("returns pending status when job is still processing", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    const { GET } = await import("@/app/api/contracts/[id]/document/export/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/export/export-job-1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "export-job-1" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("pending")
  })

  it("returns an authenticated same-origin download path after the authorized requester polls", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    ;(prisma as any).documentExportArtifact.findFirst.mockResolvedValueOnce({
      ...mockExportArtifact,
      state: "READY",
      storageKey: "exports/org-1/contract-1/export-job-1/attempt-1.docx",
      publishedAt: new Date(),
    })
    const { GET } = await import("@/app/api/contracts/[id]/document/export/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/export/export-job-1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "export-job-1" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("complete")
    expect(body.downloadUrl).toBe("/api/contracts/contract-1/document/export/export-job-1?download=1")
    const { storage } = await import("@/lib/storage")
    expect(storage.getSignedDownloadUrl).not.toHaveBeenCalled()
  })

  it("streams the completed export only through the reauthorized route", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    ;(prisma as any).documentExportArtifact.findFirst.mockResolvedValueOnce({
      ...mockExportArtifact,
      state: "READY",
      storageKey: "exports/org-1/contract-1/export-job-1/attempt-1.docx",
      publishedAt: new Date(),
    })
    const { GET } = await import("@/app/api/contracts/[id]/document/export/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/export/export-job-1?download=1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "export-job-1" }) },
    )
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("private, no-store")
    expect(res.headers.get("content-disposition")).toContain("contract-export.docx")
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe("export")
    const { storage } = await import("@/lib/storage")
    expect(storage.getObject).toHaveBeenCalledWith(
      "exports/org-1/contract-1/export-job-1/attempt-1.docx",
      MAX_CONTRACT_FILE_BYTES,
    )
  })

  it("returns only a generic failure when the protected object cannot be read", async () => {
    const { storage } = await import("@/lib/storage")
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(storage.getObject).mockRejectedValueOnce(new Error("private storage endpoint and key"))
    ;(prisma as any).documentExportArtifact.findFirst.mockResolvedValueOnce({
      ...mockExportArtifact,
      state: "READY",
      storageKey: "exports/org-1/contract-1/export-job-1/attempt-1.docx",
      publishedAt: new Date(),
    })
    const { GET } = await import("@/app/api/contracts/[id]/document/export/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/export/export-job-1?download=1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "export-job-1" }) },
    )
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: "export_failed" })
  })

  it("does not sign a completed job that has no storage key", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    ;(prisma as any).documentExportArtifact.findFirst.mockResolvedValueOnce({ ...mockExportArtifact, state: "READY", storageKey: null, publishedAt: new Date() })
    const { GET } = await import("@/app/api/contracts/[id]/document/export/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/export/export-job-1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "export-job-1" }) },
    )
    expect(await res.json()).toEqual({ status: "failed", error: "export_failed" })
  })

  it("returns failed status when job failed", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    ;(prisma as any).documentExportArtifact.findFirst.mockResolvedValueOnce({ ...mockExportArtifact, state: "FAILED" })
    const { GET } = await import("@/app/api/contracts/[id]/document/export/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/export/export-job-1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "export-job-1" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("failed")
    expect(body.error).toBe("export_failed")
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 5. POST /api/contracts/[id]/document/extract
// ══════════════════════════════════════════════════════════════════════════════

describe("POST /api/contracts/[id]/document/extract", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMocks() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(null)
    const { POST } = await import("@/app/api/contracts/[id]/document/extract/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/extract", { method: "POST" }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 for member role (requires legal or above)", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(memberCtx as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/extract/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/extract", { method: "POST" }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(403)
  })

  it("returns 403 for viewer role", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(viewerCtx as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/extract/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/extract", { method: "POST" }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when contract not in org", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(legalCtx as any)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(otherOrgContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/extract/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/extract", { method: "POST" }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(404)
  })

  it("returns 422 when no document exists", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(legalCtx as any)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/document/extract/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/extract", { method: "POST" }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("no_document")
  })

  it("returns 422 when document content is empty", async () => {
    const { plateToPlaintext } = await import("@/lib/editor/plate-to-plaintext")
    vi.mocked(resolveAuth).mockResolvedValue(legalCtx as any)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce({
      content: { type: "doc", content: [] },
    } as any)
    vi.mocked(plateToPlaintext).mockReturnValueOnce("")
    const { POST } = await import("@/app/api/contracts/[id]/document/extract/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/extract", { method: "POST" }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("empty_document")
  })

  it("enqueues ai_extract job and returns { queued: true } for legal role", async () => {
    const { contractAiExtractQueue } = await import("@/lib/jobs/queues")
    vi.mocked(resolveAuth).mockResolvedValue(legalCtx as any)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce({
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Contract text here" }] }] },
    } as any)
    vi.mocked(prisma.contract.update).mockResolvedValueOnce(draftContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/extract/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/extract", { method: "POST" }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.queued).toBe(true)
    expect(contractAiExtractQueue.add).toHaveBeenCalledWith("ai_extract", expect.objectContaining({
      contractId: "contract-1",
    }))
  })

  it("admin role can also trigger extraction", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce({
      content: { type: "doc", content: [{ type: "text", text: "Some text" }] },
    } as any)
    vi.mocked(prisma.contract.update).mockResolvedValueOnce(draftContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/extract/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/document/extract", { method: "POST" }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(200)
  })

  it("writes METADATA_EXTRACTED activity on success", async () => {
    const { writeActivity } = await import("@/lib/db/activity")
    vi.mocked(resolveAuth).mockResolvedValue(legalCtx as any)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce({
      content: { type: "doc", content: [{ type: "text", text: "Some text" }] },
    } as any)
    vi.mocked(prisma.contract.update).mockResolvedValueOnce(draftContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/extract/route")
    await POST(
      new Request("http://localhost/api/contracts/contract-1/document/extract", { method: "POST" }),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(writeActivity).toHaveBeenCalledWith(
      "contract-1",
      "user-admin",
      "METADATA_EXTRACTED",
      expect.any(String),
    )
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 6. POST /api/contracts/[id]/document/image
// ══════════════════════════════════════════════════════════════════════════════

describe("POST /api/contracts/[id]/document/image", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMocks() })

  // jsdom does not support multipart FormData parsing in Request.formData().
  // We work around this by patching req.formData with Object.defineProperty,
  // the same technique used in input-validation.test.ts.
  function makeImageRequest(file: File | null): Request {
    const req = new Request("http://localhost/api/contracts/contract-1/document/image", {
      method: "POST",
    })
    const fd = new FormData()
    if (file) fd.append("file", file)
    Object.defineProperty(req, "formData", {
      value: () => Promise.resolve(fd),
      writable: true,
    })
    return req
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(null)
    const { POST } = await import("@/app/api/contracts/[id]/document/image/route")
    const res = await POST(
      makeImageRequest(new File(["data"], "img.png", { type: "image/png" })),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 when contract not in org", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(otherOrgContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/image/route")
    const res = await POST(
      makeImageRequest(new File(["data"], "img.png", { type: "image/png" })),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(404)
  })

  it("returns 400 when no file is provided", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/image/route")
    // Pass null to makeImageRequest so the FormData has no "file" field
    const res = await POST(
      makeImageRequest(null),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("Missing file")
  })

  it("returns 422 for disallowed file type", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/image/route")
    const res = await POST(
      makeImageRequest(new File(["data"], "doc.pdf", { type: "application/pdf" })),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("invalid_file_type")
  })

  it("returns 422 when file exceeds 5 MB", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/image/route")
    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], "big.png", { type: "image/png" })
    const res = await POST(
      makeImageRequest(bigFile),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("file_too_large")
  })

  it("uploads image and returns signed URL on success", async () => {
    const { storage } = await import("@/lib/storage")
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/image/route")
    const res = await POST(
      makeImageRequest(new File(["img data"], "photo.png", { type: "image/png" })),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.url).toBe("https://storage.example.com/signed/img.png")
    expect(storage.upload).toHaveBeenCalledOnce()
    expect(storage.getSignedDownloadUrl).toHaveBeenCalledOnce()
  })

  it("accepts all allowed MIME types (jpeg, gif, webp, svg+xml)", async () => {
    const allowedTypes = ["image/jpeg", "image/gif", "image/webp", "image/svg+xml"]
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    const { POST } = await import("@/app/api/contracts/[id]/document/image/route")
    for (const mimeType of allowedTypes) {
      vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
      const ext = mimeType.split("/")[1].replace("+xml", ".svg").split("+")[0]
      const res = await POST(
        makeImageRequest(new File(["data"], `img.${ext}`, { type: mimeType })),
        { params: Promise.resolve({ id: "contract-1" }) },
      )
      expect(res.status).toBe(200)
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 7. POST /api/contracts/[id]/document/import
// ══════════════════════════════════════════════════════════════════════════════

describe("POST /api/contracts/[id]/document/import", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMocks() })

  // DOCX magic bytes: PK zip header 50 4b 03 04
  const DOCX_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
  // PDF magic bytes: %PDF = 25 50 44 46
  const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46])

  function makeDocxFile(name = "contract.docx"): File {
    const payload = new Uint8Array([...DOCX_MAGIC, ...new TextEncoder().encode("PK content")])
    return new File([payload], name, {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
  }

  function makePdfFile(name = "contract.pdf"): File {
    const payload = new Uint8Array([...PDF_MAGIC, ...new TextEncoder().encode("PDF content")])
    return new File([payload], name, { type: "application/pdf" })
  }

  // jsdom does not support multipart FormData parsing — patch req.formData.
  function makeImportRequest(file: File | null): Request {
    const req = new Request("http://localhost/api/contracts/contract-1/document/import", {
      method: "POST",
    })
    const fd = new FormData()
    if (file) fd.append("file", file)
    Object.defineProperty(req, "formData", {
      value: () => Promise.resolve(fd),
      writable: true,
    })
    return req
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(null)
    const { POST } = await import("@/app/api/contracts/[id]/document/import/route")
    const res = await POST(
      makeImportRequest(makeDocxFile()),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 for viewer role", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(viewerCtx as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/import/route")
    const res = await POST(
      makeImportRequest(makeDocxFile()),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when contract not in org", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(otherOrgContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/import/route")
    const res = await POST(
      makeImportRequest(makeDocxFile()),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(404)
  })

  it("returns 422 read_only_status for ACTIVE contracts", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...draftContract,
      status: "ACTIVE",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/import/route")
    const res = await POST(
      makeImportRequest(makeDocxFile()),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("read_only_status")
  })

  it("returns 400 when no file is provided", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/import/route")
    // null → FormData has no "file" field
    const res = await POST(
      makeImportRequest(null),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("missing_file")
  })

  it("returns 422 for file with invalid magic bytes (not DOCX or PDF)", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/import/route")
    const invalidFile = new File([new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04])], "bad.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
    const res = await POST(
      makeImportRequest(invalidFile),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("invalid_file_type")
  })

  it("accepts DOCX file (magic bytes validated), enqueues convert job, returns 202", async () => {
    const { documentConvertQueue } = await import("@/lib/jobs/queues")
    const { storage } = await import("@/lib/storage")
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/import/route")
    const res = await POST(
      makeImportRequest(makeDocxFile()),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(202)
    const body = await res.json()
    expect(body.jobId).toEqual(expect.any(String))
    expect(storage.upload).toHaveBeenCalledOnce()
    expect(documentConvertQueue.add).toHaveBeenCalledWith("convert", expect.objectContaining({
      contractId: "contract-1",
      fileType: "docx",
      jobId: body.jobId,
      deleteSource: true,
    }), { jobId: body.jobId })
    expect(mockConvertJob.updateData).not.toHaveBeenCalled()
  })

  it("accepts PDF file (magic bytes validated), enqueues convert job with fileType pdf", async () => {
    const { documentConvertQueue } = await import("@/lib/jobs/queues")
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/import/route")
    const res = await POST(
      makeImportRequest(makePdfFile()),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(202)
    expect(documentConvertQueue.add).toHaveBeenCalledWith("convert", expect.objectContaining({
      fileType: "pdf",
      deleteSource: true,
    }), { jobId: expect.any(String) })
  })

  it("returns 413 when file exceeds 25 MB", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/import/route")
    // 26 MB file — we skip adding DOCX magic so the size check fires first
    const bigPayload = new Uint8Array(26 * 1024 * 1024)
    bigPayload.set(DOCX_MAGIC, 0)
    const bigFile = new File([bigPayload], "big.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
    const res = await POST(
      makeImportRequest(bigFile),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(413)
  })

  it("member role can import documents", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(memberCtx as any)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/document/import/route")
    const res = await POST(
      makeImportRequest(makeDocxFile()),
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(202)
  })

  it("deletes only its temporary source when enqueue failure is confirmed", async () => {
    const { storage } = await import("@/lib/storage")
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as never)
    mockDocumentConvertQueue.add.mockRejectedValueOnce(new Error("redis unavailable"))
    mockDocumentConvertQueue.getJob.mockResolvedValueOnce(undefined)

    const { POST } = await import("@/app/api/contracts/[id]/document/import/route")
    const res = await POST(makeImportRequest(makeDocxFile()), { params: Promise.resolve({ id: "contract-1" }) })

    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: "import_enqueue_failed" })
    expect(storage.delete).toHaveBeenCalledWith(expect.stringMatching(
      /^tmp\/docx-imports\/contract-1\/[0-9a-f-]+\.docx$/,
    ))
  })

  it("cleans its UUID-scoped source when upload acknowledgement is lost", async () => {
    const { storage } = await import("@/lib/storage")
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as never)
    vi.mocked(storage.upload).mockRejectedValueOnce(new Error("upload acknowledgement lost"))

    const { POST } = await import("@/app/api/contracts/[id]/document/import/route")
    const res = await POST(makeImportRequest(makeDocxFile()), { params: Promise.resolve({ id: "contract-1" }) })

    expect(res.status).toBe(502)
    expect(await res.json()).toEqual({ error: "import_upload_failed" })
    expect(storage.delete).toHaveBeenCalledWith(expect.stringMatching(
      /^tmp\/docx-imports\/contract-1\/[0-9a-f-]+\.docx$/,
    ))
    expect(mockDocumentConvertQueue.add).not.toHaveBeenCalled()
  })

  it("treats a committed job as success when add acknowledgement is lost", async () => {
    const { storage } = await import("@/lib/storage")
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as never)
    mockDocumentConvertQueue.add.mockRejectedValueOnce(new Error("ack lost"))
    mockDocumentConvertQueue.getJob.mockResolvedValueOnce(mockConvertJob)

    const { POST } = await import("@/app/api/contracts/[id]/document/import/route")
    const res = await POST(makeImportRequest(makePdfFile()), { params: Promise.resolve({ id: "contract-1" }) })

    expect(res.status).toBe(202)
    expect(storage.delete).not.toHaveBeenCalled()
  })

  it("retains the source when queue state cannot be established", async () => {
    const { storage } = await import("@/lib/storage")
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as never)
    mockDocumentConvertQueue.add.mockRejectedValueOnce(new Error("ack lost"))
    mockDocumentConvertQueue.getJob.mockRejectedValueOnce(new Error("redis unavailable"))

    const { POST } = await import("@/app/api/contracts/[id]/document/import/route")
    const res = await POST(makeImportRequest(makePdfFile()), { params: Promise.resolve({ id: "contract-1" }) })

    expect(res.status).toBe(502)
    expect(storage.delete).not.toHaveBeenCalled()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// 8. GET /api/contracts/[id]/document/import/[jobId]
// ══════════════════════════════════════════════════════════════════════════════

describe("GET /api/contracts/[id]/document/import/[jobId]", () => {
  beforeEach(() => { vi.clearAllMocks(); resetMocks() })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(null)
    const { GET } = await import("@/app/api/contracts/[id]/document/import/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/import/convert-job-1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "convert-job-1" }) },
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 when contract not in org", async () => {
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(otherOrgContract as any)
    const { GET } = await import("@/app/api/contracts/[id]/document/import/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/import/convert-job-1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "convert-job-1" }) },
    )
    expect(res.status).toBe(404)
  })

  it("returns failed status when job not found in queue", async () => {
    const { getDocumentConvertQueue } = await import("@/lib/jobs/queues")
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    vi.mocked(getDocumentConvertQueue).mockReturnValueOnce({
      getJob: vi.fn().mockResolvedValue(null),
    } as any)
    const { GET } = await import("@/app/api/contracts/[id]/document/import/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/import/no-such-job"),
      { params: Promise.resolve({ id: "contract-1", jobId: "no-such-job" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("failed")
    expect(body.error).toBe("job_not_found")
  })

  it("returns 404 when job was requested by a different user", async () => {
    const { getDocumentConvertQueue } = await import("@/lib/jobs/queues")
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    const foreignJob = {
      ...mockConvertJob,
      data: { ...mockConvertJob.data, requestedById: "user-other" },
    }
    vi.mocked(getDocumentConvertQueue).mockReturnValueOnce({
      getJob: vi.fn().mockResolvedValue(foreignJob),
    } as any)
    const { GET } = await import("@/app/api/contracts/[id]/document/import/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/import/convert-job-1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "convert-job-1" }) },
    )
    expect(res.status).toBe(404)
  })

  it("returns pending status when job is still active", async () => {
    const { getDocumentConvertQueue } = await import("@/lib/jobs/queues")
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    const pendingJob = { ...mockConvertJob, getState: vi.fn().mockResolvedValue("active") }
    vi.mocked(getDocumentConvertQueue).mockReturnValueOnce({
      getJob: vi.fn().mockResolvedValue(pendingJob),
    } as any)
    const { GET } = await import("@/app/api/contracts/[id]/document/import/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/import/convert-job-1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "convert-job-1" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("pending")
  })

  it("returns complete status when job completed successfully", async () => {
    const { getDocumentConvertQueue } = await import("@/lib/jobs/queues")
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    const completedJob = { ...mockConvertJob, getState: vi.fn().mockResolvedValue("completed") }
    vi.mocked(getDocumentConvertQueue).mockReturnValueOnce({
      getJob: vi.fn().mockResolvedValue(completedJob),
    } as any)
    const { GET } = await import("@/app/api/contracts/[id]/document/import/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/import/convert-job-1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "convert-job-1" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("complete")
  })

  it("returns failed status with reason when job failed", async () => {
    const { getDocumentConvertQueue } = await import("@/lib/jobs/queues")
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    const failedJob = {
      ...mockConvertJob,
      getState: vi.fn().mockResolvedValue("failed"),
      failedReason: "docx_parse_error",
    }
    vi.mocked(getDocumentConvertQueue).mockReturnValueOnce({
      getJob: vi.fn().mockResolvedValue(failedJob),
    } as any)
    const { GET } = await import("@/app/api/contracts/[id]/document/import/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/import/convert-job-1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "convert-job-1" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe("failed")
    expect(body.error).toBe("conversion_failed")
  })

  it("job for different contract id returns 404 (cross-contract access prevention)", async () => {
    const { getDocumentConvertQueue } = await import("@/lib/jobs/queues")
    vi.mocked(resolveAuth).mockResolvedValue(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(draftContract as any)
    const wrongContractJob = {
      ...mockConvertJob,
      data: { ...mockConvertJob.data, contractId: "contract-other" },
    }
    vi.mocked(getDocumentConvertQueue).mockReturnValueOnce({
      getJob: vi.fn().mockResolvedValue(wrongContractJob),
    } as any)
    const { GET } = await import("@/app/api/contracts/[id]/document/import/[jobId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/document/import/convert-job-1"),
      { params: Promise.resolve({ id: "contract-1", jobId: "convert-job-1" }) },
    )
    expect(res.status).toBe(404)
  })
})
