/**
 * Organization-scope isolation tests required before every merge.
 *
 * Cross-organization access must return 404 rather than reveal resource
 * existence with a 403 response.
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
    storageKey: vi.fn().mockReturnValue("orgs/org-a/contracts/c1/file.pdf"),
    upload: vi.fn().mockResolvedValue(undefined),
    getSignedDownloadUrl: vi.fn().mockResolvedValue("https://s3.example.com/signed"),
  },
}))

vi.mock("@/lib/alerts/generate", () => ({
  generateAlertsForContract: vi.fn().mockResolvedValue(undefined),
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
  id: "contract-org-a",
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
  extractedText: null,
  docusealSubmissionId: null,
  signingUrl: null,
  ownerId: "user-a",
  createdAt: new Date(),
  updatedAt: new Date(),
  owner: { id: "user-a", name: "Alice", email: "alice@a.com" },
  tags: [],
  folder: null,
  files: [],
  versions: [],
  activities: [],
  _count: { files: 0, versions: 0, activities: 0 },
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("Org-scope isolation — cross-org reads must return 404", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    // Deliberately pass the grant gate so these tests continue exercising the
    // downstream tenant-scoped lookup instead of short-circuiting early.
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValue({ id: "synthetic-grant" } as never)
  })

  it("org-B user cannot read a contract created in org-A — must return 404", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    // Prisma middleware scopes to org-b; contract belongs to org-a → null
    vi.mocked(resolveAuth).mockResolvedValue(orgBCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValue(null)

    const { GET } = await import("@/app/api/contracts/[id]/route")
    const req = new Request("http://localhost/api/contracts/contract-org-a")
    const res = await GET(req, { params: Promise.resolve({ id: "contract-org-a" }) })

    expect(res.status).toBe(404)
    // Must not be 403 — don't leak resource existence
    expect(res.status).not.toBe(403)
    expect(prisma.contract.findUnique).toHaveBeenCalled()
  })

  it("org-B user cannot PATCH a contract created in org-A — must return 404", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(orgBCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValue(null)

    const { PATCH } = await import("@/app/api/contracts/[id]/route")
    const req = new Request("http://localhost/api/contracts/contract-org-a", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Hijacked" }),
    })
    const res = await PATCH(req, { params: Promise.resolve({ id: "contract-org-a" }) })

    expect(res.status).toBe(404)
    expect(res.status).not.toBe(403)
    expect(prisma.contract.findUnique).toHaveBeenCalled()
  })

  it("same-organization access without an explicit grant returns 404 before contract lookup", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(orgACtx)
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValueOnce(null)

    const { GET } = await import("@/app/api/contracts/[id]/route")
    const res = await GET(new Request("http://localhost/api/contracts/contract-org-a"), {
      params: Promise.resolve({ id: "contract-org-a" }),
    })

    expect(res.status).toBe(404)
    expect(prisma.contractAccessGrant.findFirst).toHaveBeenCalledWith({
      where: { organizationId: "org-a", memberId: "member-a", contractId: "contract-org-a" },
      select: { id: true },
    })
    expect(prisma.contract.findUnique).not.toHaveBeenCalled()
  })

  it("listing contracts as org-B does not include org-A contracts", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(orgBCtx)
    // Prisma middleware injects org-b scope — no org-a contracts returned
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

  it("org-A user can read their own contract — returns 200", async () => {
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValue({ id: "grant-a" } as any)
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(orgACtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValue(orgAContract as any)

    const { GET } = await import("@/app/api/contracts/[id]/route")
    const req = new Request("http://localhost/api/contracts/contract-org-a")
    const res = await GET(req, { params: Promise.resolve({ id: "contract-org-a" }) })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.organizationId).toBe("org-a")
  })

  it("unauthenticated request returns 401 — does not reveal resource existence", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(null)

    const { GET } = await import("@/app/api/contracts/[id]/route")
    const req = new Request("http://localhost/api/contracts/contract-org-a")
    const res = await GET(req, { params: Promise.resolve({ id: "contract-org-a" }) })

    expect(res.status).toBe(401)
  })
})
