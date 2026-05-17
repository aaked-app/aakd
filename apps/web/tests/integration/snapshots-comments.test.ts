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

// Mock plate-to-plaintext so snapshot POST works without Slate/TipTap deps
vi.mock("@/lib/editor/plate-to-plaintext", () => ({
  plateToPlaintext: vi.fn().mockReturnValue("plaintext content here"),
  countWords: vi.fn().mockReturnValue(3),
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
const otherOrgCtx = { ...adminCtx, organizationId: "org-other" }

function resetMocks() {
  vi.clearAllMocks()
  vi.mocked(requireWriteScope).mockReturnValue(null)
}

beforeEach(resetMocks)

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockContract = { id: "contract-1", organizationId: "org-1" }

const mockSnapshot = {
  id: "snap-1",
  label: "v1.0",
  content: { type: "doc", content: [] },
  wordCount: 100,
  createdAt: new Date("2026-01-01"),
  organizationId: "org-1",
  contractId: "contract-1",
  createdBy: { name: "Alice" },
}

const mockComment = {
  id: "comment-1",
  contractId: "contract-1",
  authorId: "user-admin",
  body: "Please review clause 3",
  markId: null,
  resolved: false,
  resolvedById: null,
  resolvedAt: null,
  createdAt: new Date("2026-01-01"),
  author: { id: "user-admin", name: "Alice", image: null },
  resolvedBy: null,
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/contracts/[id]/snapshots
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/contracts/[id]/snapshots", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(401)
  })

  it("returns 404 when contract not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 404 when contract belongs to different org", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(otherOrgCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(404)
  })

  it("returns empty snapshot list", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.documentSnapshot.findMany).mockResolvedValueOnce([])
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.snapshots).toEqual([])
  })

  it("returns list of snapshots ordered newest-first", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.documentSnapshot.findMany).mockResolvedValueOnce([
      { id: "snap-2", label: "v2.0", wordCount: 200, createdAt: new Date("2026-02-01"), createdBy: { name: "Bob" } },
      { id: "snap-1", label: "v1.0", wordCount: 100, createdAt: new Date("2026-01-01"), createdBy: { name: "Alice" } },
    ] as any)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.snapshots).toHaveLength(2)
    expect(body.snapshots[0].id).toBe("snap-2")
  })

  it("viewer can read snapshots", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.documentSnapshot.findMany).mockResolvedValueOnce([])
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/contracts/[id]/snapshots
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/contracts/[id]/snapshots", () => {
  const validBody = {
    label: "v1.0 Final",
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Hello" }] }] },
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/snapshots/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(401)
  })

  it("returns 403 when requireWriteScope fails", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(requireWriteScope).mockReturnValueOnce(new Response("Forbidden", { status: 403 }))
    const { POST } = await import("@/app/api/contracts/[id]/snapshots/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(403)
  })

  it("returns 404 when contract not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/snapshots/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 403 when viewer tries to create snapshot", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/snapshots/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(403)
  })

  it("returns 400 on invalid body", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/snapshots/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots", {
      method: "POST",
      body: JSON.stringify({ label: "" }),  // label too short
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(400)
  })

  it("creates snapshot and returns 201", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.documentSnapshot.create).mockResolvedValueOnce({
      id: "snap-new",
      label: "v1.0 Final",
      createdAt: new Date(),
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/snapshots/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.snapshot.id).toBe("snap-new")
    expect(body.snapshot.label).toBe("v1.0 Final")
  })

  it("member can create snapshot", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.documentSnapshot.create).mockResolvedValueOnce({
      id: "snap-m",
      label: "v1.0 Final",
      createdAt: new Date(),
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/snapshots/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(201)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/contracts/[id]/snapshots/[snapshotId]
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/contracts/[id]/snapshots/[snapshotId]", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/[snapshotId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/snap-1")
    const res = await GET(req, { params: { id: "contract-1", snapshotId: "snap-1" } })
    expect(res.status).toBe(401)
  })

  it("returns 404 when snapshot not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.documentSnapshot.findUnique).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/[snapshotId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/snap-1")
    const res = await GET(req, { params: { id: "contract-1", snapshotId: "snap-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 404 when snapshot belongs to another org", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(otherOrgCtx)
    vi.mocked(prisma.documentSnapshot.findUnique).mockResolvedValueOnce(mockSnapshot as any)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/[snapshotId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/snap-1")
    const res = await GET(req, { params: { id: "contract-1", snapshotId: "snap-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 404 when snapshot belongs to different contract", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.documentSnapshot.findUnique).mockResolvedValueOnce({
      ...mockSnapshot,
      contractId: "contract-other",
    } as any)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/[snapshotId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/snap-1")
    const res = await GET(req, { params: { id: "contract-1", snapshotId: "snap-1" } })
    expect(res.status).toBe(404)
  })

  it("returns snapshot with content", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.documentSnapshot.findUnique).mockResolvedValueOnce(mockSnapshot as any)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/[snapshotId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/snap-1")
    const res = await GET(req, { params: { id: "contract-1", snapshotId: "snap-1" } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.snapshot.id).toBe("snap-1")
    expect(body.snapshot.label).toBe("v1.0")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/contracts/[id]/snapshots/[snapshotId]
// ═══════════════════════════════════════════════════════════════════════════════

describe("DELETE /api/contracts/[id]/snapshots/[snapshotId]", () => {
  const snapshotForDelete = {
    id: "snap-1",
    label: "v1.0",
    organizationId: "org-1",
    contractId: "contract-1",
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { DELETE } = await import("@/app/api/contracts/[id]/snapshots/[snapshotId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/snap-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "contract-1", snapshotId: "snap-1" } })
    expect(res.status).toBe(401)
  })

  it("returns 404 when snapshot not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.documentSnapshot.findUnique).mockResolvedValueOnce(null)
    const { DELETE } = await import("@/app/api/contracts/[id]/snapshots/[snapshotId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/snap-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "contract-1", snapshotId: "snap-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 403 when viewer tries to delete", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    vi.mocked(prisma.documentSnapshot.findUnique).mockResolvedValueOnce(snapshotForDelete as any)
    const { DELETE } = await import("@/app/api/contracts/[id]/snapshots/[snapshotId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/snap-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "contract-1", snapshotId: "snap-1" } })
    expect(res.status).toBe(403)
  })

  it("returns 403 when member tries to delete", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    vi.mocked(prisma.documentSnapshot.findUnique).mockResolvedValueOnce(snapshotForDelete as any)
    const { DELETE } = await import("@/app/api/contracts/[id]/snapshots/[snapshotId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/snap-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "contract-1", snapshotId: "snap-1" } })
    expect(res.status).toBe(403)
  })

  it("legal role can delete snapshot and returns 204", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(legalCtx)
    vi.mocked(prisma.documentSnapshot.findUnique).mockResolvedValueOnce(snapshotForDelete as any)
    vi.mocked(prisma.documentSnapshot.delete).mockResolvedValueOnce(snapshotForDelete as any)
    const { DELETE } = await import("@/app/api/contracts/[id]/snapshots/[snapshotId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/snap-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "contract-1", snapshotId: "snap-1" } })
    expect(res.status).toBe(204)
  })

  it("admin role can delete snapshot", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.documentSnapshot.findUnique).mockResolvedValueOnce(snapshotForDelete as any)
    vi.mocked(prisma.documentSnapshot.delete).mockResolvedValueOnce(snapshotForDelete as any)
    const { DELETE } = await import("@/app/api/contracts/[id]/snapshots/[snapshotId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/snap-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "contract-1", snapshotId: "snap-1" } })
    expect(res.status).toBe(204)
  })

  it("returns 404 when snapshot belongs to another org (isolation)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(otherOrgCtx)
    vi.mocked(prisma.documentSnapshot.findUnique).mockResolvedValueOnce(snapshotForDelete as any)
    const { DELETE } = await import("@/app/api/contracts/[id]/snapshots/[snapshotId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/snap-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "contract-1", snapshotId: "snap-1" } })
    expect(res.status).toBe(404)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/contracts/[id]/snapshots/compare
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/contracts/[id]/snapshots/compare", () => {
  const snapA = {
    id: "snap-a",
    label: "v1.0",
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Old text" }] }] },
    organizationId: "org-1",
    contractId: "contract-1",
    createdAt: new Date("2026-01-01"),
  }
  const snapB = {
    id: "snap-b",
    label: "v2.0",
    content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "New text" }] }] },
    organizationId: "org-1",
    contractId: "contract-1",
    createdAt: new Date("2026-02-01"),
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/compare/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/compare?a=snap-a")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(401)
  })

  it("returns 404 when contract not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/compare/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/compare?a=snap-a")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 400 when query param 'a' is missing", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/compare/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/compare")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/required/i)
  })

  it("returns 404 when snapshot A not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.documentSnapshot.findUnique).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/compare/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/compare?a=snap-missing")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(404)
  })

  it("compares two snapshots and returns hunks", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    // findUnique called twice: once for snapA, once for snapB
    vi.mocked(prisma.documentSnapshot.findUnique)
      .mockResolvedValueOnce(snapA as any)
      .mockResolvedValueOnce(snapB as any)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/compare/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/compare?a=snap-a&b=snap-b")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toHaveProperty("a")
    expect(body).toHaveProperty("b")
    expect(body).toHaveProperty("hunks")
    expect(Array.isArray(body.hunks)).toBe(true)
    expect(body.a.id).toBe("snap-a")
    expect(body.b.id).toBe("snap-b")
  })

  it("compares snapshot A against live document when b=live", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.documentSnapshot.findUnique).mockResolvedValueOnce(snapA as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce({
      content: { type: "doc", content: [] },
      updatedAt: new Date(),
    } as any)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/compare/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/compare?a=snap-a&b=live")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.b.id).toBe("live")
    expect(body.b.label).toMatch(/live/i)
  })

  it("returns 404 when live document not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.documentSnapshot.findUnique).mockResolvedValueOnce(snapA as any)
    vi.mocked(prisma.contractDocument.findUnique).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/compare/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/compare?a=snap-a&b=live")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 404 when snapshot B belongs to another org (isolation)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.documentSnapshot.findUnique)
      .mockResolvedValueOnce(snapA as any)
      .mockResolvedValueOnce({ ...snapB, organizationId: "org-other" } as any)
    const { GET } = await import("@/app/api/contracts/[id]/snapshots/compare/route")
    const req = new Request("http://localhost/api/contracts/contract-1/snapshots/compare?a=snap-a&b=snap-b")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(404)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/contracts/[id]/comments
// ═══════════════════════════════════════════════════════════════════════════════

describe("GET /api/contracts/[id]/comments", () => {
  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/comments/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(401)
  })

  it("returns 404 when contract not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/comments/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 404 when contract belongs to another org (isolation)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(otherOrgCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    const { GET } = await import("@/app/api/contracts/[id]/comments/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(404)
  })

  it("returns empty comments list", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.findMany).mockResolvedValueOnce([])
    const { GET } = await import("@/app/api/contracts/[id]/comments/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.comments).toEqual([])
  })

  it("returns comments list with author data", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.findMany).mockResolvedValueOnce([mockComment] as any)
    const { GET } = await import("@/app/api/contracts/[id]/comments/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.comments).toHaveLength(1)
    expect(body.comments[0].id).toBe("comment-1")
  })

  it("viewer can read comments", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.findMany).mockResolvedValueOnce([])
    const { GET } = await import("@/app/api/contracts/[id]/comments/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments")
    const res = await GET(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(200)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/contracts/[id]/comments
// ═══════════════════════════════════════════════════════════════════════════════

describe("POST /api/contracts/[id]/comments", () => {
  const validBody = { body: "Please review this clause carefully." }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/comments/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(401)
  })

  it("returns 403 when viewer tries to comment", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/comments/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(403)
  })

  it("returns 400 on invalid body (empty comment)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    const { POST } = await import("@/app/api/contracts/[id]/comments/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments", {
      method: "POST",
      body: JSON.stringify({ body: "" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(400)
  })

  it("creates comment and returns 201", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.create).mockResolvedValueOnce({
      ...mockComment,
      body: "Please review this clause carefully.",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/comments/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(201)
    const resBody = await res.json()
    expect(resBody.comment.id).toBe("comment-1")
    expect(resBody.comment.body).toBe("Please review this clause carefully.")
  })

  it("creates comment with optional markId", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.create).mockResolvedValueOnce({
      ...mockComment,
      markId: "mark-abc",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/comments/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments", {
      method: "POST",
      body: JSON.stringify({ body: "Inline comment", markId: "mark-abc" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(201)
    const resBody = await res.json()
    expect(resBody.comment.markId).toBe("mark-abc")
  })

  it("member can post comment", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.create).mockResolvedValueOnce(mockComment as any)
    const { POST } = await import("@/app/api/contracts/[id]/comments/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments", {
      method: "POST",
      body: JSON.stringify(validBody),
      headers: { "Content-Type": "application/json" },
    })
    const res = await POST(req, { params: { id: "contract-1" } })
    expect(res.status).toBe(201)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// PATCH /api/contracts/[id]/comments/[commentId]
// ═══════════════════════════════════════════════════════════════════════════════

describe("PATCH /api/contracts/[id]/comments/[commentId]", () => {
  const commentRecord = {
    id: "comment-1",
    contractId: "contract-1",
    authorId: "user-admin",
    resolved: false,
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { PATCH } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments/comment-1", {
      method: "PATCH",
      body: JSON.stringify({ resolved: true }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: { id: "contract-1", commentId: "comment-1" } })
    expect(res.status).toBe(401)
  })

  it("returns 404 when contract not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(null)
    const { PATCH } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments/comment-1", {
      method: "PATCH",
      body: JSON.stringify({ resolved: true }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: { id: "contract-1", commentId: "comment-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 404 when comment not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.findUnique).mockResolvedValueOnce(null)
    const { PATCH } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments/comment-1", {
      method: "PATCH",
      body: JSON.stringify({ resolved: true }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: { id: "contract-1", commentId: "comment-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 400 when neither resolved nor body is provided", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.findUnique).mockResolvedValueOnce(commentRecord as any)
    const { PATCH } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments/comment-1", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: { id: "contract-1", commentId: "comment-1" } })
    expect(res.status).toBe(400)
  })

  it("returns 403 when viewer tries to resolve", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.findUnique).mockResolvedValueOnce(commentRecord as any)
    const { PATCH } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments/comment-1", {
      method: "PATCH",
      body: JSON.stringify({ resolved: true }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: { id: "contract-1", commentId: "comment-1" } })
    expect(res.status).toBe(403)
  })

  it("returns 403 when non-author tries to edit body", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce({ ...adminCtx, userId: "user-other" })
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.findUnique).mockResolvedValueOnce(commentRecord as any) // authorId is "user-admin"
    const { PATCH } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments/comment-1", {
      method: "PATCH",
      body: JSON.stringify({ body: "I edited someone else's comment" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: { id: "contract-1", commentId: "comment-1" } })
    expect(res.status).toBe(403)
  })

  it("admin can resolve a comment", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.findUnique).mockResolvedValueOnce(commentRecord as any)
    vi.mocked(prisma.contractComment.update).mockResolvedValueOnce({
      ...mockComment,
      resolved: true,
      resolvedById: "user-admin",
    } as any)
    const { PATCH } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments/comment-1", {
      method: "PATCH",
      body: JSON.stringify({ resolved: true }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: { id: "contract-1", commentId: "comment-1" } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.comment.resolved).toBe(true)
  })

  it("author can edit their own comment body", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)  // authorId matches
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.findUnique).mockResolvedValueOnce(commentRecord as any)
    vi.mocked(prisma.contractComment.update).mockResolvedValueOnce({
      ...mockComment,
      body: "Updated body text",
    } as any)
    const { PATCH } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments/comment-1", {
      method: "PATCH",
      body: JSON.stringify({ body: "Updated body text" }),
      headers: { "Content-Type": "application/json" },
    })
    const res = await PATCH(req, { params: { id: "contract-1", commentId: "comment-1" } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.comment.body).toBe("Updated body text")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE /api/contracts/[id]/comments/[commentId]
// ═══════════════════════════════════════════════════════════════════════════════

describe("DELETE /api/contracts/[id]/comments/[commentId]", () => {
  const commentRecord = {
    id: "comment-1",
    contractId: "contract-1",
    authorId: "user-admin",
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { DELETE } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments/comment-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "contract-1", commentId: "comment-1" } })
    expect(res.status).toBe(401)
  })

  it("returns 404 when contract not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(null)
    const { DELETE } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments/comment-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "contract-1", commentId: "comment-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 404 when comment not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.findUnique).mockResolvedValueOnce(null)
    const { DELETE } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments/comment-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "contract-1", commentId: "comment-1" } })
    expect(res.status).toBe(404)
  })

  it("returns 403 when non-author member tries to delete", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce({ ...memberCtx, userId: "user-other" })
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.findUnique).mockResolvedValueOnce(commentRecord as any) // authorId is "user-admin"
    const { DELETE } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments/comment-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "contract-1", commentId: "comment-1" } })
    expect(res.status).toBe(403)
  })

  it("author can delete their own comment", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)  // matches authorId
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.findUnique).mockResolvedValueOnce(commentRecord as any)
    vi.mocked(prisma.contractComment.delete).mockResolvedValueOnce(commentRecord as any)
    const { DELETE } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments/comment-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "contract-1", commentId: "comment-1" } })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.success).toBe(true)
  })

  it("legal role can delete any comment", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce({ ...legalCtx, userId: "user-legal-other" })
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.findUnique).mockResolvedValueOnce(commentRecord as any) // authored by "user-admin"
    vi.mocked(prisma.contractComment.delete).mockResolvedValueOnce(commentRecord as any)
    const { DELETE } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments/comment-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "contract-1", commentId: "comment-1" } })
    expect(res.status).toBe(200)
  })

  it("admin role can delete any comment", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce({ ...adminCtx, userId: "user-admin-2" })
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractComment.findUnique).mockResolvedValueOnce(commentRecord as any) // authored by "user-admin"
    vi.mocked(prisma.contractComment.delete).mockResolvedValueOnce(commentRecord as any)
    const { DELETE } = await import("@/app/api/contracts/[id]/comments/[commentId]/route")
    const req = new Request("http://localhost/api/contracts/contract-1/comments/comment-1", { method: "DELETE" })
    const res = await DELETE(req, { params: { id: "contract-1", commentId: "comment-1" } })
    expect(res.status).toBe(200)
  })
})
