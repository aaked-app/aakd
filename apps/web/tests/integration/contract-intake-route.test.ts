import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({
  ctx: {
    userId: "user-1",
    organizationId: "org-1",
    memberId: "member-1",
    role: "member",
    source: "session" as "session" | "api_key",
    requestId: "log-request-1",
  },
  create: vi.fn(),
  find: vi.fn(),
}))

vi.mock("@/lib/auth/middleware", () => ({ resolveAuth: vi.fn(async () => state.ctx) }))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue({ allowed: true, retryAfter: 0 }),
  rateLimitResponse: vi.fn(),
}))
vi.mock("@/lib/contracts/intake", async () => {
  const actual = await vi.importActual<typeof import("@/lib/contracts/intake")>("@/lib/contracts/intake")
  return { ...actual, createContractIntake: state.create, findContractIntakeReplay: state.find }
})

function multipartForm(overrides: Partial<Record<"requestId" | "metadata" | "extractions" | "file", FormDataEntryValue>> = {}) {
  const form = new FormData()
  form.set("requestId", overrides.requestId ?? "11111111-1111-4111-8111-111111111111")
  form.set("metadata", overrides.metadata ?? JSON.stringify({ title: "Agreement" }))
  form.set("extractions", overrides.extractions ?? "[]")
  form.set("file", overrides.file ?? new File(["%PDF-1.7\nsynthetic"], "agreement.pdf", { type: "application/pdf" }))
  return form
}

function makeFormRequest(form: FormData): Request {
  const request = new Request("http://localhost/api/contracts/intake", { method: "POST", body: "" })
  Object.defineProperty(request, "formData", { value: () => Promise.resolve(form) })
  return request
}

function multipart(overrides: Partial<Record<"requestId" | "metadata" | "extractions" | "file", FormDataEntryValue>> = {}) {
  return makeFormRequest(multipartForm(overrides))
}

describe("contract intake route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.ctx.source = "session"
    state.ctx.memberId = "member-1"
    state.ctx.role = "member"
    state.create.mockResolvedValue({ id: "contract-1", extractionQueued: true, conversionQueued: false, replayed: false })
    state.find.mockResolvedValue({ id: "contract-1" })
  })

  it("rejects API keys before parsing or durable side effects", async () => {
    state.ctx.source = "api_key"
    const { POST } = await import("@/app/api/contracts/intake/route")
    const response = await POST(new Request("http://localhost/api/contracts/intake", { method: "POST", body: "not multipart" }))
    expect(response.status).toBe(403)
    expect(state.create).not.toHaveBeenCalled()
  })

  it("rejects duplicate and unsupported multipart fields", async () => {
    const { POST } = await import("@/app/api/contracts/intake/route")
    const duplicate = multipartForm()
    duplicate.append("metadata", JSON.stringify({ title: "Different" }))
    expect((await POST(makeFormRequest(duplicate))).status).toBe(422)

    const unsupported = multipartForm()
    unsupported.set("ownerId", "attacker")
    expect((await POST(makeFormRequest(unsupported))).status).toBe(422)
    expect(state.create).not.toHaveBeenCalled()
  })

  it("validates magic bytes and passes one normalized operation to the service", async () => {
    const { POST } = await import("@/app/api/contracts/intake/route")
    const bad = await POST(multipart({ file: new File(["not a document"], "fake.pdf", { type: "application/pdf" }) }))
    expect(bad.status).toBe(415)

    const response = await POST(multipart({
      metadata: JSON.stringify({ title: "<b>Agreement</b>", governingLaw: "" }),
      extractions: JSON.stringify([{ field: "governingLaw", rawValue: "", confidence: 1, extractedBy: "manual" }]),
    }))
    expect(response.status).toBe(201)
    expect(await response.json()).toEqual({ id: "contract-1", extractionQueued: true, conversionQueued: false, replayed: false })
    expect(state.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ memberId: "member-1" }), expect.objectContaining({
      metadata: expect.objectContaining({ title: "Agreement" }),
      file: expect.objectContaining({ filename: "agreement.pdf", mimeType: "application/pdf" }),
    }))
  })

  it("recovers only a currently authorized original-member replay", async () => {
    const { GET } = await import("@/app/api/contracts/intake/route")
    const found = await GET(new Request("http://localhost/api/contracts/intake?requestId=11111111-1111-4111-8111-111111111111"))
    expect(found.status).toBe(200)
    expect(await found.json()).toEqual({ id: "contract-1" })

    state.find.mockResolvedValue(null)
    const missing = await GET(new Request("http://localhost/api/contracts/intake?requestId=11111111-1111-4111-8111-111111111111"))
    expect(missing.status).toBe(404)
    expect(await missing.json()).toEqual({ error: "Not Found" })
  })
})
