import { beforeEach, describe, expect, it, vi } from "vitest"

const { getSession, memberFindUnique, memberFindFirst } = vi.hoisted(() => ({
  getSession: vi.fn(),
  memberFindUnique: vi.fn(),
  memberFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth/config", () => ({ auth: { api: { getSession } } }))
vi.mock("@/lib/db/client", () => ({
  prisma: {
    member: { findUnique: memberFindUnique, findFirst: memberFindFirst },
    apiKey: { findUnique: vi.fn(), update: vi.fn() },
  },
}))

import { resolveAuth } from "@/lib/auth/middleware"

describe("resolveAuth membership identity", () => {
  beforeEach(() => vi.clearAllMocks())

  it("derives memberId from the current database membership", async () => {
    getSession.mockResolvedValue({
      user: { id: "user-a" },
      session: { activeOrganizationId: "org-a" },
    })
    memberFindUnique.mockResolvedValue({ id: "member-db", organizationId: "org-a", role: "legal" })

    const req = new Request("http://localhost/api/contracts", {
      headers: { "x-member-id": "attacker-controlled" },
    })
    await expect(resolveAuth(req)).resolves.toMatchObject({
      userId: "user-a",
      organizationId: "org-a",
      memberId: "member-db",
      role: "legal",
    })
  })
})
