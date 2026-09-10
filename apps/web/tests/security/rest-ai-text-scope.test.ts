import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { resolveAuth } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/client"
import { POST as ask } from "@/app/api/contracts/[id]/ask/route"
import { POST as explain } from "@/app/api/contracts/[id]/clause-explain/route"

vi.mock("@/lib/auth/middleware", () => ({ resolveAuth: vi.fn() }))

const ctx = { userId: "user-a", memberId: "member-a", organizationId: "org-a", role: "owner" as const, requestId: "scope-probe" }
beforeEach(() => vi.clearAllMocks())

describe.each([{ name: "ask", handler: ask }, { name: "clause-explain", handler: explain }])("REST AI text scope: $name", ({ name, handler }) => {
  it.each([[], ["read"], ["write"], ["read", "write"]])("rejects a metadata-only key before parsing or loading data (%j)", async (...scopes) => {
    vi.mocked(resolveAuth).mockResolvedValue({ ...ctx, source: "api_key", scopes: scopes as string[] })
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)
    try {
      const response = await handler(new NextRequest(`http://localhost/api/contracts/agreement-a/${name}`, { method: "POST", body: "invalid-json" }), { params: Promise.resolve({ id: "agreement-a" }) })
      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ error: "text_read scope required" })
      expect(prisma.contract.findFirst).not.toHaveBeenCalled()
      expect(prisma.contract.findUnique).not.toHaveBeenCalled()
      expect(prisma.contractAccessGrant.findFirst).not.toHaveBeenCalled()
      expect(fetchMock).not.toHaveBeenCalled()
    } finally { vi.unstubAllGlobals() }
  })

  it.each(["session", "api_key"] as const)("keeps normal validation for authorized %s requests", async source => {
    vi.mocked(resolveAuth).mockResolvedValue({ ...ctx, source, scopes: ["read", "text_read"] })
    const response = await handler(new NextRequest(`http://localhost/api/contracts/agreement-a/${name}`, { method: "POST", body: "invalid-json" }), { params: Promise.resolve({ id: "agreement-a" }) })
    expect(response.status).toBe(400)
  })
})
