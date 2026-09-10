import { z } from "zod"

import { resolveAuth } from "@/lib/auth/middleware"
import { enqueueInteractiveAiRequest } from "@/lib/jobs/interactive-ai-client"
import { logger } from "@/lib/logger"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"

const SemanticSearchSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  limit: z.number().int().min(1).max(50).default(10),
  threshold: z.number().min(0).max(1).default(0.3),
})

export async function POST(req: Request) {
  try {
    const ctx = await resolveAuth(req)
    if (!ctx) return new Response("Unauthorized", { status: 401 })
    let rl: Awaited<ReturnType<typeof rateLimit>>
    try { rl = await rateLimit(`${ctx.organizationId}:semantic-search`, 30, 60_000) }
    catch (error) {
      logger.error({ errorType: error instanceof Error ? error.name : "UnknownError" }, "[semantic] rate limiter unavailable")
      return Response.json({ error: "Semantic search unavailable" }, { status: 503 })
    }
    if (!rl.allowed) return rateLimitResponse(rl.retryAfter)
    let body: unknown
    try { body = await req.json() } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }) }
    const parsed = SemanticSearchSchema.safeParse(body)
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })
    let submission
    try {
      submission = await enqueueInteractiveAiRequest(ctx, "semantic_search", null, {
        operation: "semantic_search",
        ...parsed.data,
      }, 35_000)
    } catch {
      return Response.json({ error: "Semantic search unavailable" }, { status: 503 })
    }
    if (submission.state === "pending") return Response.json({ status: "pending", jobId: submission.jobId }, { status: 202 })
    if (submission.state === "failed") return Response.json({ error: "Semantic search unavailable" }, { status: 503 })
    return Response.json(submission.response.body, { status: submission.response.status })
  } catch (err) {
    logger.error({ err }, "[semantic-search] unhandled error")
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
