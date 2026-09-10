/**
 * Org-scope isolation integration tests.
 *
 * Tenant-isolation contract:
 *   - Create a contract in organization A.
 *   - Attempt to read it as a user in organization B.
 *   - Return 404 rather than reveal resource existence with a 403 response.
 *
 * These tests use mocked Prisma and resolveAuth — no live DB required.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@/lib/db/client"

vi.mock("@/lib/auth/middleware", () => ({
  resolveAuth: vi.fn(),
  requireWriteScope: vi.fn(() => null),
}))

vi.mock("@/lib/db/activity", () => ({
  writeActivity: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/storage", () => ({
  storage: {
    storageKey: vi.fn().mockReturnValue("orgs/org-a/contracts/c-org-a/file.pdf"),
    upload: vi.fn().mockResolvedValue(undefined),
    getSignedDownloadUrl: vi.fn().mockResolvedValue("https://s3.example.com/signed"),
  },
}))

vi.mock("@/lib/alerts/generate", () => ({
  generateAlertsForContract: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("@/lib/notifications/fanout", () => ({
  enqueueNotification: vi.fn().mockResolvedValue(undefined),
}))

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const orgACtx = {
  userId: "user-a",
  organizationId: "org-a",
  memberId: "member-a",
  role: "admin" as const,
  source: "session" as const,
  requestId: "test-request-id",
}

const orgBCtx = {
  userId: "user-b",
  organizationId: "org-b",
  memberId: "member-b",
  role: "admin" as const,
  source: "session" as const,
  requestId: "test-request-id",
}

const orgAContract = {
  id: "c-org-a",
  organizationId: "org-a",
  title: "Org A NDA",
  status: "DRAFT",
  contractType: "NDA",
  counterpartyName: null,
  counterpartyContact: null,
  value: null,
  currency: "USD",
  governingLaw: null,
  startDate: null,
  endDate: null,
  renewalDate: null,
  noticePeriodDays: null,
  autoRenewal: false,
  notes: null,
  folderId: null,
  docusealSubmissionId: null,
  signingUrl: null,
  signingStatus: null,
  ownerId: "user-a",
  riskScore: null,
  riskScoredAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01"),
  owner: { id: "user-a", name: "Alice", email: "alice@a.com", image: null },
  tags: [],
  folder: null,
  files: [],
  versions: [],
  activities: [],
  crmLinks: [],
  _count: { files: 0, versions: 0, activities: 0 },
}

// ─── Cross-org isolation: 404 on every access path ────────────────────────────

describe("Org-scope isolation — cross-org reads must return 404, not 403", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    // Deliberately pass the grant gate so these tests continue exercising the
    // downstream tenant-scoped lookup instead of short-circuiting early.
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValue({ id: "synthetic-grant" } as never)
  })

  it("org-B user cannot GET a contract created in org-A — must return 404", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    // Prisma middleware scopes to org-b — the org-a contract is invisible → null
    vi.mocked(resolveAuth).mockResolvedValue(orgBCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValue(null)

    const { GET } = await import("@/app/api/contracts/[id]/route")
    const req = new Request("http://localhost/api/contracts/c-org-a")
    const res = await GET(req, { params: Promise.resolve({ id: "c-org-a" }) })

    expect(res.status).toBe(404)
    // Must be 404, never 403 — don't leak resource existence
    expect(res.status).not.toBe(403)
    expect(res.status).not.toBe(200)
    expect(prisma.contract.findUnique).toHaveBeenCalled()
  })

  it("org-B user cannot PATCH a contract created in org-A — must return 404", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(orgBCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValue(null)

    const { PATCH } = await import("@/app/api/contracts/[id]/route")
    const req = new Request("http://localhost/api/contracts/c-org-a", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hijacked Title" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "c-org-a" }) })

    expect(res.status).toBe(404)
    expect(res.status).not.toBe(403)
    expect(res.status).not.toBe(200)
    expect(prisma.contract.findUnique).toHaveBeenCalled()
  })

  it("org-B user cannot archive (DELETE) a contract created in org-A — must return 404", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(orgBCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValue(null)

    const { DELETE } = await import("@/app/api/contracts/[id]/route")
    const req = new Request("http://localhost/api/contracts/c-org-a", {
      method: "DELETE",
    })
    const res = await DELETE(req, { params: Promise.resolve({ id: "c-org-a" }) })

    expect(res.status).toBe(404)
    expect(res.status).not.toBe(403)
    expect(prisma.contract.findUnique).toHaveBeenCalled()
  })

  it("org-B user cannot view activity log for an org-A contract — must return 404", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(orgBCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValue(null)

    const { GET } = await import("@/app/api/contracts/[id]/activity/route")
    const req = new Request("http://localhost/api/contracts/c-org-a/activity")
    const res = await GET(req, { params: Promise.resolve({ id: "c-org-a" }) })

    expect(res.status).toBe(404)
    expect(res.status).not.toBe(403)
    expect(prisma.contract.findUnique).toHaveBeenCalled()
  })

  it("org-B user cannot upload a file to an org-A contract — must return 404", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(orgBCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValue(null)

    const { POST } = await import("@/app/api/contracts/[id]/upload/route")

    // Valid PDF magic bytes
    const pdfBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
    const formData = new FormData()
    formData.append("file", new Blob([pdfBytes], { type: "application/pdf" }), "test.pdf")

    const req = new Request("http://localhost/api/contracts/c-org-a/upload", {
      method: "POST",
      body: formData,
    })
    const res = await POST(req, { params: Promise.resolve({ id: "c-org-a" }) })

    expect(res.status).toBe(404)
    expect(res.status).not.toBe(403)
    expect(prisma.contract.findUnique).toHaveBeenCalled()
  })
})

// ─── Positive path: org A user can always read their own data ─────────────────

describe("Org-scope isolation — own-org reads succeed", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValue({ id: "grant-a" } as never)
  })

  it("org-A user can GET their own contract — returns 200 with org-a scoped data", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(orgACtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValue(orgAContract as any)
    // hasExtractedText presence check
    vi.mocked(prisma.contract.count).mockResolvedValue(0)

    const { GET } = await import("@/app/api/contracts/[id]/route")
    const req = new Request("http://localhost/api/contracts/c-org-a")
    const res = await GET(req, { params: Promise.resolve({ id: "c-org-a" }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.organizationId).toBe("org-a")
    expect(body.id).toBe("c-org-a")
  })

  it("same-organization admin cannot read an existing contract without an explicit grant", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(orgACtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValue(orgAContract as any)
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValue(null)
    const { GET } = await import("@/app/api/contracts/[id]/route")
    const response = await GET(new Request("http://localhost/api/contracts/c-org-a"), { params: Promise.resolve({ id: "c-org-a" }) })
    expect(response.status).toBe(404)
    expect(prisma.contractAccessGrant.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org-a", memberId: "member-a", contractId: "c-org-a" },
      select: { id: true },
    })
    expect(prisma.contract.findUnique).not.toHaveBeenCalled()
  })

  it("org-A user listing contracts gets their own contracts — not an error", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(orgACtx)
    vi.mocked(prisma.contract.findMany).mockResolvedValue([
      { ...orgAContract, owner: orgAContract.owner, tags: [], folder: null, crmLinks: [], _count: { files: 0 } },
    ] as any)
    vi.mocked(prisma.contract.count).mockResolvedValue(1)

    const { GET } = await import("@/app/api/contracts/route")
    const req = new Request("http://localhost/api/contracts")
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.contracts).toHaveLength(1)
    expect(body.contracts[0].organizationId).toBe("org-a")
    expect(body.total).toBe(1)
  })

  it("org-B user listing contracts gets an empty list — not an error", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(orgBCtx)
    // Middleware scopes to org-b; org-b has no contracts
    vi.mocked(prisma.contract.findMany).mockResolvedValue([])
    vi.mocked(prisma.contract.count).mockResolvedValue(0)

    const { GET } = await import("@/app/api/contracts/route")
    const req = new Request("http://localhost/api/contracts")
    const res = await GET(req)

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.contracts).toHaveLength(0)
    expect(body.total).toBe(0)
  })
})

// ─── Unauthenticated requests always return 401 ───────────────────────────────

describe("Org-scope isolation — unauthenticated requests return 401", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
  })

  it("GET /api/contracts/:id with no auth returns 401", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(null)

    const { GET } = await import("@/app/api/contracts/[id]/route")
    const req = new Request("http://localhost/api/contracts/c-org-a")
    const res = await GET(req, { params: Promise.resolve({ id: "c-org-a" }) })

    expect(res.status).toBe(401)
    // Must not reveal whether the resource exists
    expect(res.status).not.toBe(404)
    expect(res.status).not.toBe(200)
  })

  it("PATCH /api/contracts/:id with no auth returns 401", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(null)

    const { PATCH } = await import("@/app/api/contracts/[id]/route")
    const req = new Request("http://localhost/api/contracts/c-org-a", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Attack" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "c-org-a" }) })

    expect(res.status).toBe(401)
  })

  it("GET /api/contracts with no auth returns 401", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(null)

    const { GET } = await import("@/app/api/contracts/route")
    const req = new Request("http://localhost/api/contracts")
    const res = await GET(req)

    expect(res.status).toBe(401)
  })
})
