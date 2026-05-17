/**
 * Integration tests for obligation routes.
 *
 * Routes covered:
 *  1. GET  /api/contracts/[id]/obligations          — list obligations
 *  2. POST /api/contracts/[id]/obligations          — create obligation
 *  3. GET  /api/contracts/[id]/obligations/[obligationId]         — single obligation
 *  4. PATCH /api/contracts/[id]/obligations/[obligationId]        — update obligation
 *  5. DELETE /api/contracts/[id]/obligations/[obligationId]       — delete obligation
 *  6. POST /api/contracts/[id]/obligations/[obligationId]/subtasks — create subtask
 *  7. PATCH /api/contracts/[id]/obligations/[obligationId]/subtasks/[subtaskId] — update subtask
 *  8. DELETE /api/contracts/[id]/obligations/[obligationId]/subtasks/[subtaskId] — delete subtask
 *  9. POST /api/contracts/[id]/obligations/extract  — enqueue AI extraction
 * 10. GET  /api/contracts/[id]/obligations/extract  — check extraction job status
 * 11. GET  /api/obligations                          — global obligations list
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { prisma } from "@/lib/db/client"

// ─── Auth mock ────────────────────────────────────────────────────────────────

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

import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"

function resetMocks() {
  vi.resetAllMocks()
  vi.mocked(requireWriteScope).mockReturnValue(null)
}

// ─── Shared auth contexts ─────────────────────────────────────────────────────

const adminCtx = {
  userId: "user-admin",
  organizationId: "org-1",
  role: "admin",
  source: "session" as const,
  requestId: "req-test",
}
const memberCtx = { ...adminCtx, role: "member" }
const viewerCtx = { ...adminCtx, role: "viewer" }

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const mockContract = {
  id: "contract-1",
  organizationId: "org-1",
  status: "DRAFT",
  extractedText: "Sample contract text for AI extraction.",
}

const futureDate = new Date(Date.now() + 86400000 * 7).toISOString()

const mockObligation = {
  id: "obl-1",
  contractId: "contract-1",
  organizationId: "org-1",
  title: "Pay invoice",
  description: null,
  clauseReference: null,
  priority: "MEDIUM",
  status: "PENDING",
  dueDate: new Date(futureDate),
  reminderDays: 7,
  assigneeId: null,
  assignee: null,
  completedById: null,
  completedBy: null,
  createdById: "user-admin",
  createdBy: { id: "user-admin", name: "Admin" },
  subTasks: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  contract: { organizationId: "org-1" },
}

const mockSubTask = {
  id: "sub-1",
  obligationId: "obl-1",
  title: "Send payment proof",
  isCompleted: false,
  completedAt: null,
  completedById: null,
  completedBy: null,
  createdAt: new Date(),
}

// ─── 1. GET /api/contracts/[id]/obligations ───────────────────────────────────

describe("GET /api/contracts/[id]/obligations", () => {
  beforeEach(() => {
    resetMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/obligations/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/obligations"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 when contract not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/obligations/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/obligations"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 404 when contract belongs to different org", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      id: "contract-1",
      organizationId: "org-OTHER",
    } as any)
    const { GET } = await import("@/app/api/contracts/[id]/obligations/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/obligations"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 200 with obligations list on happy path", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractObligation.findMany).mockResolvedValueOnce([mockObligation] as any)
    const { GET } = await import("@/app/api/contracts/[id]/obligations/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/obligations"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.obligations).toHaveLength(1)
    expect(body.obligations[0].id).toBe("obl-1")
  })

  it("returns empty array when no obligations exist", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractObligation.findMany).mockResolvedValueOnce([])
    const { GET } = await import("@/app/api/contracts/[id]/obligations/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/obligations"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.obligations).toHaveLength(0)
  })
})

// ─── 2. POST /api/contracts/[id]/obligations ──────────────────────────────────

describe("POST /api/contracts/[id]/obligations", () => {
  beforeEach(() => {
    resetMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/obligations/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test", dueDate: futureDate }),
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when role is viewer", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    const { POST } = await import("@/app/api/contracts/[id]/obligations/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test", dueDate: futureDate }),
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when contract not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/obligations/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test", dueDate: futureDate }),
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 422 when contract is archived", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...mockContract,
      status: "ARCHIVED",
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/obligations/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test", dueDate: futureDate }),
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("contract_archived")
  })

  it("returns 422 when title is missing", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractObligation.count).mockResolvedValueOnce(0)
    const { POST } = await import("@/app/api/contracts/[id]/obligations/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dueDate: futureDate }),
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(422)
  })

  it("returns 422 when dueDate is in the past", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractObligation.count).mockResolvedValueOnce(0)
    const pastDate = new Date(Date.now() - 86400000).toISOString()
    const { POST } = await import("@/app/api/contracts/[id]/obligations/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test", dueDate: pastDate }),
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(422)
  })

  it("returns 422 when obligation cap (100) is reached", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractObligation.count).mockResolvedValueOnce(100)
    const { POST } = await import("@/app/api/contracts/[id]/obligations/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test", dueDate: futureDate }),
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("obligation_limit_reached")
  })

  it("returns 422 when assignee is not a member of the org", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.member.findFirst).mockResolvedValueOnce(null)
    vi.mocked(prisma.contractObligation.count).mockResolvedValueOnce(0)
    const { POST } = await import("@/app/api/contracts/[id]/obligations/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test", dueDate: futureDate, assigneeId: "user-unknown" }),
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("invalid_assignee")
  })

  it("returns 201 on happy path and writes activity", async () => {
    const { writeActivity } = await import("@/lib/db/activity")
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractObligation.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.contractObligation.create).mockResolvedValueOnce(mockObligation as any)
    const { POST } = await import("@/app/api/contracts/[id]/obligations/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Pay invoice", dueDate: futureDate }),
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe("obl-1")
    expect(writeActivity).toHaveBeenCalledWith(
      "contract-1",
      "user-admin",
      "OBLIGATION_CREATED",
      expect.stringContaining("Pay invoice"),
      expect.objectContaining({ obligationId: "obl-1" }),
    )
  })

  it("returns 201 for member role (has write access)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    vi.mocked(prisma.contractObligation.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.contractObligation.create).mockResolvedValueOnce(mockObligation as any)
    const { POST } = await import("@/app/api/contracts/[id]/obligations/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Pay invoice", dueDate: futureDate }),
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(201)
  })
})

// ─── 3. GET /api/contracts/[id]/obligations/[obligationId] ───────────────────

describe("GET /api/contracts/[id]/obligations/[obligationId]", () => {
  beforeEach(() => {
    resetMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1"),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 when obligation not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1"),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 404 when obligation belongs to different contract", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce({
      ...mockObligation,
      contractId: "contract-OTHER",
      contract: { organizationId: "org-1" },
    } as any)
    const { GET } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1"),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 404 when obligation belongs to different org", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce({
      ...mockObligation,
      contract: { organizationId: "org-OTHER" },
    } as any)
    const { GET } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1"),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 200 with obligation on happy path", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce(mockObligation as any)
    const { GET } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1"),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.id).toBe("obl-1")
    // contract field must be stripped from response
    expect(body.contract).toBeUndefined()
  })
})

// ─── 4. PATCH /api/contracts/[id]/obligations/[obligationId] ─────────────────

describe("PATCH /api/contracts/[id]/obligations/[obligationId]", () => {
  beforeEach(() => {
    resetMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { PATCH } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when role is viewer", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    const { PATCH } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when obligation not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce(null)
    const { PATCH } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated" }),
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 422 when assignee not in org", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce({
      ...mockObligation,
      contract: { organizationId: "org-1" },
    } as any)
    vi.mocked(prisma.member.findFirst).mockResolvedValueOnce(null)
    const { PATCH } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigneeId: "user-unknown" }),
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("invalid_assignee")
  })

  it("returns 200 and writes OBLIGATION_COMPLETED activity when status → COMPLETED", async () => {
    const { writeActivity } = await import("@/lib/db/activity")
    const existingObligation = {
      ...mockObligation,
      status: "PENDING",
      contract: { organizationId: "org-1" },
    }
    const updatedObligation = {
      ...mockObligation,
      status: "COMPLETED",
      completedAt: new Date(),
      completedById: "user-admin",
    }
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce(existingObligation as any)
    vi.mocked(prisma.contractObligation.update).mockResolvedValueOnce(updatedObligation as any)
    const { PATCH } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "COMPLETED" }),
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(200)
    expect(writeActivity).toHaveBeenCalledWith(
      "contract-1",
      "user-admin",
      "OBLIGATION_COMPLETED",
      expect.any(String),
      expect.objectContaining({ obligationId: "obl-1" }),
    )
  })

  it("returns 200 and writes OBLIGATION_UPDATED activity for non-completion updates", async () => {
    const { writeActivity } = await import("@/lib/db/activity")
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce({
      ...mockObligation,
      contract: { organizationId: "org-1" },
    } as any)
    vi.mocked(prisma.contractObligation.update).mockResolvedValueOnce({
      ...mockObligation,
      title: "Updated title",
    } as any)
    const { PATCH } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await PATCH(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Updated title" }),
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(200)
    expect(writeActivity).toHaveBeenCalledWith(
      "contract-1",
      "user-admin",
      "OBLIGATION_UPDATED",
      expect.any(String),
      expect.objectContaining({ obligationId: "obl-1" }),
    )
  })
})

// ─── 5. DELETE /api/contracts/[id]/obligations/[obligationId] ────────────────

describe("DELETE /api/contracts/[id]/obligations/[obligationId]", () => {
  beforeEach(() => {
    resetMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { DELETE } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await DELETE(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1", {
        method: "DELETE",
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when role is member (only admin/legal/owner can delete)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(memberCtx)
    const { DELETE } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await DELETE(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1", {
        method: "DELETE",
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 403 when role is viewer", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    const { DELETE } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await DELETE(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1", {
        method: "DELETE",
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when obligation not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce(null)
    const { DELETE } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await DELETE(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1", {
        method: "DELETE",
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 404 when obligation belongs to different org", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce({
      ...mockObligation,
      contract: { organizationId: "org-OTHER" },
    } as any)
    const { DELETE } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await DELETE(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1", {
        method: "DELETE",
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 204 on successful delete and writes activity", async () => {
    const { writeActivity } = await import("@/lib/db/activity")
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce({
      ...mockObligation,
      contract: { organizationId: "org-1" },
    } as any)
    vi.mocked(prisma.contractObligation.delete).mockResolvedValueOnce(mockObligation as any)
    const { DELETE } = await import("@/app/api/contracts/[id]/obligations/[obligationId]/route")
    const res = await DELETE(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1", {
        method: "DELETE",
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(204)
    expect(writeActivity).toHaveBeenCalledWith(
      "contract-1",
      "user-admin",
      "OBLIGATION_DELETED",
      expect.any(String),
      expect.objectContaining({ obligationId: "obl-1" }),
    )
  })
})

// ─── 6. POST /api/contracts/[id]/obligations/[obligationId]/subtasks ─────────

describe("POST /api/contracts/[id]/obligations/[obligationId]/subtasks", () => {
  beforeEach(() => {
    resetMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/route"
    )
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Send proof" }),
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when role is viewer", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    const { POST } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/route"
    )
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Send proof" }),
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when obligation not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce(null)
    const { POST } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/route"
    )
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Send proof" }),
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 404 when obligation belongs to different contract", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce({
      id: "obl-1",
      contractId: "contract-OTHER",
    } as any)
    const { POST } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/route"
    )
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Send proof" }),
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 422 when title is missing", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce({
      id: "obl-1",
      contractId: "contract-1",
    } as any)
    vi.mocked(prisma.obligationSubTask.count).mockResolvedValueOnce(0)
    const { POST } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/route"
    )
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(422)
  })

  it("returns 422 when subtask cap (20) is reached", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce({
      id: "obl-1",
      contractId: "contract-1",
    } as any)
    vi.mocked(prisma.obligationSubTask.count).mockResolvedValueOnce(20)
    const { POST } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/route"
    )
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "One too many" }),
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("subtask_limit_reached")
  })

  it("returns 201 on happy path", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce({
      id: "obl-1",
      contractId: "contract-1",
    } as any)
    vi.mocked(prisma.obligationSubTask.count).mockResolvedValueOnce(0)
    vi.mocked(prisma.obligationSubTask.create).mockResolvedValueOnce(mockSubTask as any)
    const { POST } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/route"
    )
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Send payment proof" }),
      }),
      { params: { id: "contract-1", obligationId: "obl-1" } },
    )
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.id).toBe("sub-1")
  })
})

// ─── 7. PATCH /api/.../subtasks/[subtaskId] ───────────────────────────────────

describe("PATCH /api/contracts/[id]/obligations/[obligationId]/subtasks/[subtaskId]", () => {
  beforeEach(() => {
    resetMocks()
  })

  // ensureSubTaskInScope calls contractObligation.findUnique then obligationSubTask.findUnique
  function setupHappyPathScope() {
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce({
      id: "obl-1",
      contractId: "contract-1",
      contract: { organizationId: "org-1" },
    } as any)
    vi.mocked(prisma.obligationSubTask.findUnique).mockResolvedValueOnce({
      id: "sub-1",
      obligationId: "obl-1",
    } as any)
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { PATCH } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/[subtaskId]/route"
    )
    const res = await PATCH(
      new Request(
        "http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks/sub-1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isCompleted: true }),
        },
      ),
      { params: { id: "contract-1", obligationId: "obl-1", subtaskId: "sub-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when role is viewer", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    const { PATCH } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/[subtaskId]/route"
    )
    const res = await PATCH(
      new Request(
        "http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks/sub-1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isCompleted: true }),
        },
      ),
      { params: { id: "contract-1", obligationId: "obl-1", subtaskId: "sub-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when subtask not in scope", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce(null)
    const { PATCH } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/[subtaskId]/route"
    )
    const res = await PATCH(
      new Request(
        "http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks/sub-1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isCompleted: true }),
        },
      ),
      { params: { id: "contract-1", obligationId: "obl-1", subtaskId: "sub-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 200 and marks subtask completed", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    setupHappyPathScope()
    vi.mocked(prisma.obligationSubTask.update).mockResolvedValueOnce({
      ...mockSubTask,
      isCompleted: true,
      completedAt: new Date(),
      completedById: "user-admin",
    } as any)
    const { PATCH } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/[subtaskId]/route"
    )
    const res = await PATCH(
      new Request(
        "http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks/sub-1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isCompleted: true }),
        },
      ),
      { params: { id: "contract-1", obligationId: "obl-1", subtaskId: "sub-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.isCompleted).toBe(true)
  })

  it("returns 200 and reopens subtask when isCompleted is false", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    setupHappyPathScope()
    vi.mocked(prisma.obligationSubTask.update).mockResolvedValueOnce({
      ...mockSubTask,
      isCompleted: false,
      completedAt: null,
      completedById: null,
    } as any)
    const { PATCH } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/[subtaskId]/route"
    )
    const res = await PATCH(
      new Request(
        "http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks/sub-1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isCompleted: false }),
        },
      ),
      { params: { id: "contract-1", obligationId: "obl-1", subtaskId: "sub-1" } },
    )
    expect(res.status).toBe(200)
  })

  it("returns 422 for invalid payload (title too long)", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    setupHappyPathScope()
    const { PATCH } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/[subtaskId]/route"
    )
    const res = await PATCH(
      new Request(
        "http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks/sub-1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: "x".repeat(201) }),
        },
      ),
      { params: { id: "contract-1", obligationId: "obl-1", subtaskId: "sub-1" } },
    )
    expect(res.status).toBe(422)
  })
})

// ─── 8. DELETE /api/.../subtasks/[subtaskId] ──────────────────────────────────

describe("DELETE /api/contracts/[id]/obligations/[obligationId]/subtasks/[subtaskId]", () => {
  beforeEach(() => {
    resetMocks()
  })

  function setupHappyPathScope() {
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce({
      id: "obl-1",
      contractId: "contract-1",
      contract: { organizationId: "org-1" },
    } as any)
    vi.mocked(prisma.obligationSubTask.findUnique).mockResolvedValueOnce({
      id: "sub-1",
      obligationId: "obl-1",
    } as any)
  }

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { DELETE } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/[subtaskId]/route"
    )
    const res = await DELETE(
      new Request(
        "http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks/sub-1",
        { method: "DELETE" },
      ),
      { params: { id: "contract-1", obligationId: "obl-1", subtaskId: "sub-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when role is viewer", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    const { DELETE } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/[subtaskId]/route"
    )
    const res = await DELETE(
      new Request(
        "http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks/sub-1",
        { method: "DELETE" },
      ),
      { params: { id: "contract-1", obligationId: "obl-1", subtaskId: "sub-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when subtask not in scope", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findUnique).mockResolvedValueOnce(null)
    const { DELETE } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/[subtaskId]/route"
    )
    const res = await DELETE(
      new Request(
        "http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks/sub-1",
        { method: "DELETE" },
      ),
      { params: { id: "contract-1", obligationId: "obl-1", subtaskId: "sub-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 204 on successful delete", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    setupHappyPathScope()
    vi.mocked(prisma.obligationSubTask.delete).mockResolvedValueOnce(mockSubTask as any)
    const { DELETE } = await import(
      "@/app/api/contracts/[id]/obligations/[obligationId]/subtasks/[subtaskId]/route"
    )
    const res = await DELETE(
      new Request(
        "http://localhost/api/contracts/contract-1/obligations/obl-1/subtasks/sub-1",
        { method: "DELETE" },
      ),
      { params: { id: "contract-1", obligationId: "obl-1", subtaskId: "sub-1" } },
    )
    expect(res.status).toBe(204)
  })
})

// ─── 9. POST /api/contracts/[id]/obligations/extract ─────────────────────────

describe("POST /api/contracts/[id]/obligations/extract", () => {
  beforeEach(() => {
    resetMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/obligations/extract/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations/extract", {
        method: "POST",
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 403 when role is viewer", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(viewerCtx)
    const { POST } = await import("@/app/api/contracts/[id]/obligations/extract/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations/extract", {
        method: "POST",
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(403)
  })

  it("returns 404 when contract not found", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/obligations/extract/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations/extract", {
        method: "POST",
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 422 when contract has no extracted text", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce({
      ...mockContract,
      extractedText: null,
    } as any)
    const { POST } = await import("@/app/api/contracts/[id]/obligations/extract/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations/extract", {
        method: "POST",
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("no_extracted_text")
  })

  it("returns 422 when no AI provider is configured", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    const originalProvider = process.env.AI_PROVIDER
    const originalAnthropic = process.env.ANTHROPIC_API_KEY
    const originalOpenai = process.env.OPENAI_API_KEY
    const originalOllama = process.env.OLLAMA_BASE_URL
    delete process.env.AI_PROVIDER
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY
    delete process.env.OLLAMA_BASE_URL
    const { POST } = await import("@/app/api/contracts/[id]/obligations/extract/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations/extract", {
        method: "POST",
      }),
      { params: { id: "contract-1" } },
    )
    // restore env
    if (originalProvider !== undefined) process.env.AI_PROVIDER = originalProvider
    if (originalAnthropic !== undefined) process.env.ANTHROPIC_API_KEY = originalAnthropic
    if (originalOpenai !== undefined) process.env.OPENAI_API_KEY = originalOpenai
    if (originalOllama !== undefined) process.env.OLLAMA_BASE_URL = originalOllama
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error).toBe("no_ai_provider")
  })

  it("returns 200 with jobId when extraction is enqueued", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    // Ensure an AI provider is detected
    process.env.ANTHROPIC_API_KEY = "test-key"
    const { obligationExtractQueue } = await import("@/lib/jobs/queues")
    vi.mocked(obligationExtractQueue.add).mockResolvedValueOnce({ id: "job-abc" } as any)
    const { POST } = await import("@/app/api/contracts/[id]/obligations/extract/route")
    const res = await POST(
      new Request("http://localhost/api/contracts/contract-1/obligations/extract", {
        method: "POST",
      }),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.jobId).toBe("job-abc")
  })
})

// ─── 10. GET /api/contracts/[id]/obligations/extract (job status poll) ────────

describe("GET /api/contracts/[id]/obligations/extract", () => {
  beforeEach(() => {
    resetMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/obligations/extract/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/obligations/extract?jobId=job-1"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(401)
  })

  it("returns 404 when contract not in org", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/obligations/extract/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/obligations/extract?jobId=job-1"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(404)
  })

  it("returns 400 when jobId query param is missing", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    const { GET } = await import("@/app/api/contracts/[id]/obligations/extract/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/obligations/extract"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(400)
  })

  it("returns state: not_found when job does not exist", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contract.findUnique).mockResolvedValueOnce(mockContract as any)
    // The global mock for getObligationExtractQueue returns { getJob: fn -> null }
    // which causes the route to return { state: "not_found" }
    const { GET } = await import("@/app/api/contracts/[id]/obligations/extract/route")
    const res = await GET(
      new Request("http://localhost/api/contracts/contract-1/obligations/extract?jobId=missing"),
      { params: { id: "contract-1" } },
    )
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.state).toBe("not_found")
  })
})

// ─── 11. GET /api/obligations (global list) ───────────────────────────────────

describe("GET /api/obligations", () => {
  beforeEach(() => {
    resetMocks()
  })

  it("returns 401 when unauthenticated", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/obligations/route")
    const res = await GET(new Request("http://localhost/api/obligations"))
    expect(res.status).toBe(401)
  })

  it("returns 200 with empty obligations list", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findMany).mockResolvedValueOnce([])
    const { GET } = await import("@/app/api/obligations/route")
    const res = await GET(new Request("http://localhost/api/obligations"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.obligations).toHaveLength(0)
    expect(body.total).toBe(0)
  })

  it("returns 200 with obligations list on happy path", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findMany).mockResolvedValueOnce([
      {
        ...mockObligation,
        contract: { id: "contract-1", title: "NDA", counterpartyName: "Acme" },
      },
    ] as any)
    const { GET } = await import("@/app/api/obligations/route")
    const res = await GET(new Request("http://localhost/api/obligations"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.obligations).toHaveLength(1)
    expect(body.total).toBe(1)
  })

  it("filters by status query param", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findMany).mockResolvedValueOnce([])
    const { GET } = await import("@/app/api/obligations/route")
    await GET(new Request("http://localhost/api/obligations?status=OVERDUE"))
    const findManyCall = vi.mocked(prisma.contractObligation.findMany).mock.calls[0][0] as any
    expect(findManyCall.where).toMatchObject({ status: "OVERDUE" })
  })

  it("ignores invalid status values and returns all obligations", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findMany).mockResolvedValueOnce([])
    const { GET } = await import("@/app/api/obligations/route")
    await GET(new Request("http://localhost/api/obligations?status=INVALID"))
    const findManyCall = vi.mocked(prisma.contractObligation.findMany).mock.calls[0][0] as any
    // No status filter should be applied for invalid values
    expect(findManyCall.where.status).toBeUndefined()
  })

  it("filters by q (search) query param", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findMany).mockResolvedValueOnce([])
    const { GET } = await import("@/app/api/obligations/route")
    await GET(new Request("http://localhost/api/obligations?q=payment"))
    const findManyCall = vi.mocked(prisma.contractObligation.findMany).mock.calls[0][0] as any
    expect(findManyCall.where).toMatchObject({
      title: { contains: "payment", mode: "insensitive" },
    })
  })

  it("always scopes query to org and excludes ARCHIVED contracts", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(adminCtx)
    vi.mocked(prisma.contractObligation.findMany).mockResolvedValueOnce([])
    const { GET } = await import("@/app/api/obligations/route")
    await GET(new Request("http://localhost/api/obligations"))
    const findManyCall = vi.mocked(prisma.contractObligation.findMany).mock.calls[0][0] as any
    expect(findManyCall.where.contract).toMatchObject({
      organizationId: "org-1",
      status: { not: "ARCHIVED" },
    })
  })
})
