import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db/client"
import { resolveAuth } from "@/lib/auth/middleware"

vi.mock("@/lib/auth/middleware", () => ({
  resolveAuth: vi.fn(),
  requireWriteScope: vi.fn(() => null),
}))

const ctx = {
  userId: "user-manager",
  organizationId: "org-1",
  memberId: "member-manager",
  role: "admin",
  source: "session" as const,
  requestId: "request-1",
}

const apiKeyCtx = {
  ...ctx,
  source: "api_key" as const,
  scopes: ["read", "write"],
}

const params = Promise.resolve({ id: "contract-1" })

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(resolveAuth).mockResolvedValue(ctx)
  vi.mocked(prisma.contractAccessGrant.findFirst).mockReset().mockResolvedValue({ id: "caller-grant" } as never)
  vi.mocked(prisma.contract.findUnique).mockResolvedValue({ id: "contract-1", ownerId: "owner-user", organizationId: "org-1" } as never)
  vi.mocked(prisma.contract.findFirst).mockResolvedValue({ id: "contract-1", ownerId: "owner-user", organizationId: "org-1" } as never)
  vi.mocked(prisma.member.findFirst).mockReset().mockImplementation(((args?: Parameters<typeof prisma.member.findFirst>[0]) => {
    const where = args?.where as { id?: string; userId?: string } | undefined
    if (where?.id === "member-manager") {
      return Promise.resolve({ id: "member-manager", userId: "user-manager", organizationId: "org-1", role: "admin" })
    }
    return Promise.resolve({ id: "member-target", userId: where?.userId ?? "target-user", organizationId: "org-1", role: "member" })
  }) as never)
})

