import { beforeEach, describe, expect, it, vi } from "vitest"
import { prisma } from "@/lib/db/client"

const session = {
  userId: "user-1", organizationId: "org-1", memberId: "member-1",
  role: "admin", source: "session" as const, requestId: "request-1",
}

vi.mock("@/lib/auth/middleware", () => ({ resolveAuth: vi.fn(async () => session) }))
vi.mock("@/lib/context", () => ({ requestContext: { run: vi.fn((_ctx: unknown, fn: () => unknown) => fn()) } }))
vi.mock("@/lib/docuseal", () => ({ testDocuSealConnection: vi.fn(async () => true) }))
vi.mock("@/lib/notifications/crypto", () => ({ encrypt: vi.fn((value: string) => `encrypted:${value}`) }))

function request(baseUrl: string) {
  return new Request("http://localhost/api/org/signature", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ provider: "DOCUSEAL", baseUrl, apiKey: "synthetic-key" }),
  })
}

describe("DocuSeal integration identity", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.$queryRaw).mockResolvedValue([{ id: "org-1" }] as never)
    vi.mocked(prisma.signatureIntegration.findUnique).mockResolvedValue({
      id: "integration-1", baseUrl: "https://docuseal.example/api", provider: "DOCUSEAL", enabled: true,
    } as never)
    vi.mocked(prisma.contract.findFirst).mockResolvedValue({ id: "contract-1" } as never)
    vi.mocked(prisma.signatureIntegration.upsert).mockResolvedValue({
      provider: "DOCUSEAL", baseUrl: "https://docuseal.example/api", enabled: true, createdAt: new Date(),
    } as never)
  })

  it("rejects changing the normalized provider origin when any historical submission exists", async () => {
    const { POST } = await import("@/app/api/org/signature/route")
    const response = await POST(request("https://other-docuseal.example"))

    expect(response.status).toBe(409)
    expect(await response.json()).toEqual({ error: "docuseal_origin_in_use" })
    expect(prisma.signatureIntegration.upsert).not.toHaveBeenCalled()
  })

  it("allows credential rotation and normalization on the same full provider base", async () => {
    const { POST } = await import("@/app/api/org/signature/route")
    const response = await POST(request("https://DOCUSEAL.example:443/api/"))

    expect(response.status).toBe(200)
    expect(prisma.signatureIntegration.upsert).toHaveBeenCalled()
    expect(prisma.$queryRaw).toHaveBeenCalled()
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: "Serializable" })
  })

  it("rejects changing only the reverse-proxy base path while submissions exist", async () => {
    const { POST } = await import("@/app/api/org/signature/route")
    const response = await POST(request("https://docuseal.example/instance-b"))

    expect(response.status).toBe(409)
    expect(prisma.signatureIntegration.upsert).not.toHaveBeenCalled()
  })

  it("rejects query and fragment components in a provider base URL", async () => {
    const { POST } = await import("@/app/api/org/signature/route")
    expect((await POST(request("https://docuseal.example/api?tenant=other"))).status).toBe(422)
    expect((await POST(request("https://docuseal.example/api#other"))).status).toBe(422)
    expect(prisma.signatureIntegration.upsert).not.toHaveBeenCalled()
  })

  it("disconnects without deleting provider identity and reconnects the same full base", async () => {
    const route = await import("@/app/api/org/signature/route")
    const disconnected = await route.DELETE(new Request("http://localhost/api/org/signature", { method: "DELETE" }))

    expect(disconnected.status).toBe(200)
    expect(prisma.signatureIntegration.updateMany).toHaveBeenCalledWith({
      where: { organizationId: "org-1", enabled: true },
      data: { enabled: false },
    })
    expect(prisma.signatureIntegration.deleteMany).not.toHaveBeenCalled()

    const reconnected = await route.POST(request("https://DOCUSEAL.example:443/api/"))
    expect(reconnected.status).toBe(200)
    expect(prisma.signatureIntegration.upsert).toHaveBeenCalledWith(expect.objectContaining({
      where: { organizationId: "org-1" },
      update: expect.objectContaining({ enabled: true }),
    }))
  })
})
