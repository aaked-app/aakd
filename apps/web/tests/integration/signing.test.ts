import { beforeEach, describe, expect, it, vi } from "vitest"
import { createHmac } from "crypto"
import { prisma } from "@/lib/db/client"
import { signingSyncQueue } from "@/lib/jobs/queues"

const sessionCtx = {
  userId: "user-1", organizationId: "org-1", memberId: "member-1",
  role: "admin", source: "session" as const, requestId: "request-1",
}

vi.mock("@/lib/auth/middleware", () => ({
  resolveAuth: vi.fn(),
  requireWriteScope: vi.fn(() => null),
}))
vi.mock("@/lib/signature/config", () => ({
  getDocuSealWebhookIntegration: vi.fn(async (id: string) => id === "integration-a"
    ? { organizationId: "org-a", providerId: "integration:integration-a", secret: "secret-a" }
    : id === "integration-b"
      ? { organizationId: "org-b", providerId: "integration:integration-b", secret: "secret-b" }
      : null),
}))
vi.mock("@/lib/docuseal", () => ({
  DOCUSEAL_JSON_BODY_LIMIT: 1024 * 1024,
  createTemplate: vi.fn(),
  createSubmission: vi.fn(),
}))

function webhookRequest(payload: unknown, secret: string, query = ""): Request {
  const body = JSON.stringify(payload)
  return new Request(`http://localhost/api/webhooks/docuseal${query}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-docuseal-signature": createHmac("sha256", secret).update(body).digest("hex"),
    },
    body,
  })
}

describe("fail-closed signature initiation", () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValue(sessionCtx)
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValue({ id: "grant-1" } as never)
  })

  it("requires authentication", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    expect((await POST(new Request("http://localhost/api/contracts/c1/signing/send", { method: "POST" }), { params: Promise.resolve({ id: "c1" }) })).status).toBe(401)
  })

  it("rejects generic write API keys before any provider or database mutation", async () => {
    const { resolveAuth } = await import("@/lib/auth/middleware")
    vi.mocked(resolveAuth).mockResolvedValueOnce({ ...sessionCtx, source: "api_key", apiKeyId: "key-1", scopes: ["write"] })
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    const response = await POST(new Request("http://localhost/api/contracts/c1/signing/send", { method: "POST" }), { params: Promise.resolve({ id: "c1" }) })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "human_session_required" })
    expect(prisma.contract.update).not.toHaveBeenCalled()
  })

  it("does not disclose an inaccessible agreement", async () => {
    vi.mocked(prisma.contractAccessGrant.findFirst).mockResolvedValueOnce(null)
    const { POST } = await import("@/app/api/contracts/[id]/signing/send/route")
    expect((await POST(new Request("http://localhost/api/contracts/c1/signing/send", { method: "POST" }), { params: Promise.resolve({ id: "c1" }) })).status).toBe(404)
  })

  it.each([
    { path: "sign", load: () => import("@/app/api/contracts/[id]/sign/route") },
    { path: "signing/send", load: () => import("@/app/api/contracts/[id]/signing/send/route") },
  ])("pauses $path without calling DocuSeal", async ({ path, load }) => {
    const { createTemplate, createSubmission } = await import("@/lib/docuseal")
    const { POST } = await load()
    const response = await POST(new Request(`http://localhost/api/contracts/c1/${path}`, { method: "POST" }), { params: Promise.resolve({ id: "c1" }) })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual(expect.objectContaining({ error: "signing_send_temporarily_unavailable" }))
    expect(createTemplate).not.toHaveBeenCalled()
    expect(createSubmission).not.toHaveBeenCalled()
  })
})

describe("DocuSeal webhook authentication and queue boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.DOCUSEAL_WEBHOOK_SECRET = "global-secret"
    process.env.DOCUSEAL_API_URL = "https://api.docuseal.example"
  })

  it("rejects declared and streamed oversized bodies", async () => {
    const { POST } = await import("@/app/api/webhooks/docuseal/route")
    const declared = new Request("http://localhost/api/webhooks/docuseal", {
      method: "POST", headers: { "content-length": String(1024 * 1024 + 1) }, body: "{}",
    })
    expect((await POST(declared)).status).toBe(413)
    const streamed = new Request("http://localhost/api/webhooks/docuseal", {
      method: "POST", body: "x".repeat(1024 * 1024 + 1), duplex: "half",
    } as RequestInit & { duplex: "half" })
    expect((await POST(streamed)).status).toBe(413)
  })

  it("rejects malformed payloads and invalid signatures without queueing", async () => {
    const { POST } = await import("@/app/api/webhooks/docuseal/route")
    expect((await POST(webhookRequest({ event_type: "submission.completed", data: {} }, "global-secret"))).status).toBe(422)
    expect((await POST(webhookRequest({ event_type: "submission.completed", data: { id: 9 } }, "wrong"))).status).toBe(403)
    expect(signingSyncQueue.add).not.toHaveBeenCalled()
  })

  it("binds colliding provider-local submission IDs to distinct authenticated integrations", async () => {
    const { POST } = await import("@/app/api/webhooks/docuseal/route")
    const payload = { event_type: "submission.completed", timestamp: "2026-09-09T20:00:00Z", data: { id: 77, status: "completed" } }
    expect((await POST(webhookRequest(payload, "secret-a", "?integrationId=integration-a"))).status).toBe(200)
    expect((await POST(webhookRequest(payload, "secret-b", "?integrationId=integration-b"))).status).toBe(200)
    expect(signingSyncQueue.add).toHaveBeenNthCalledWith(1, "sync", expect.objectContaining({ submissionId: "77", providerId: "integration:integration-a", organizationId: "org-a" }), expect.anything())
    expect(signingSyncQueue.add).toHaveBeenNthCalledWith(2, "sync", expect.objectContaining({ submissionId: "77", providerId: "integration:integration-b", organizationId: "org-b" }), expect.anything())
  })

  it("uses a stable job id for an exact webhook replay", async () => {
    const { POST } = await import("@/app/api/webhooks/docuseal/route")
    const req = () => webhookRequest({ event_type: "submission.completed", timestamp: "2026-09-09T20:00:00Z", data: { id: 88 } }, "secret-a", "?integrationId=integration-a")
    await POST(req()); await POST(req())
    const first = vi.mocked(signingSyncQueue.add).mock.calls[0][2]
    const second = vi.mocked(signingSyncQueue.add).mock.calls[1][2]
    expect(first?.jobId).toBe(second?.jobId)
  })
})
