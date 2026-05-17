/**
 * Integration tests for signing management routes.
 *
 * Covers:
 *   - GET  /api/contracts/[id]/signing           (signing status + signers list)
 *   - POST /api/contracts/[id]/signing/signers   (add signer)
 *   - DELETE /api/contracts/[id]/signing/signers/[signerId]  (remove signer)
 *   - POST /api/contracts/[id]/signing/remind    (send reminder)
 *   - POST /api/contracts/[id]/signing/reset     (reset signing process)
 *   - POST /api/contracts/[id]/signing/send      (send for signature)
 *
 * NOT covered here (see signing.test.ts):
 *   - POST /api/contracts/[id]/sign
 *   - POST /api/webhooks/docuseal
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@/lib/db/client"
import { _clearStore } from "@/lib/rate-limit"

// ─── Top-level mocks ──────────────────────────────────────────────────────────

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
    getSignedDownloadUrl: vi.fn().mockResolvedValue("https://s3.example.com/file.pdf"),
    upload: vi.fn().mockResolvedValue("orgs/org-1/contracts/contract-1/123_file.pdf"),
  },
}))

vi.mock("@/lib/docuseal", () => ({
  createTemplate: vi.fn().mockResolvedValue({ id: 42, attachmentUuid: null }),
  addFieldsToTemplate: vi.fn().mockResolvedValue(true),
  createSubmission: vi.fn().mockResolvedValue({
    id: 99,
    submitters: [
      { slug: "slug-abc", embed_src: "https://docuseal.com/s/slug-abc" },
      { slug: "slug-def", embed_src: "https://docuseal.com/s/slug-def" },
    ],
  }),
  remindSubmitter: vi.fn().mockResolvedValue(true),
  archiveSubmission: vi.fn().mockResolvedValue(true),
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ─── Auth context helpers ─────────────────────────────────────────────────────

import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"

const adminCtx = {
  userId: "user-admin",
  organizationId: "org-1",
  role: "admin",
  source: "session" as const,
  requestId: "req-test",
}

const legalCtx = { ...adminCtx, role: "legal", userId: "user-legal" }
const memberCtx = { ...adminCtx, role: "member", userId: "user-member" }
const viewerCtx = { ...adminCtx, role: "viewer", userId: "user-viewer" }

function mockAuth(ctx: typeof adminCtx | null) {
  vi.mocked(resolveAuth).mockResolvedValue(ctx as Awaited<ReturnType<typeof resolveAuth>>)
}

// ─── Common fixtures ──────────────────────────────────────────────────────────

const baseContract = {
  id: "contract-1",
  organizationId: "org-1",
  title: "Test Agreement",
  status: "DRAFT",
  docusealSubmissionId: null as string | null,
  signingStatus: null as string | null,
  counterpartyContact: "alice@acme.com",
  counterpartyName: "ACME Corp",
}

const awaitingContract = {
  ...baseContract,
  status: "AWAITING_SIGNATURE",
}

const signerAlice = {
  id: "signer-1",
  contractId: "contract-1",
  name: "Alice",
  email: "alice@acme.com",
  isInternal: false,
  status: "not_sent",
  externalId: null as string | null,
  signedAt: null as Date | null,
  createdAt: new Date("2024-01-01"),
}

const signerBob = {
  id: "signer-2",
  contractId: "contract-1",
  name: "Bob",
  email: "bob@acme.com",
  isInternal: true,
  status: "signed",
  externalId: "slug-def",
  signedAt: new Date("2024-02-01"),
  createdAt: new Date("2024-01-02"),
}

const mockFile = {
  id: "file-1",
  contractId: "contract-1",
  filename: "agreement.pdf",
  storageKey: "orgs/org-1/contracts/contract-1/agreement.pdf",
  mimeType: "application/pdf",
  sizeBytes: 2048,
  isSigned: false,
  isLatest: true,
  version: 1,
  uploadedById: "user-admin",
  createdAt: new Date(),
}

beforeEach(() => {
  vi.clearAllMocks()
  _clearStore()
  vi.mocked(requireWriteScope).mockReturnValue(null)
})

// ─── GET /api/contracts/[id]/signing ─────────────────────────────────────────

describe("GET /api/contracts/[id]/signing", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth(null)
    const { GET } = await import("@/app/api/contracts/[id]/signing/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/signing"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 when contract belongs to another org", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...baseContract,
      organizationId: "org-attacker",
    } as any)
    const { GET } = await import("@/app/api/contracts/[id]/signing/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/signing"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 404 when contract does not exist", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/signing/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/signing"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns signing status and empty signers list when no signers", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    vi.mocked(prisma.contractSigner.findMany).mockResolvedValueOnce([])
    const { GET } = await import("@/app/api/contracts/[id]/signing/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/signing"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.signers).toEqual([])
    expect(body.submissionId).toBeNull()
    expect(body.signingStatus).toBeNull()
    expect(body.totalSigners).toBe(0)
    expect(body.collectedSignatures).toBe(0)
  })

  it("returns correct counts when some signers have signed", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...baseContract,
      docusealSubmissionId: "99",
      signingStatus: "pending",
    } as any)
    vi.mocked(prisma.contractSigner.findMany).mockResolvedValueOnce([
      signerAlice,
      signerBob,
    ] as any)
    const { GET } = await import("@/app/api/contracts/[id]/signing/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/signing"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalSigners).toBe(2)
    expect(body.collectedSignatures).toBe(1) // only signerBob has status "signed"
    expect(body.submissionId).toBe("99")
    expect(body.signingStatus).toBe("pending")
  })

  it("viewer can read signing status (read-only endpoint, no write check)", async () => {
    mockAuth(viewerCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    vi.mocked(prisma.contractSigner.findMany).mockResolvedValueOnce([signerAlice] as any)
    const { GET } = await import("@/app/api/contracts/[id]/signing/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/signing"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.totalSigners).toBe(1)
  })
})

// ─── POST /api/contracts/[id]/signing/signers ─────────────────────────────────

describe("POST /api/contracts/[id]/signing/signers", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth(null)
    const { POST } = await import("@/app/api/contracts/[id]/signing/signers/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/signers", {
        method: "POST",
        body: JSON.stringify({ name: "Alice", email: "alice@acme.com" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when role is below legal", async () => {
    mockAuth(memberCtx)
    const { POST } = await import("@/app/api/contracts/[id]/signing/signers/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/signers", {
        method: "POST",
        body: JSON.stringify({ name: "Alice", email: "alice@acme.com" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 403 when role is viewer", async () => {
    mockAuth(viewerCtx)
    const { POST } = await import("@/app/api/contracts/[id]/signing/signers/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/signers", {
        method: "POST",
        body: JSON.stringify({ name: "Alice", email: "alice@acme.com" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when contract belongs to another org", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...baseContract,
      organizationId: "org-attacker",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/signers/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/signers", {
        method: "POST",
        body: JSON.stringify({ name: "Alice", email: "alice@acme.com" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 409 when submission already sent", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...baseContract,
      docusealSubmissionId: "99",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/signers/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/signers", {
        method: "POST",
        body: JSON.stringify({ name: "Alice", email: "alice@acme.com" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/after submission/)
  })

  it("returns 400 for invalid JSON body", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/signers/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/signers", {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(400)
  })

  it("returns 400 for missing required fields", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/signers/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/signers", {
        method: "POST",
        body: JSON.stringify({ name: "Alice" }), // missing email
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(400)
  })

  it("returns 400 for invalid email", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/signers/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/signers", {
        method: "POST",
        body: JSON.stringify({ name: "Alice", email: "not-an-email" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(400)
  })

  it("returns 409 when signer email already exists for this contract", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    vi.mocked(prisma.contractSigner.findFirst).mockResolvedValueOnce(signerAlice as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/signers/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/signers", {
        method: "POST",
        body: JSON.stringify({ name: "Alice", email: "alice@acme.com" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/already exists/)
  })

  it("creates signer and returns 201 on success", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    vi.mocked(prisma.contractSigner.findFirst).mockResolvedValueOnce(null)
    const createdSigner = { ...signerAlice, id: "signer-new" }
    vi.mocked(prisma.contractSigner.create).mockResolvedValueOnce(createdSigner as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/signers/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/signers", {
        method: "POST",
        body: JSON.stringify({ name: "Alice", email: "alice@acme.com", isInternal: false }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.signer).toBeDefined()
    expect(body.signer.email).toBe("alice@acme.com")
    expect(prisma.contractSigner.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          contractId: "contract-1",
          name: "Alice",
          email: "alice@acme.com",
          isInternal: false,
        }),
      }),
    )
  })

  it("legal role can add a signer", async () => {
    mockAuth(legalCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    vi.mocked(prisma.contractSigner.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.contractSigner.create).mockResolvedValueOnce(signerAlice as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/signers/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/signers", {
        method: "POST",
        body: JSON.stringify({ name: "Alice", email: "alice@acme.com" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(201)
  })
})

// ─── DELETE /api/contracts/[id]/signing/signers/[signerId] ───────────────────

describe("DELETE /api/contracts/[id]/signing/signers/[signerId]", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth(null)
    const { DELETE } = await import("@/app/api/contracts/[id]/signing/signers/[signerId]/route")
    const res = await DELETE(
      new Request("http://localhost/api/contracts/contract-1/signing/signers/signer-1", {
        method: "DELETE",
      }),
      { params: { id: "contract-1", signerId: "signer-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when role is member", async () => {
    mockAuth(memberCtx)
    const { DELETE } = await import("@/app/api/contracts/[id]/signing/signers/[signerId]/route")
    const res = await DELETE(
      new Request("http://localhost/api/contracts/contract-1/signing/signers/signer-1", {
        method: "DELETE",
      }),
      { params: { id: "contract-1", signerId: "signer-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when contract belongs to another org", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...baseContract,
      organizationId: "org-attacker",
    } as any)
    const { DELETE } = await import("@/app/api/contracts/[id]/signing/signers/[signerId]/route")
    const res = await DELETE(
      new Request("http://localhost/api/contracts/contract-1/signing/signers/signer-1", {
        method: "DELETE",
      }),
      { params: { id: "contract-1", signerId: "signer-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 409 when submission already sent", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...baseContract,
      docusealSubmissionId: "99",
    } as any)
    const { DELETE } = await import("@/app/api/contracts/[id]/signing/signers/[signerId]/route")
    const res = await DELETE(
      new Request("http://localhost/api/contracts/contract-1/signing/signers/signer-1", {
        method: "DELETE",
      }),
      { params: { id: "contract-1", signerId: "signer-1" } },
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/after submission/)
  })

  it("returns 404 when signer does not exist", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    vi.mocked(prisma.contractSigner.findUnique).mockResolvedValueOnce(null)
    const { DELETE } = await import("@/app/api/contracts/[id]/signing/signers/[signerId]/route")
    const res = await DELETE(
      new Request("http://localhost/api/contracts/contract-1/signing/signers/signer-999", {
        method: "DELETE",
      }),
      { params: { id: "contract-1", signerId: "signer-999" } },
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Signer not found")
  })

  it("returns 404 when signer belongs to a different contract", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    vi.mocked(prisma.contractSigner.findUnique).mockResolvedValueOnce({
      ...signerAlice,
      contractId: "contract-other",
    } as any)
    const { DELETE } = await import("@/app/api/contracts/[id]/signing/signers/[signerId]/route")
    const res = await DELETE(
      new Request("http://localhost/api/contracts/contract-1/signing/signers/signer-1", {
        method: "DELETE",
      }),
      { params: { id: "contract-1", signerId: "signer-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("deletes signer and returns success", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    vi.mocked(prisma.contractSigner.findUnique).mockResolvedValueOnce(signerAlice as any)
    vi.mocked(prisma.contractSigner.delete).mockResolvedValueOnce(signerAlice as any)
    const { DELETE } = await import("@/app/api/contracts/[id]/signing/signers/[signerId]/route")
    const res = await DELETE(
      new Request("http://localhost/api/contracts/contract-1/signing/signers/signer-1", {
        method: "DELETE",
      }),
      { params: { id: "contract-1", signerId: "signer-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(prisma.contractSigner.delete).toHaveBeenCalledWith({
      where: { id: "signer-1" },
    })
  })
})

// ─── POST /api/contracts/[id]/signing/remind ─────────────────────────────────

describe("POST /api/contracts/[id]/signing/remind", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth(null)
    const { POST } = await import("@/app/api/contracts/[id]/signing/remind/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/remind", {
        method: "POST",
        body: JSON.stringify({ signerId: "signer-1" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when role is member", async () => {
    mockAuth(memberCtx)
    const { POST } = await import("@/app/api/contracts/[id]/signing/remind/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/remind", {
        method: "POST",
        body: JSON.stringify({ signerId: "signer-1" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when contract belongs to another org", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...baseContract,
      organizationId: "org-attacker",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/remind/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/remind", {
        method: "POST",
        body: JSON.stringify({ signerId: "signer-1" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 400 for invalid JSON body", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/remind/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/remind", {
        method: "POST",
        body: "not-json",
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(400)
  })

  it("returns 400 for missing signerId", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/remind/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/remind", {
        method: "POST",
        body: JSON.stringify({}),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(400)
  })

  it("returns 404 when signer not found on the contract", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    vi.mocked(prisma.contractSigner.findFirst).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/signing/remind/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/remind", {
        method: "POST",
        body: JSON.stringify({ signerId: "signer-999" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error).toBe("Signer not found")
  })

  it("returns 400 when signer is already signed (non-pending)", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    vi.mocked(prisma.contractSigner.findFirst).mockResolvedValueOnce({
      ...signerBob,
      status: "signed",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/remind/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/remind", {
        method: "POST",
        body: JSON.stringify({ signerId: "signer-2" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/pending/)
  })

  it("returns 400 when signer has no externalId (submission not sent)", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    vi.mocked(prisma.contractSigner.findFirst).mockResolvedValueOnce({
      ...signerAlice,
      status: "pending",
      externalId: null,
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/remind/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/remind", {
        method: "POST",
        body: JSON.stringify({ signerId: "signer-1" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/not been sent/)
  })

  it("sends reminder and returns success", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(baseContract as any)
    vi.mocked(prisma.contractSigner.findFirst).mockResolvedValueOnce({
      ...signerAlice,
      status: "pending",
      externalId: "slug-abc",
    } as any)
    const { remindSubmitter } = await import("@/lib/docuseal")
    const { POST } = await import("@/app/api/contracts/[id]/signing/remind/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/remind", {
        method: "POST",
        body: JSON.stringify({ signerId: "signer-1" }),
        headers: { "Content-Type": "application/json" },
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(remindSubmitter).toHaveBeenCalledWith("slug-abc")
  })
})

// ─── POST /api/contracts/[id]/signing/reset ───────────────────────────────────

describe("POST /api/contracts/[id]/signing/reset", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth(null)
    const { POST } = await import("@/app/api/contracts/[id]/signing/reset/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/reset", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when role is member", async () => {
    mockAuth(memberCtx)
    const { POST } = await import("@/app/api/contracts/[id]/signing/reset/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/reset", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when contract belongs to another org", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...awaitingContract,
      signingStatus: "declined",
      organizationId: "org-attacker",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/reset/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/reset", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 400 when contract is not AWAITING_SIGNATURE", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...baseContract,
      status: "DRAFT",
      signingStatus: "declined",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/reset/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/reset", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/AWAITING_SIGNATURE/)
  })

  it("returns 400 when signingStatus is 'sent' (not resettable)", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...awaitingContract,
      signingStatus: "sent",
      docusealSubmissionId: "99",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/reset/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/reset", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/declined.*expired.*failed/i)
  })

  it("returns 400 when signingStatus is null (not resettable)", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...awaitingContract,
      signingStatus: null,
      docusealSubmissionId: null,
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/reset/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/reset", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(400)
  })

  it("resets declined signing: voids DocuSeal, resets signers, clears submission", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...awaitingContract,
      signingStatus: "declined",
      docusealSubmissionId: "99",
    } as any)
    vi.mocked(prisma.contractSigner.updateMany).mockResolvedValueOnce({ count: 2 } as any)
    vi.mocked(prisma.contract.update).mockResolvedValueOnce(awaitingContract as any)
    const { archiveSubmission } = await import("@/lib/docuseal")
    const { writeActivity } = await import("@/lib/db/activity")
    const { POST } = await import("@/app/api/contracts/[id]/signing/reset/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/reset", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ok).toBe(true)
    expect(archiveSubmission).toHaveBeenCalledWith(99)
    expect(prisma.contractSigner.updateMany).toHaveBeenCalledWith({
      where: { contractId: "contract-1" },
      data: { status: "not_sent", externalId: null, signedAt: null },
    })
    expect(prisma.contract.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "contract-1" },
        data: expect.objectContaining({
          docusealSubmissionId: null,
          signingStatus: null,
          signingUrl: null,
        }),
      }),
    )
    expect(writeActivity).toHaveBeenCalledWith(
      "contract-1",
      adminCtx.userId,
      "UPDATED",
      expect.stringContaining("99"),
    )
  })

  it("resets expired signing", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...awaitingContract,
      signingStatus: "expired",
      docusealSubmissionId: "100",
    } as any)
    vi.mocked(prisma.contractSigner.updateMany).mockResolvedValueOnce({ count: 1 } as any)
    vi.mocked(prisma.contract.update).mockResolvedValueOnce(awaitingContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/reset/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/reset", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it("resets failed signing", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...awaitingContract,
      signingStatus: "failed",
      docusealSubmissionId: "101",
    } as any)
    vi.mocked(prisma.contractSigner.updateMany).mockResolvedValueOnce({ count: 1 } as any)
    vi.mocked(prisma.contract.update).mockResolvedValueOnce(awaitingContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/reset/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/reset", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
  })

  it("continues reset even when DocuSeal archive fails (best-effort)", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...awaitingContract,
      signingStatus: "declined",
      docusealSubmissionId: "99",
    } as any)
    vi.mocked(prisma.contractSigner.updateMany).mockResolvedValueOnce({ count: 1 } as any)
    vi.mocked(prisma.contract.update).mockResolvedValueOnce(awaitingContract as any)
    const { archiveSubmission } = await import("@/lib/docuseal")
    vi.mocked(archiveSubmission).mockResolvedValueOnce(false)
    const { POST } = await import("@/app/api/contracts/[id]/signing/reset/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/reset", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    // Should still succeed — archive failure is non-blocking
    expect(res.status).toBe(200)
    expect((await res.json()).ok).toBe(true)
    // Signer reset and contract update should still have been called
    expect(prisma.contractSigner.updateMany).toHaveBeenCalled()
    expect(prisma.contract.update).toHaveBeenCalled()
  })

  it("skips DocuSeal archive when no submissionId", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...awaitingContract,
      signingStatus: "declined",
      docusealSubmissionId: null,
    } as any)
    vi.mocked(prisma.contractSigner.updateMany).mockResolvedValueOnce({ count: 0 } as any)
    vi.mocked(prisma.contract.update).mockResolvedValueOnce(awaitingContract as any)
    const { archiveSubmission } = await import("@/lib/docuseal")
    const { POST } = await import("@/app/api/contracts/[id]/signing/reset/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/reset", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    expect(archiveSubmission).not.toHaveBeenCalled()
  })
})

// ─── POST /api/contracts/[id]/signing/send ────────────────────────────────────

describe("POST /api/contracts/[id]/signing/send", () => {
  beforeEach(() => {
    process.env.DOCUSEAL_API_KEY = "test-docuseal-key"
    // Mock global fetch for file download
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => new ArrayBuffer(1024),
    }))
  })

  it("returns 401 when unauthenticated", async () => {
    mockAuth(null)
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when role is member", async () => {
    mockAuth(memberCtx)
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 403 when role is viewer", async () => {
    mockAuth(viewerCtx)
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when contract belongs to another org", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...awaitingContract,
      organizationId: "org-attacker",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 400 when contract status is not AWAITING_SIGNATURE", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...baseContract,
      status: "DRAFT",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/AWAITING_SIGNATURE/)
  })

  it("returns 503 when DOCUSEAL_API_KEY is not configured", async () => {
    delete process.env.DOCUSEAL_API_KEY
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(awaitingContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe("E-signature not configured")
  })

  it("returns 409 when submission already sent", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...awaitingContract,
      docusealSubmissionId: "99",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toMatch(/already sent/)
  })

  it("returns 400 when no signers are configured", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(awaitingContract as any)
    vi.mocked(prisma.contractSigner.findMany).mockResolvedValueOnce([])
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/at least one signer/)
  })

  it("returns 400 when no file is attached", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(awaitingContract as any)
    vi.mocked(prisma.contractSigner.findMany).mockResolvedValueOnce([signerAlice] as any)
    vi.mocked(prisma.contractFile.findFirst).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toBe("No file attached to this contract")
  })

  it("creates template and submission, then persists signers and returns submissionId", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(awaitingContract as any)
    vi.mocked(prisma.contractSigner.findMany).mockResolvedValueOnce([signerAlice, signerBob] as any)
    vi.mocked(prisma.contractFile.findFirst).mockResolvedValueOnce(mockFile as any)
    // $transaction is handled by setup.ts mock (iterates array form)
    vi.mocked(prisma.contractSigner.update)
      .mockResolvedValueOnce({ ...signerAlice, externalId: "slug-abc", status: "pending" } as any)
      .mockResolvedValueOnce({ ...signerBob, externalId: "slug-def", status: "pending" } as any)
    vi.mocked(prisma.contract.update).mockResolvedValueOnce({
      ...awaitingContract,
      docusealSubmissionId: "99",
      signingStatus: "sent",
    } as any)
    const { createTemplate, createSubmission } = await import("@/lib/docuseal")
    vi.mocked(createTemplate).mockResolvedValueOnce({ id: 42, attachmentUuid: null })
    vi.mocked(createSubmission).mockResolvedValueOnce({
      id: 99,
      submitters: [
        { slug: "slug-abc", embed_src: "https://docuseal.com/s/slug-abc" },
        { slug: "slug-def", embed_src: "https://docuseal.com/s/slug-def" },
      ],
    })
    const { writeActivity } = await import("@/lib/db/activity")
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.submissionId).toBe(99)
    expect(body.signingStatus).toBe("sent")
    expect(createTemplate).toHaveBeenCalled()
    expect(createSubmission).toHaveBeenCalledWith(
      42,
      expect.arrayContaining([
        expect.objectContaining({ email: "alice@acme.com" }),
        expect.objectContaining({ email: "bob@acme.com" }),
      ]),
    )
    expect(writeActivity).toHaveBeenCalledWith(
      "contract-1",
      adminCtx.userId,
      "SENT_FOR_SIGNATURE",
      expect.stringContaining("2"),
    )
  })

  it("adds fields to template when attachmentUuid is present", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(awaitingContract as any)
    vi.mocked(prisma.contractSigner.findMany).mockResolvedValueOnce([signerAlice] as any)
    vi.mocked(prisma.contractFile.findFirst).mockResolvedValueOnce(mockFile as any)
    vi.mocked(prisma.contractSigner.update).mockResolvedValueOnce({
      ...signerAlice,
      externalId: "slug-abc",
      status: "pending",
    } as any)
    vi.mocked(prisma.contract.update).mockResolvedValueOnce({
      ...awaitingContract,
      docusealSubmissionId: "99",
      signingStatus: "sent",
    } as any)
    const { createTemplate, addFieldsToTemplate, createSubmission } = await import("@/lib/docuseal")
    vi.mocked(createTemplate).mockResolvedValueOnce({ id: 42, attachmentUuid: "uuid-123" })
    vi.mocked(addFieldsToTemplate).mockResolvedValueOnce(true)
    vi.mocked(createSubmission).mockResolvedValueOnce({
      id: 99,
      submitters: [{ slug: "slug-abc", embed_src: "https://docuseal.com/s/slug-abc" }],
    })
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    expect(addFieldsToTemplate).toHaveBeenCalledWith(42, "uuid-123", ["Signer 1"])
  })

  it("returns 500 when createTemplate returns null", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(awaitingContract as any)
    vi.mocked(prisma.contractSigner.findMany).mockResolvedValueOnce([signerAlice] as any)
    vi.mocked(prisma.contractFile.findFirst).mockResolvedValueOnce(mockFile as any)
    const { createTemplate } = await import("@/lib/docuseal")
    vi.mocked(createTemplate).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/template/)
  })

  it("returns 500 when createSubmission returns null", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(awaitingContract as any)
    vi.mocked(prisma.contractSigner.findMany).mockResolvedValueOnce([signerAlice] as any)
    vi.mocked(prisma.contractFile.findFirst).mockResolvedValueOnce(mockFile as any)
    const { createTemplate, createSubmission } = await import("@/lib/docuseal")
    vi.mocked(createTemplate).mockResolvedValueOnce({ id: 42, attachmentUuid: null })
    vi.mocked(createSubmission).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/submission/)
  })

  it("returns 500 when file download fails", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(awaitingContract as any)
    vi.mocked(prisma.contractSigner.findMany).mockResolvedValueOnce([signerAlice] as any)
    vi.mocked(prisma.contractFile.findFirst).mockResolvedValueOnce(mockFile as any)
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce({ ok: false, status: 403 }))
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error).toMatch(/download/)
  })

  // Org-isolation: org B cannot send for signing a contract owned by org A
  it("org-isolation: returns 404 when contract belongs to a different org", async () => {
    const orgBCtx = { ...adminCtx, organizationId: "org-b" }
    mockAuth(orgBCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...awaitingContract,
      organizationId: "org-1", // org A
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404) // not 403 — never leak existence
  })
})
