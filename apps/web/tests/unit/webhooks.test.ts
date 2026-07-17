import { describe, it, expect, vi, afterEach, beforeEach } from "vitest"
import { sendSlackAlert, sendTeamsAlert, sendSlackEvent, sendTeamsEvent } from "@/lib/notifications/webhooks"

vi.mock("@/lib/notifications/validate-webhook-url", () => ({
  validateWebhookUrl: vi.fn().mockResolvedValue(undefined),
}))

// ─── Shared test fixture ──────────────────────────────────────────────────────

const OPTS = {
  contractTitle: "Acme SaaS MSA",
  counterpartyName: "Acme Corp",
  daysUntilExpiry: 30,
  contractId: "ctr_abc123",
  appUrl: "https://app.clauseflow.io",
}

const SLACK_URL = "https://hooks.slack.com/services/TEST/WEBHOOK"
const TEAMS_URL = "https://prod-123.westus2.logic.azure.com/workflows/TEST"

afterEach(() => {
  vi.restoreAllMocks()
  delete process.env.SLACK_WEBHOOK_URL
  delete process.env.TEAMS_WEBHOOK_URL
})

// ─── sendSlackAlert ───────────────────────────────────────────────────────────

describe("sendSlackAlert", () => {
  it("returns false immediately when SLACK_WEBHOOK_URL is not set — no fetch call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const result = await sendSlackAlert(OPTS)
    expect(result).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("calls fetch with correct URL and payload when env var is set", async () => {
    process.env.SLACK_WEBHOOK_URL = SLACK_URL
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    )

    const result = await sendSlackAlert(OPTS)

    expect(result).toBe(true)
    expect(fetchSpy).toHaveBeenCalledOnce()

    const [calledUrl, calledInit] = fetchSpy.mock.calls[0]!
    expect(calledUrl).toBe(SLACK_URL)
    expect((calledInit as RequestInit).method).toBe("POST")
    expect((calledInit as RequestInit).headers).toMatchObject({
      "Content-Type": "application/json",
    })

    const body = JSON.parse((calledInit as RequestInit).body as string)
    expect(body.text).toContain(OPTS.contractTitle)
    expect(body.blocks).toBeDefined()
    expect(body.blocks[0].type).toBe("header")
    // Section fields contain all three key pieces of data
    const sectionBlock = body.blocks[1]
    expect(sectionBlock.type).toBe("section")
    const fieldTexts: string[] = sectionBlock.fields.map((f: { text: string }) => f.text)
    expect(fieldTexts.some((t) => t.includes(OPTS.contractTitle))).toBe(true)
    expect(fieldTexts.some((t) => t.includes(OPTS.counterpartyName!))).toBe(true)
    expect(fieldTexts.some((t) => t.includes(String(OPTS.daysUntilExpiry)))).toBe(true)
    // Action button links to the correct contract URL
    const actionsBlock = body.blocks[2]
    expect(actionsBlock.elements[0].url).toBe(
      `${OPTS.appUrl}/contracts/${OPTS.contractId}`,
    )
  })

  it("returns false (does not throw) when fetch throws", async () => {
    process.env.SLACK_WEBHOOK_URL = SLACK_URL
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"))

    await expect(sendSlackAlert(OPTS)).resolves.toBe(false)
  })

  it("returns false when fetch returns a non-2xx status", async () => {
    process.env.SLACK_WEBHOOK_URL = SLACK_URL
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Bad Request", { status: 400 }),
    )

    const result = await sendSlackAlert(OPTS)
    expect(result).toBe(false)
  })

  it("uses 'Unknown' when counterpartyName is null", async () => {
    process.env.SLACK_WEBHOOK_URL = SLACK_URL
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    )

    await sendSlackAlert({ ...OPTS, counterpartyName: null })

    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string)
    const sectionBlock = body.blocks[1]
    const fieldTexts: string[] = sectionBlock.fields.map((f: { text: string }) => f.text)
    expect(fieldTexts.some((t) => t.includes("Unknown"))).toBe(true)
  })
})

// ─── sendTeamsAlert ───────────────────────────────────────────────────────────

