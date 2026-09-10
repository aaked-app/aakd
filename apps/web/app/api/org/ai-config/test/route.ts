import { z } from "zod"

import { resolveAuth } from "@/lib/auth/middleware"
import { hasRole } from "@/lib/auth/roles"
import { enqueueInteractiveAiRequest } from "@/lib/jobs/interactive-ai-client"
import { encrypt } from "@/lib/notifications/crypto"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { validateOllamaTestUrl } from "@/lib/notifications/validate-webhook-url"

const optionalModel = z.preprocess(
  (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().min(1).optional(),
)
const TestSchema = z.discriminatedUnion("provider", [
  z.object({ provider: z.literal("anthropic"), apiKey: z.string().trim().min(1), model: optionalModel }),
  z.object({ provider: z.literal("openai"), apiKey: z.string().trim().min(1), model: optionalModel }),
  z.object({ provider: z.literal("ollama"), baseUrl: z.string().url(), model: optionalModel }),
])

export async function POST(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return new Response("Unauthorized", { status: 401 })
  if (ctx.source !== "session") return Response.json({ error: "human_session_required" }, { status: 403 })
  if (!hasRole(ctx.role, "admin")) return new Response("Forbidden", { status: 403 })
  const rl = await rateLimit(`${ctx.organizationId}:ai-config-test`, 5, 60_000)
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter)
  let body: unknown
  try { body = await req.json() } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }) }
  const parsed = TestSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })
  if (parsed.data.provider === "ollama") {
    try { await validateOllamaTestUrl(parsed.data.baseUrl) }
    catch { return Response.json({ valid: false, error: "This Ollama URL is not allowed" }, { status: 400 }) }
  }
  const credential = parsed.data.provider === "ollama" ? parsed.data.baseUrl : parsed.data.apiKey
  let encryptedCredential: string
  try { encryptedCredential = encrypt(credential) }
  catch { return Response.json({ valid: false, error: "Encryption not configured on this server" }, { status: 500 }) }
  let submission
  try {
    submission = await enqueueInteractiveAiRequest(ctx, "config_test", null, {
      operation: "config_test",
      provider: parsed.data.provider,
      encryptedCredential,
      model: parsed.data.model ?? null,
    }, 12_000)
  } catch {
    return Response.json({ valid: false, error: "Network error — unable to reach provider" })
  }
  if (submission.state === "pending") return Response.json({ status: "pending", jobId: submission.jobId }, { status: 202 })
  if (submission.state === "failed") return Response.json({ valid: false, error: "Network error — unable to reach provider" })
  return Response.json(submission.response.body, { status: submission.response.status })
}
