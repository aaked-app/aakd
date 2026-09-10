import { beforeEach, describe, expect, it, vi } from "vitest"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/db/client"
import { auth } from "@/lib/auth/config"
import { resolveAuth } from "@/lib/auth/middleware"

vi.mock("@/lib/auth/config", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("bcryptjs", () => ({ default: { compare: vi.fn() } }))

const request = () => new Request("http://localhost/api/contracts", {
  headers: { Authorization: "Bearer cf_live_synthetic-test-key" },
})

describe("API keys retain only their creator's current membership", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
      id: "key-1", keyHash: "synthetic-hash", organizationId: "org-1",
      scopes: ["read", "write"], createdById: "user-1", revokedAt: null, expiresAt: null,
    } as never)
    vi.mocked(prisma.apiKey.update).mockResolvedValue({} as never)
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never)
    vi.mocked(prisma.member.findUnique).mockResolvedValue({ id: "member-1", role: "viewer" } as never)
  })

  it("rejects a key after its creator leaves the organization", async () => {
    vi.mocked(prisma.member.findUnique).mockResolvedValue(null)
    expect(await resolveAuth(request())).toBeNull()
    expect(auth.api.getSession).not.toHaveBeenCalled()
    expect(prisma.apiKey.update).not.toHaveBeenCalled()
  })

  it("rejects a deleted key without falling back to a session", async () => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue(null)
    expect(await resolveAuth(request())).toBeNull()
    expect(auth.api.getSession).not.toHaveBeenCalled()
    expect(bcrypt.compare).not.toHaveBeenCalled()
    expect(prisma.member.findUnique).not.toHaveBeenCalled()
    expect(prisma.apiKey.update).not.toHaveBeenCalled()
  })

  it.each(["Bearer wrong-prefix", "Bearer ", "Basic synthetic", "", "bearer unsupported"])(
    "does not turn an explicit unsupported credential into cookie authority (%j)", async authorization => {
      vi.mocked(auth.api.getSession).mockResolvedValue({ user: { id: "user-1" }, session: { activeOrganizationId: "org-1" } } as never)
      const response = await resolveAuth(new Request("http://localhost/api/contracts", {
        headers: { Authorization: authorization, Cookie: "better-auth.session_token=synthetic" },
      }))
      expect(response).toBeNull()
      expect(auth.api.getSession).not.toHaveBeenCalled()
      expect(prisma.apiKey.findUnique).not.toHaveBeenCalled()
      expect(prisma.member.findUnique).not.toHaveBeenCalled()
    },
  )

  it.each([[], ["write"], ["text_read"], ["action_propose"], ["write", "text_read", "action_propose"]])(
    "never infers foundational read permission from another scope (%j)", async (...scopes) => {
      vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({
        id: "key-1", keyHash: "synthetic-hash", organizationId: "org-1",
        scopes, createdById: "user-1", revokedAt: null, expiresAt: null,
      } as never)
      expect(await resolveAuth(request())).toBeNull()
      expect(auth.api.getSession).not.toHaveBeenCalled()
      expect(prisma.member.findUnique).not.toHaveBeenCalled()
      expect(prisma.apiKey.update).not.toHaveBeenCalled()
    },
  )

  it("inherits a downgraded role instead of retaining the old privileges", async () => {
    expect(await resolveAuth(request())).toMatchObject({ role: "viewer", source: "api_key", memberId: "member-1" })
    expect(prisma.member.findUnique).toHaveBeenCalledWith({
      where: { userId_organizationId: { userId: "user-1", organizationId: "org-1" } },
      select: { id: true, role: true },
    })
  })

  it.each([
    { revokedAt: new Date(), expiresAt: null },
    { revokedAt: null, expiresAt: new Date(0) },
  ])("rejects inactive keys without falling back to a session (%j)", async (state) => {
    vi.mocked(prisma.apiKey.findUnique).mockResolvedValue({ ...state } as never)
    expect(await resolveAuth(request())).toBeNull()
    expect(auth.api.getSession).not.toHaveBeenCalled()
    expect(prisma.member.findUnique).not.toHaveBeenCalled()
  })
})
