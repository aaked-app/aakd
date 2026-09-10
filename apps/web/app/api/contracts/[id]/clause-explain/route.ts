import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

import { hasAgreementAccess } from "@/lib/auth/agreement-access"
import { resolveAuth } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { enqueueInteractiveAiRequest } from "@/lib/jobs/interactive-ai-client"

export const maxDuration = 300
const ClauseExplainSchema = z.object({ text: z.string().trim().min(1).max(3000) })

export async function POST(req: NextRequest, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params
  const ctx = await resolveAuth(req)
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 })
  if (ctx.source === "api_key" && !ctx.scopes?.includes("text_read")) {
    return NextResponse.json({ error: "text_read scope required" }, { status: 403 })
  }
  let body: unknown
  try { body = await req.json() } catch { return NextResponse.json({ error: "invalid_json" }, { status: 400 }) }
  const parsed = ClauseExplainSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: "invalid_text" }, { status: 400 })
  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, params.id))) return NextResponse.json({ error: "not_found" }, { status: 404 })
    const contract = await prisma.contract.findUnique({ where: { id: params.id }, select: { id: true, organizationId: true } })
    if (!contract || contract.organizationId !== ctx.organizationId) return NextResponse.json({ error: "not_found" }, { status: 404 })
    let submission
    try {
      submission = await enqueueInteractiveAiRequest(ctx, "clause_explanation", params.id, {
        operation: "clause_explanation",
        clauseText: parsed.data.text,
      }, 35_000)
    } catch {
      return NextResponse.json({ error: "ai_call_failed" }, { status: 503 })
    }
    if (submission.state === "pending") return NextResponse.json({ status: "pending", jobId: submission.jobId }, { status: 202 })
    if (submission.state === "failed") return NextResponse.json({ error: "ai_call_failed" }, { status: 503 })
    return NextResponse.json(submission.response.body, { status: submission.response.status })
  })
}
