import { resolveAuth } from "@/lib/auth/middleware"
import { hasRole } from "@/lib/auth/roles"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { validateOllamaTestUrl } from "@/lib/notifications/validate-webhook-url"
import { z } from "zod"

const Schema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("anthropic"), apiKey: z.string().min(1) }),
  z.object({ provider: z.literal("openai"), apiKey: z.string().min(1) }),
  z.object({ provider: z.literal("ollama"), baseUrl: z.string().url() }),
])

/** Return provider-discovered model IDs without exposing credentials to the browser. */
export async function POST(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return new Response("Unauthorized", { status: 401 })
  if (!hasRole(ctx.role, "admin")) return new Response("Forbidden", { status: 403 })

  const rl = await rateLimit(`${ctx.organizationId}:ai-models`, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter)

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 })
  }
  const parsed = Schema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })

  try {
    if (parsed.data.provider === "openai") {
      const response = await fetch("https://api.openai.com/v1/models", {
        headers: { Authorization: `Bearer ${parsed.data.apiKey}` },
        signal: AbortSignal.timeout(8_000),
      })
      if (!response.ok) return Response.json({ models: [], error: "Unable to list OpenAI models" }, { status: response.status })
      const data = (await response.json()) as { data?: Array<{ id?: string }> }
      return Response.json({ models: (data.data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)).sort() })
    }

    if (parsed.data.provider === "ollama") {
      const tagsUrl = new URL("/api/tags", parsed.data.baseUrl).toString()
      await validateOllamaTestUrl(tagsUrl)
      const response = await fetch(tagsUrl, { signal: AbortSignal.timeout(8_000) })
      if (!response.ok) return Response.json({ models: [], error: "Unable to list Ollama models" }, { status: response.status })
      const data = (await response.json()) as { models?: Array<{ name?: string; model?: string }> }
      const models = new Set((data.models ?? []).flatMap((item) => [item.name, item.model].filter((value): value is string => Boolean(value))))
      return Response.json({ models: [...models].sort() })
    }

    const response = await fetch("https://api.anthropic.com/v1/models", {
      headers: {
        "x-api-key": parsed.data.apiKey,
        "anthropic-version": "2023-06-01",
      },
      signal: AbortSignal.timeout(8_000),
    })
    if (!response.ok) return Response.json({ models: [], error: "Unable to list Anthropic models" }, { status: response.status })
    const data = (await response.json()) as { data?: Array<{ id?: string }> }
    return Response.json({ models: (data.data ?? []).map((item) => item.id).filter((id): id is string => Boolean(id)).sort() })
  } catch {
    return Response.json({ models: [], error: "Unable to reach the AI provider" }, { status: 502 })
  }
}
