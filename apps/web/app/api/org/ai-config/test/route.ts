import { resolveAuth } from "@/lib/auth/middleware"
import { hasRole } from "@/lib/auth/roles"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { logger } from "@/lib/logger"
import { validateOllamaTestUrl } from "@/lib/notifications/validate-webhook-url"
import { z } from "zod"

const optionalModel = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
)

const TestSchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("anthropic"), apiKey: z.string().min(1), model: optionalModel }),
  z.object({ provider: z.literal("openai"), apiKey: z.string().min(1), model: optionalModel }),
  z.object({ provider: z.literal("ollama"), baseUrl: z.string().url(), model: optionalModel }),
])

export async function POST(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return new Response("Unauthorized", { status: 401 })

  // Admin-only: this endpoint fetches an arbitrary org-supplied Ollama
  // baseUrl. Narrowing the actor set is defense-in-depth for the internal
  // (RFC-1918) ranges validateOllamaTestUrl deliberately still allows, since
  // self-hosted Ollama legitimately runs on a LAN address.
  if (!hasRole(ctx.role, "admin")) {
    return new Response("Forbidden", { status: 403 })
  }

  // Rate limit: 5 requests per minute per org
  const rl = await rateLimit(`${ctx.organizationId}:ai-config-test`, 5, 60_000)
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const parsed = TestSchema.safeParse(body)
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { provider } = parsed.data

  try {
    if (provider === "ollama") {
      const { baseUrl, model } = parsed.data as { provider: "ollama"; baseUrl: string; model?: string }
      let tagsUrl: string
      try {
        tagsUrl = new URL("/api/tags", baseUrl).toString()
      } catch {
        return Response.json({ valid: false, error: "Invalid Ollama base URL" })
      }

      // SSRF guard: block loopback/link-local/metadata targets (never a
      // legitimate Ollama endpoint) while deliberately allowing RFC-1918 —
      // self-hosted Ollama legitimately runs on a LAN address. Resolves the
      // hostname itself, so this also closes the DNS-rebinding window: the
      // address checked here is what `fetch` will actually resolve to next.
      try {
        await validateOllamaTestUrl(tagsUrl)
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        logger.error({ organizationId: ctx.organizationId, reason }, "[ai-config/test] Ollama URL rejected by SSRF guard")
        return Response.json({ valid: false, error: "This Ollama URL is not allowed" }, { status: 400 })
      }

      const res = await fetch(tagsUrl, { signal: AbortSignal.timeout(5_000) })
      if (res.ok) {
        if (!model) return Response.json({ valid: true })
        const data = (await res.json().catch(() => ({}))) as { models?: Array<{ name?: string; model?: string }> }
        const available = new Set((data.models ?? []).flatMap((item) => [item.name, item.model].filter(Boolean)))
        if (!available.has(model)) {
          return Response.json({ valid: false, error: `Ollama model "${model}" is not installed` })
        }
        return Response.json({ valid: true })
      }
      return Response.json({
        valid: false,
        error: `Ollama server responded with ${res.status} — is it running at ${baseUrl}?`,
      })
    }

    const apiKey = (parsed.data as { apiKey: string }).apiKey
    const model = (parsed.data as { model?: string }).model?.trim()

    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: model || "claude-haiku-4-5",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
        signal: AbortSignal.timeout(8_000),
      })

      if (res.ok || res.status === 400) {
        // 400 can happen with model/param issues but still means auth succeeded
        const data = await res.json().catch(() => ({}))
        // If we get an authentication error the key is invalid
        if (res.status === 401 || (data as { error?: { type?: string } }).error?.type === "authentication_error") {
          return Response.json({ valid: false, error: "Invalid API key" })
        }
        return Response.json({ valid: true })
      }

      if (res.status === 401 || res.status === 403) {
        return Response.json({ valid: false, error: "Invalid API key" })
      }

      // Any other error (5xx, rate limit) — key format looks ok, treat as valid
      if (res.status === 429) {
        return Response.json({ valid: true })
      }

      const errText = await res.text().catch(() => "")
      logger.error({ status: res.status, body: errText }, "[ai-config/test] Anthropic API error")
      return Response.json({ valid: false, error: `Anthropic API error ${res.status}` })
    }

    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: model || "gpt-4o-mini",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
        signal: AbortSignal.timeout(8_000),
      })

      if (res.ok) {
        return Response.json({ valid: true })
      }

      if (res.status === 401 || res.status === 403) {
        return Response.json({ valid: false, error: "Invalid API key" })
      }

      // Rate limit from OpenAI still means the key is valid
      if (res.status === 429) {
        return Response.json({ valid: true })
      }

      const errData = await res.json().catch(() => ({}))
      logger.error({ status: res.status, body: errData }, "[ai-config/test] OpenAI API error")
      return Response.json({ valid: false, error: `OpenAI API error ${res.status}` })
    }

    return Response.json({ valid: false, error: "Unsupported provider" }, { status: 400 })
  } catch (err) {
    logger.error({ err }, "[ai-config/test] provider connectivity error")
    return Response.json({ valid: false, error: "Network error — unable to reach provider" })
  }
}