describe("sendTeamsAlert", () => {
  it("returns false immediately when TEAMS_WEBHOOK_URL is not set — no fetch call", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const result = await sendTeamsAlert(OPTS)
    expect(result).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("calls fetch with correct Teams Adaptive Card payload when env var is set", async () => {
    process.env.TEAMS_WEBHOOK_URL = TEAMS_URL
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    )

    const result = await sendTeamsAlert(OPTS)

    expect(result).toBe(true)
    expect(fetchSpy).toHaveBeenCalledOnce()

    const [calledUrl, calledInit] = fetchSpy.mock.calls[0]!
    expect(calledUrl).toBe(TEAMS_URL)
    expect((calledInit as RequestInit).method).toBe("POST")

    const body = JSON.parse((calledInit as RequestInit).body as string)
    // Top-level Teams message structure
    expect(body.type).toBe("message")
    expect(body.attachments).toHaveLength(1)

    const attachment = body.attachments[0]
    expect(attachment.contentType).toBe("application/vnd.microsoft.card.adaptive")

    const card = attachment.content
    expect(card.type).toBe("AdaptiveCard")
    expect(card.version).toBe("1.4")

    // FactSet should contain all required data
    const factSet = card.body.find((b: { type: string }) => b.type === "FactSet")!
    expect(factSet).toBeDefined()
    const factValues: string[] = factSet.facts.map((f: { value: string }) => f.value)
    expect(factValues).toContain(OPTS.contractTitle)
    expect(factValues).toContain(OPTS.counterpartyName)
    expect(factValues.some((v) => v.includes(String(OPTS.daysUntilExpiry)))).toBe(true)

    // Action button links to the correct contract URL
    const action = card.actions[0]
    expect(action.type).toBe("Action.OpenUrl")
    expect(action.url).toBe(`${OPTS.appUrl}/contracts/${OPTS.contractId}`)
  })

  it("returns false (does not throw) when fetch throws", async () => {
    process.env.TEAMS_WEBHOOK_URL = TEAMS_URL
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"))

    await expect(sendTeamsAlert(OPTS)).resolves.toBe(false)
  })

  it("returns false when fetch returns a non-2xx status", async () => {
    process.env.TEAMS_WEBHOOK_URL = TEAMS_URL
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Service Unavailable", { status: 503 }),
    )

    const result = await sendTeamsAlert(OPTS)
    expect(result).toBe(false)
  })

  it("uses 'Unknown' when counterpartyName is null", async () => {
    process.env.TEAMS_WEBHOOK_URL = TEAMS_URL
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 200 }),
    )

    await sendTeamsAlert({ ...OPTS, counterpartyName: null })

    const body = JSON.parse((fetchSpy.mock.calls[0]![1] as RequestInit).body as string)
    const card = body.attachments[0].content
    const factSet = card.body.find((b: { type: string }) => b.type === "FactSet")!
    const factValues: string[] = factSet.facts.map((f: { value: string }) => f.value)
    expect(factValues).toContain("Unknown")
  })
})

// ─── sendSlackEvent / sendTeamsEvent — delivery-time SSRF revalidation ────────

const EVENT_OPTS = {
  webhookUrl: "https://hooks.slack.com/services/TEST/WEBHOOK",
  eventName: "contract.created",
  contractTitle: "Acme SaaS MSA",
  counterpartyName: "Acme Corp",
  actorName: "Jane Doe",
  contractId: "ctr_abc123",
  appUrl: "https://app.clauseflow.io",
  metadata: {},
}

describe("sendSlackEvent — delivery-time SSRF revalidation", () => {
  it("returns false and never calls fetch when validateWebhookUrl rejects (e.g. DNS-rebound target)", async () => {
    const { validateWebhookUrl } = await import("@/lib/notifications/validate-webhook-url")
    vi.mocked(validateWebhookUrl).mockRejectedValueOnce(
      new Error("Webhook URL resolves to a private or internal IP range"),
    )
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const result = await sendSlackEvent(EVENT_OPTS)

    expect(result).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("proceeds to fetch when validateWebhookUrl resolves", async () => {
    const { validateWebhookUrl } = await import("@/lib/notifications/validate-webhook-url")
    vi.mocked(validateWebhookUrl).mockResolvedValueOnce(undefined)
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }))

    const result = await sendSlackEvent(EVENT_OPTS)

    expect(result).toBe(true)
    expect(fetchSpy).toHaveBeenCalledOnce()
  })
})

describe("sendTeamsEvent — delivery-time SSRF revalidation", () => {
  it("returns false and never calls fetch when validateWebhookUrl rejects (e.g. DNS-rebound target)", async () => {
    const { validateWebhookUrl } = await import("@/lib/notifications/validate-webhook-url")
    vi.mocked(validateWebhookUrl).mockRejectedValueOnce(
      new Error("Webhook URL resolves to a private or internal IP range"),
    )
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    const result = await sendTeamsEvent(EVENT_OPTS)

    expect(result).toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("proceeds to fetch when validateWebhookUrl resolves", async () => {
    const { validateWebhookUrl } = await import("@/lib/notifications/validate-webhook-url")
    vi.mocked(validateWebhookUrl).mockResolvedValueOnce(undefined)
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 200 }))

    const result = await sendTeamsEvent(EVENT_OPTS)

    expect(result).toBe(true)
    expect(fetchSpy).toHaveBeenCalledOnce()
  })
})
