import { resolveAuth } from "@/lib/auth/middleware"
import { hasRole } from "@/lib/auth/roles"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { z } from "zod"

const TestSchema = z.object({
  provider: z.enum(["anthropic", "openai"]),
  apiKey: z.string().min(1),
})

export async function POST(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return new Response("Unauthorized", { status: 401 })

  if (!hasRole(ctx.role, "legal")) {
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

  const { provider, apiKey } = parsed.data

  try {
    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
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

      const errText = await res.text().catch(() => "Unknown error")
      return Response.json({ valid: false, error: `Anthropic API error ${res.status}: ${errText}` })
    }

    if (provider === "openai") {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
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
      const errMsg = (errData as { error?: { message?: string } }).error?.message ?? `OpenAI API error ${res.status}`
      return Response.json({ valid: false, error: errMsg })
    }

    return Response.json({ valid: false, error: "Unknown provider" }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Network error"
    return Response.json({ valid: false, error: message })
  }
}