describe("contract access management", () => {
  it.each(["GET", "POST"] as const)("rejects %s access management through an API key before reading agreement data", async method => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(apiKeyCtx)
    const route = await import("@/app/api/contracts/[id]/access/route")
    const response = method === "GET"
      ? await route.GET(new Request("http://localhost/api/contracts/contract-1/access"), { params })
      : await route.POST(new Request("http://localhost/api/contracts/contract-1/access", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ memberId: "member-target" }),
        }), { params })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "human_session_required" })
    expect(prisma.contractAccessGrant.findFirst).not.toHaveBeenCalled()
    expect(prisma.contractAccessGrant.create).not.toHaveBeenCalled()
  })

  it("rejects grant revocation through an API key before reading agreement data", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(apiKeyCtx)
    const { DELETE } = await import("@/app/api/contracts/[id]/access/[memberId]/route")
    const response = await DELETE(new Request("http://localhost/api/contracts/contract-1/access/member-target", { method: "DELETE" }), {
      params: Promise.resolve({ id: "contract-1", memberId: "member-target" }),
    })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "human_session_required" })
    expect(prisma.contractAccessGrant.findFirst).not.toHaveBeenCalled()
    expect(prisma.contractAccessGrant.delete).not.toHaveBeenCalled()
  })

  it("does not let an ungranted organization admin discover grants", async () => {
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValueOnce(null)
    const { GET } = await import("@/app/api/contracts/[id]/access/route")
    const response = await GET(new Request("http://localhost/api/contracts/contract-1/access"), { params })
    expect(response.status).toBe(404)
    expect(prisma.contract.findUnique).not.toHaveBeenCalled()
  })

  it("creates and audits a current same-organization member grant atomically", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: "member-target", userId: "target-user", organizationId: "org-1" } as never)
    vi.mocked(prisma.contractAccessGrant.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.contractAccessGrant.create).mockResolvedValue({ id: "grant-new", memberId: "member-target" } as never)
    vi.mocked(prisma.activity.create).mockResolvedValue({ id: "activity-1" } as never)
    const { POST } = await import("@/app/api/contracts/[id]/access/route")
    const response = await POST(new Request("http://localhost/api/contracts/contract-1/access", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ memberId: "member-target" }),
    }), { params })
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ alreadyGranted: false })
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(prisma.activity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "ACCESS_GRANTED", contractId: "contract-1", userId: "user-manager" }),
    }))
  })

  it("denies a grant when the caller's current transaction-time role was downgraded", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: "member-target", userId: "target-user", organizationId: "org-1" } as never)
    vi.mocked(prisma.member.findFirst).mockResolvedValue({ id: "member-manager", userId: "user-manager", organizationId: "org-1", role: "legal" } as never)
    const { POST } = await import("@/app/api/contracts/[id]/access/route")
    const response = await POST(new Request("http://localhost/api/contracts/contract-1/access", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: "member-target" }),
    }), { params })

    expect(response.status).toBe(403)
    expect(prisma.contractAccessGrant.create).not.toHaveBeenCalled()
    expect(prisma.activity.create).not.toHaveBeenCalled()
  })

  it("denies a grant when the caller's exact agreement grant was concurrently revoked", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: "member-target", userId: "target-user", organizationId: "org-1" } as never)
    vi.mocked(prisma.contractAccessGrant.findFirst)
      .mockResolvedValueOnce({ id: "caller-grant" } as never)
      .mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/access/route")
    const response = await POST(new Request("http://localhost/api/contracts/contract-1/access", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: "member-target" }),
    }), { params })

    expect(response.status).toBe(404)
    expect(prisma.contractAccessGrant.create).not.toHaveBeenCalled()
    expect(prisma.activity.create).not.toHaveBeenCalled()
  })

  it("denies a grant when the caller's organization membership was concurrently removed", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: "member-target", userId: "target-user", organizationId: "org-1" } as never)
    vi.mocked(prisma.member.findFirst).mockResolvedValue(null)
    const { POST } = await import("@/app/api/contracts/[id]/access/route")
    const response = await POST(new Request("http://localhost/api/contracts/contract-1/access", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: "member-target" }),
    }), { params })

    expect(response.status).toBe(404)
    expect(prisma.contractAccessGrant.create).not.toHaveBeenCalled()
    expect(prisma.activity.create).not.toHaveBeenCalled()
  })

  it("returns the existing grant idempotently without another activity", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: "member-target", userId: "target-user", organizationId: "org-1" } as never)
    vi.mocked(prisma.contractAccessGrant.findUnique).mockResolvedValue({ id: "grant-existing", memberId: "member-target" } as never)
    const { POST } = await import("@/app/api/contracts/[id]/access/route")
    const response = await POST(new Request("http://localhost/api/contracts/contract-1/access", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ memberId: "member-target" }),
    }), { params })
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ alreadyGranted: true })
    expect(prisma.activity.create).not.toHaveBeenCalled()
  })

  it("refuses to revoke the contract owner's access", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: "member-owner", userId: "owner-user", organizationId: "org-1" } as never)
    const { DELETE } = await import("@/app/api/contracts/[id]/access/[memberId]/route")
    const response = await DELETE(new Request("http://localhost/api/contracts/contract-1/access/member-owner", { method: "DELETE" }), {
      params: Promise.resolve({ id: "contract-1", memberId: "member-owner" }),
    })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: "owner_access_required" })
  })

  it("refuses to remove the final active grant", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: "member-target", userId: "target-user", organizationId: "org-1" } as never)
    vi.mocked(prisma.contractAccessGrant.findUnique).mockResolvedValue({ id: "grant-target", memberId: "member-target" } as never)
    vi.mocked(prisma.contractAccessGrant.count).mockResolvedValue(1)
    const { DELETE } = await import("@/app/api/contracts/[id]/access/[memberId]/route")
    const response = await DELETE(new Request("http://localhost/api/contracts/contract-1/access/member-target", { method: "DELETE" }), {
      params: Promise.resolve({ id: "contract-1", memberId: "member-target" }),
    })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: "last_agreement_grant" })
  })

  it("deletes a non-owner grant and appends its revocation activity atomically", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: "member-target", userId: "target-user", organizationId: "org-1" } as never)
    vi.mocked(prisma.contractAccessGrant.findUnique).mockResolvedValue({ id: "grant-target", memberId: "member-target" } as never)
    vi.mocked(prisma.contractAccessGrant.count).mockResolvedValue(2)
    vi.mocked(prisma.contractAccessGrant.delete).mockResolvedValue({ id: "grant-target" } as never)
    vi.mocked(prisma.activity.create).mockResolvedValue({ id: "activity-2" } as never)
    const { DELETE } = await import("@/app/api/contracts/[id]/access/[memberId]/route")
    const response = await DELETE(new Request("http://localhost/api/contracts/contract-1/access/member-target", { method: "DELETE" }), {
      params: Promise.resolve({ id: "contract-1", memberId: "member-target" }),
    })
    expect(response.status).toBe(204)
    expect(prisma.contractAccessGrant.delete).toHaveBeenCalledWith({ where: { id: "grant-target" } })
    expect(prisma.activity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "ACCESS_REVOKED", metadata: expect.objectContaining({ grantId: "grant-target", targetMemberId: "member-target" }) }),
    }))
  })

  it("denies revocation when the caller's current transaction-time role was downgraded", async () => {
    vi.mocked(prisma.member.findFirst).mockResolvedValue({ id: "member-manager", userId: "user-manager", organizationId: "org-1", role: "legal" } as never)
    const { DELETE } = await import("@/app/api/contracts/[id]/access/[memberId]/route")
    const response = await DELETE(new Request("http://localhost/api/contracts/contract-1/access/member-target", { method: "DELETE" }), {
      params: Promise.resolve({ id: "contract-1", memberId: "member-target" }),
    })

    expect(response.status).toBe(403)
    expect(prisma.contractAccessGrant.delete).not.toHaveBeenCalled()
    expect(prisma.activity.create).not.toHaveBeenCalled()
  })

  it("denies revocation when the caller's exact agreement grant was concurrently revoked", async () => {
    vi.mocked(prisma.contractAccessGrant.findFirst)
      .mockResolvedValueOnce({ id: "caller-grant" } as never)
      .mockResolvedValueOnce(null)
    const { DELETE } = await import("@/app/api/contracts/[id]/access/[memberId]/route")
    const response = await DELETE(new Request("http://localhost/api/contracts/contract-1/access/member-target", { method: "DELETE" }), {
      params: Promise.resolve({ id: "contract-1", memberId: "member-target" }),
    })

    expect(response.status).toBe(404)
    expect(prisma.contractAccessGrant.delete).not.toHaveBeenCalled()
    expect(prisma.activity.create).not.toHaveBeenCalled()
  })

  it("does not let a non-owner legal user transfer agreement ownership", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce({ ...ctx, role: "legal" })
    const { PATCH } = await import("@/app/api/contracts/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/contracts/contract-1", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerId: "target-user" }),
    }), { params })
    expect(response.status).toBe(403)
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })

  it("rejects an API-key owner transfer before reading or changing the agreement", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(apiKeyCtx)
    const { PATCH } = await import("@/app/api/contracts/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/contracts/contract-1", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerId: "target-user" }),
    }), { params })

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "human_session_required" })
    expect(prisma.contractAccessGrant.findFirst).not.toHaveBeenCalled()
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })

  it("preserves an API key's ordinary scoped contract metadata update", async () => {
    vi.mocked(resolveAuth).mockResolvedValueOnce(apiKeyCtx)
    vi.mocked(prisma.contract.update).mockResolvedValue({ id: "contract-1", notes: "updated" } as never)
    vi.mocked(prisma.activity.create).mockResolvedValue({ id: "activity-metadata" } as never)
    const { PATCH } = await import("@/app/api/contracts/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/contracts/contract-1", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ notes: "updated" }),
    }), { params })

    expect(response.status).toBe(200)
    expect(prisma.contract.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ notes: "updated", ownerId: undefined }),
    }))
  })

  it("denies owner transfer when the caller's current transaction-time role was downgraded", async () => {
    vi.mocked(prisma.member.findFirst).mockImplementation(((args?: Parameters<typeof prisma.member.findFirst>[0]) => {
      const where = args?.where as { id?: string; userId?: string } | undefined
      if (where?.id === "member-manager") {
        return Promise.resolve({ id: "member-manager", userId: "user-manager", organizationId: "org-1", role: "legal" })
      }
      return Promise.resolve({ id: "member-target", userId: "target-user", organizationId: "org-1", role: "member" })
    }) as never)
    const { PATCH } = await import("@/app/api/contracts/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/contracts/contract-1", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerId: "target-user" }),
    }), { params })

    expect(response.status).toBe(403)
    expect(prisma.contract.update).not.toHaveBeenCalled()
    expect(prisma.contractAccessGrant.create).not.toHaveBeenCalled()
  })

  it("denies owner transfer when the caller's exact agreement grant was concurrently revoked", async () => {
    vi.mocked(prisma.contractAccessGrant.findFirst)
      .mockResolvedValueOnce({ id: "caller-grant" } as never)
      .mockResolvedValueOnce(null)
    const { PATCH } = await import("@/app/api/contracts/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/contracts/contract-1", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerId: "target-user" }),
    }), { params })

    expect(response.status).toBe(404)
    expect(prisma.contract.update).not.toHaveBeenCalled()
    expect(prisma.contractAccessGrant.create).not.toHaveBeenCalled()
  })

  it("atomically grants a current member before transferring ownership", async () => {
    vi.mocked(prisma.contractAccessGrant.findUnique).mockResolvedValue(null)
    vi.mocked(prisma.contractAccessGrant.create).mockResolvedValue({ id: "grant-owner" } as never)
    vi.mocked(prisma.contract.update).mockResolvedValue({ id: "contract-1", ownerId: "target-user" } as never)
    vi.mocked(prisma.activity.create).mockResolvedValue({ id: "activity-owner" } as never)
    const { PATCH } = await import("@/app/api/contracts/[id]/route")
    const response = await PATCH(new Request("http://localhost/api/contracts/contract-1", {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ownerId: "target-user" }),
    }), { params })
    expect(response.status).toBe(200)
    expect(prisma.$transaction).toHaveBeenCalled()
    expect(prisma.contractAccessGrant.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ contractId: "contract-1", memberId: "member-target" }),
    }))
    expect(prisma.contract.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ ownerId: "target-user" }) }))
  })

  it("requires ownership transfer before deleting a member who owns agreements", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: "member-target", userId: "target-user", organizationId: "org-1", role: "member" } as never)
    vi.mocked(prisma.contract.count).mockResolvedValue(1)
    const { DELETE: removeMember } = await import("@/app/api/org/members/[id]/route")
    const response = await removeMember(new Request("http://localhost/api/org/members/member-target", { method: "DELETE" }), {
      params: Promise.resolve({ id: "member-target" }),
    })
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ error: "member_owns_contracts" })
    expect(prisma.member.delete).not.toHaveBeenCalled()
  })

  it("audits grant revocations before deleting a membership", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: "member-target", userId: "target-user", organizationId: "org-1", role: "member" } as never)
    vi.mocked(prisma.contract.count).mockResolvedValue(0)
    vi.mocked(prisma.contractAccessGrant.findMany).mockResolvedValue([{ id: "grant-target", contractId: "contract-1" }] as never)
    vi.mocked(prisma.member.delete).mockResolvedValue({ id: "member-target" } as never)
    const { DELETE: removeMember } = await import("@/app/api/org/members/[id]/route")
    const response = await removeMember(new Request("http://localhost/api/org/members/member-target", { method: "DELETE" }), {
      params: Promise.resolve({ id: "member-target" }),
    })
    expect(response.status).toBe(204)
    expect(prisma.activity.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "ACCESS_REVOKED", contractId: "contract-1" }),
    }))
    expect(prisma.contractAccessGrant.deleteMany).toHaveBeenCalledBefore(vi.mocked(prisma.member.delete))
  })
})
