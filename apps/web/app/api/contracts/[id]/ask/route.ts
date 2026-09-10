import { z } from "zod"

import { hasAgreementAccess } from "@/lib/auth/agreement-access"
import { resolveAuth } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { enqueueInteractiveAiRequest } from "@/lib/jobs/interactive-ai-client"
import { captureServerEvent } from "@/lib/posthog-server"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"

export const maxDuration = 300
const AskSchema = z.object({ question: z.string().trim().min(1).max(2000) })

export async function POST(req: Request, { params }: { params: AsyncRouteParams<{ id: string }> }) {
  const ctx = await resolveAuth(req)
  if (!ctx) return new Response("Unauthorized", { status: 401 })
  if (ctx.source === "api_key" && !ctx.scopes?.includes("text_read")) {
    return Response.json({ error: "text_read scope required" }, { status: 403 })
  }
  const rl = await rateLimit(`${ctx.organizationId}:ask`, 20, 60_000)
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter)
  const { id } = await params
  let body: unknown
  try { body = await req.json() } catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }) }
  const parsed = AskSchema.safeParse(body)
  if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 })

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, id))) return Response.json({ error: "Not Found" }, { status: 404 })
    const contract = await prisma.contract.findUnique({
      where: { id },
      select: { id: true, extractedText: true },
    })
    if (!contract) return Response.json({ error: "Contract not found" }, { status: 404 })
    if (!contract.extractedText?.trim()) return Response.json({ error: "No extracted text available for this contract" }, { status: 400 })
    let submission
    try {
      submission = await enqueueInteractiveAiRequest(ctx, "contract_question", id, {
        operation: "contract_question",
        question: parsed.data.question,
      }, 35_000)
    } catch {
      return Response.json({ error: "AI call failed" }, { status: 503 })
    }
    if (submission.state === "pending") return Response.json({ status: "pending", jobId: submission.jobId }, { status: 202 })
    if (submission.state === "failed") return Response.json({ error: "AI call failed" }, { status: 503 })
    if (submission.response.status === 200) {
      captureServerEvent(ctx.userId, "ai_qa_asked", {
        contractId: id,
        organizationId: ctx.organizationId,
        questionLength: parsed.data.question.length,
      })
    }
    return Response.json(submission.response.body, { status: submission.response.status })
  })
}
