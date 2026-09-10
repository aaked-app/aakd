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

vi.mock("@/lib/signature/config", () => ({
  getDocuSealConfigResolution: vi.fn().mockResolvedValue({
    configured: false,
    config: { baseUrl: "https://api.docuseal.example", apiKey: "test-key" },
    providerId: "environment:test-provider",
  }),
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
  memberId: "member-admin",
  role: "admin",
  source: "session" as const,
  requestId: "req-test",
}

const legalCtx = { ...adminCtx, role: "legal", userId: "user-legal", memberId: "member-legal" }
const memberCtx = { ...adminCtx, role: "member", userId: "user-member", memberId: "member-member" }
const viewerCtx = { ...adminCtx, role: "viewer", userId: "user-viewer", memberId: "member-viewer" }

beforeEach(() => {
  vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValue({ id: "grant-1" } as any)
})

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
  signatureProviderId: "environment:test-provider",
  counterpartyContact: "alice@acme.com",
  counterpartyName: "ACME Corp",
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

beforeEach(() => {
  vi.clearAllMocks()
  _clearStore()
  vi.mocked(requireWriteScope).mockReturnValue(null)
})

// ─── GET /api/contracts/[id]/signing ─────────────────────────────────────────

describe("GET /api/contracts/[id]/signing", () => {
  it("denies a same-organization admin without a contract grant", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/signing/route")
    const response = await GET(new Request("http://localhost/api/contracts/contract-1/signing"), { params: Promise.resolve({ id: "contract-1" }) })
    expect(response.status).toBe(404)
    expect(prisma.contract.findUnique).not.toHaveBeenCalled()
  })
  it("returns 401 when unauthenticated", async () => {
    mockAuth(null)
    const { GET } = await import("@/app/api/contracts/[id]/signing/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/signing"),
      { params: Promise.resolve({ id: "contract-1" }) },
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
      { params: Promise.resolve({ id: "contract-1" }) },
    )
    expect(res.status).toBe(404)
  })

  it("returns 404 when contract does not exist", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/signing/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/signing"),
      { params: Promise.resolve({ id: "contract-1" }) },
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
      { params: Promise.resolve({ id: "contract-1" }) },
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
      { params: Promise.resolve({ id: "contract-1" }) },
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
      { params: Promise.resolve({ id: "contract-1" }) },
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
      { params: Promise.resolve({ id: "contract-1" }) },
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
      { params: Promise.resolve({ id: "contract-1" }) },
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
      { params: Promise.resolve({ id: "contract-1" }) },
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
      { params: Promise.resolve({ id: "contract-1" }) },
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
      { params: Promise.resolve({ id: "contract-1" }) },
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
      { params: Promise.resolve({ id: "contract-1" }) },
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
      { params: Promise.resolve({ id: "contract-1" }) },
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
      { params: Promise.resolve({ id: "contract-1" }) },
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
      { params: Promise.resolve({ id: "contract-1" }) },
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
      { params: Promise.resolve({ id: "contract-1" }) },
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
      { params: Promise.resolve({ id: "contract-1" }) },
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
      { params: Promise.resolve({ id: "contract-1", signerId: "signer-1" }) },
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
      { params: Promise.resolve({ id: "contract-1", signerId: "signer-1" }) },
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
      { params: Promise.resolve({ id: "contract-1", signerId: "signer-1" }) },
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
      { params: Promise.resolve({ id: "contract-1", signerId: "signer-1" }) },
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
      { params: Promise.resolve({ id: "contract-1", signerId: "signer-999" }) },
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
      { params: Promise.resolve({ id: "contract-1", signerId: "signer-1" }) },
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
      { params: Promise.resolve({ id: "contract-1", signerId: "signer-1" }) },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
    expect(prisma.contractSigner.delete).toHaveBeenCalledWith({
      where: { id: "signer-1" },
    })
  })
})

// ─── Signing provider mutations temporarily paused ───────────────────────────

describe("POST /api/contracts/[id]/signing/remind (temporarily paused)", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth(null)
    const { POST } = await import("@/app/api/contracts/[id]/signing/remind/route")
    const res = await POST(new Request("http://localhost/api/contracts/contract-1/signing/remind", { method: "POST" }), { params: Promise.resolve({ id: "contract-1" }) })
    expect(res.status).toBe(401)
  })

  it("rejects API keys and pauses a granted session without provider egress", async () => {
    const { remindSubmitter } = await import("@/lib/docuseal")
    const { POST } = await import("@/app/api/contracts/[id]/signing/remind/route")
    mockAuth({ ...adminCtx, source: "api_key", apiKeyId: "key-1", scopes: ["write"] } as never)
    expect((await POST(new Request("http://localhost/api/contracts/contract-1/signing/remind", { method: "POST" }), { params: Promise.resolve({ id: "contract-1" }) })).status).toBe(403)
    mockAuth(adminCtx)
    const res = await POST(new Request("http://localhost/api/contracts/contract-1/signing/remind", { method: "POST" }), { params: Promise.resolve({ id: "contract-1" }) })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: "signing_reminder_temporarily_unavailable" })
    expect(remindSubmitter).not.toHaveBeenCalled()
  })
})

describe("POST /api/contracts/[id]/signing/reset (temporarily paused)", () => {
  it("returns 401 when unauthenticated", async () => {
    mockAuth(null)
    const { POST } = await import("@/app/api/contracts/[id]/signing/reset/route")
    const res = await POST(new Request("http://localhost/api/contracts/contract-1/signing/reset", { method: "POST" }), { params: Promise.resolve({ id: "contract-1" }) })
    expect(res.status).toBe(401)
  })

  it("preserves provider and local state for a granted legal session", async () => {
    mockAuth(adminCtx)
    const { archiveSubmission } = await import("@/lib/docuseal")
    const { POST } = await import("@/app/api/contracts/[id]/signing/reset/route")
    const res = await POST(new Request("http://localhost/api/contracts/contract-1/signing/reset", { method: "POST" }), { params: Promise.resolve({ id: "contract-1" }) })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual({ error: "signing_reset_temporarily_unavailable" })
    expect(archiveSubmission).not.toHaveBeenCalled()
    expect(prisma.contractSigner.updateMany).not.toHaveBeenCalled()
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })
})

describe("POST /api/contracts/[id]/signing/send (temporarily paused)", () => {
  it("rejects API keys before agreement lookup or provider egress", async () => {
    mockAuth({ ...adminCtx, source: "api_key", apiKeyId: "key-1", scopes: ["write"] } as never)
    const { createSubmission } = await import("@/lib/docuseal")
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }), { params: Promise.resolve({ id: "contract-1" }) })
    expect(res.status).toBe(403)
    expect(createSubmission).not.toHaveBeenCalled()
  })

  it("returns 404 for a session without exact agreement access", async () => {
    mockAuth(adminCtx)
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }), { params: Promise.resolve({ id: "contract-1" }) })
    expect(res.status).toBe(404)
  })

  it("returns the explicit pause response without provider egress", async () => {
    mockAuth(adminCtx)
    const { createTemplate, createSubmission } = await import("@/lib/docuseal")
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const res = await POST(new Request("http://localhost/api/contracts/contract-1/signing/send", { method: "POST" }), { params: Promise.resolve({ id: "contract-1" }) })
    expect(res.status).toBe(503)
    expect(await res.json()).toEqual(expect.objectContaining({ error: "signing_send_temporarily_unavailable" }))
    expect(createTemplate).not.toHaveBeenCalled()
    expect(createSubmission).not.toHaveBeenCalled()
  })
})
