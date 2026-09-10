import { resolveAuth, requireWriteScope } from "@/lib/auth/middleware"
import { hasAgreementAccess } from "@/lib/auth/agreement-access"
import { requireRole } from "@/lib/auth/roles"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { writeActivity } from "@/lib/db/activity"
import { getContractAiExtractQueue, getContractExtractQueue } from "@/lib/jobs/queues"
import { rateLimit, rateLimitResponse } from "@/lib/rate-limit"
import crypto from "node:crypto"
import { hasExactExtractedSourceBinding } from "@/lib/contracts/source-binding"

// ─── POST /api/contracts/[id]/extractions/rerun ───────────────────────────────
// Re-enqueues the AI extraction job for a contract using its stored extracted
// text. Works for any contract that has already been text-extracted (PDF/DOCX
// upload). Does not reset accepted extractions — only overwrites pending/
// rejected ones (same guard as the initial worker run).

export async function POST(req: Request, props: { params: AsyncRouteParams<{ id: string }> }) {
  const params = await props.params;
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })
  const roleError = requireRole(ctx.role, "member")
  if (roleError) return roleError
  const scopeError = requireWriteScope(ctx)
  if (scopeError) return scopeError

  // Rate limit: 10 req/min per org (AI extraction is expensive)
  const rl = await rateLimit(`${ctx.organizationId}:ai-extract`, 10, 60_000)
  if (!rl.allowed) return rateLimitResponse(rl.retryAfter)

  return requestContext.run(ctx, async () => {
    if (!(await hasAgreementAccess(prisma, ctx, params.id))) return Response.json({ error: "Not Found" }, { status: 404 })
    const contract = await prisma.contract.findUnique({
      where: { id: params.id },
      select: {
        id: true,
        organizationId: true,
        extractedText: true,
        extractedSourceFileId: true,
        extractedSourceFileVersion: true,
        extractedSourceHash: true,
        files: {
          where: { isLatest: true },
          select: { id: true, storageKey: true, version: true },
          take: 1,
        },
      },
    })

    if (!contract || contract.organizationId !== ctx.organizationId) {
      return Response.json({ error: "Not Found" }, { status: 404 })
    }

    const latestFile = contract.files?.[0]
    const needsCurrentFileParsing = Boolean(latestFile && !hasExactExtractedSourceBinding(contract, latestFile))
    if (!contract.extractedText || needsCurrentFileParsing) {
      if (latestFile) {
        // Text extraction is deliberately worker-owned. A user can reach this
        // button while the upload pipeline is still processing, so resume that
        // pipeline instead of reporting that the document was never uploaded.
        const jobId = `manual-contract-text:${latestFile.id}:v${latestFile.version}`
        const queue = getContractExtractQueue()
        const existingJob = await queue.getJob(jobId)
        if (existingJob) {
          const state = await existingJob.getState()
          if (["waiting", "active", "delayed", "paused"].includes(state)) {
            return Response.json(
              { queued: true, stage: "text_extraction", message: "The current document is already being prepared." },
              { status: 202 },
            )
          }
          await existingJob.remove().catch(() => undefined)
        }
        await queue.add("extract", {
          contractId: params.id,
          organizationId: ctx.organizationId,
          fileId: latestFile.id,
          storageKey: latestFile.storageKey,
          preserveUserFields: true,
        }, { jobId })
        return Response.json(
          { queued: true, stage: "text_extraction", message: "The current document is being prepared. AI extraction will start when its text is ready." },
          { status: 202 },
        )
      }
      return Response.json(
        { error: "no_text", message: "No extracted text found. Upload a document first." },
        { status: 422 },
      )
    }

    const queue = getContractAiExtractQueue()
    const inFlight = typeof queue.getJobs === "function"
      ? await queue.getJobs(["waiting", "active", "delayed", "paused"], 0, -1)
      : []
    if (inFlight.some((job) => job.data.contractId === params.id)) {
      return Response.json(
        { error: "extraction_in_progress", message: "An AI extraction is already in progress for this contract." },
        { status: 409 },
      )
    }

    const sourceHash = crypto.createHash("sha256").update(contract.extractedText).digest("hex").slice(0, 16)
    const jobId = `manual-ai-extract:${params.id}:${sourceHash}`
    if (typeof queue.getJob === "function") {
      const existingJob = await queue.getJob(jobId)
      if (existingJob) await existingJob.remove().catch(() => undefined)
    }

    await queue.add("ai_extract", {
      contractId: params.id,
      organizationId: ctx.organizationId,
      extractedText: contract.extractedText,
    }, { jobId })

    await writeActivity(
      params.id,
      ctx.userId,
      "METADATA_EXTRACTED",
      "AI extraction re-triggered manually",
    )

    return Response.json({ queued: true })
  })
}
