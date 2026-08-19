import crypto from "node:crypto"
import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { hasRole } from "@/lib/auth/roles"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import { resolveAiConfig } from "@/lib/ai/resolve"
import { contractRiskScoreQueue, getContractRiskScoreQueue } from "@/lib/jobs/queues"

export async function POST(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError
  if (!hasRole(ctx.role, "legal")) return Response.json({ error: "Forbidden" }, { status: 403 })

  const rl = await rateLimit(`${ctx.organizationId}:risk-score`, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter)

  return requestContext.run(ctx, async () => {
    const contract = await prisma.contract.findFirst({
      where: { id: params.id, organizationId: ctx.organizationId },
      select: { id: true, extractedText: true, organizationId: true },
    })
    if (!contract) return Response.json({ error: "Not found" }, { status: 404 })
    if (!contract.extractedText) {
      return Response.json({ error: "No extracted text — upload and process a document first" }, { status: 400 })
    }

    const aiConfig = await resolveAiConfig(contract.organizationId)
    if (!aiConfig.provider) return Response.json({ error: "No AI provider configured" }, { status: 503 })

    const sourceHash = crypto.createHash("sha256").update(contract.extractedText).digest("hex")
    const job = await contractRiskScoreQueue.add(
      "risk_score",
      {
        contractId: contract.id,
        organizationId: contract.organizationId,
        requestedById: ctx.userId,
        extractedText: contract.extractedText,
        sourceHash,
      },
      { jobId: `risk-${contract.id}-${sourceHash.slice(0, 16)}` },
    )

    return Response.json({ state: "queued", jobId: job.id }, { status: 202 })
  })
}

export async function GET(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  return requestContext.run(ctx, async () => {
    const contract = await prisma.contract.findFirst({
      where: { id: params.id, organizationId: ctx.organizationId },
      select: { riskScore: true, riskScoredAt: true, riskDetails: true },
    })
    if (!contract) return Response.json({ error: "Not found" }, { status: 404 })

    const jobId = new URL(req.url).searchParams.get("jobId")
    if (jobId) {
      const job = await getContractRiskScoreQueue().getJob(jobId)
      // Completed jobs may have been evicted from Redis after their durable
      // contract result was written. Prefer the persisted result in that case.
      if (!job) {
        if (contract.riskScoredAt && contract.riskScore) {
          return Response.json({
            state: "completed",
            riskScore: contract.riskScore,
            riskScoredAt: contract.riskScoredAt,
            riskDetails: contract.riskDetails,
          })
        }
        return Response.json({ state: "not_found" })
      }
      const jobData = job.data as { contractId?: string; organizationId?: string }
      if (jobData.contractId !== params.id || jobData.organizationId !== ctx.organizationId) {
        return Response.json({ state: "not_found" })
      }
      const state = await job.getState()
      if (state === "completed") return Response.json({ state: "completed", ...job.returnvalue })
      if (state === "failed") return Response.json({ state: "failed", reason: job.failedReason })
      return Response.json({ state: "active" })
    }

    return Response.json({
      riskScore: contract.riskScore,
      riskScoredAt: contract.riskScoredAt,
      riskDetails: contract.riskDetails,
    })
  })
}
