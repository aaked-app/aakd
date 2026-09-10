import { z } from "zod"

import { resolveAuth } from "@/lib/auth/middleware"
import { waitForInteractiveAiRequest } from "@/lib/jobs/interactive-ai-client"

export const maxDuration = 300

const ParamsSchema = z.object({ jobId: z.string().uuid() })

export async function GET(req: Request, { params }: { params: AsyncRouteParams<{ jobId: string }> }) {
  const ctx = await resolveAuth(req)
  if (!ctx) return new Response("Unauthorized", { status: 401 })
  const parsed = ParamsSchema.safeParse(await params)
  if (!parsed.success) return Response.json({ error: "Not Found" }, { status: 404 })
  const submission = await waitForInteractiveAiRequest(ctx, parsed.data.jobId)
  if (!submission) return Response.json({ error: "Not Found" }, { status: 404 })
  if (submission.state === "pending") return Response.json({ status: "pending", jobId: submission.jobId }, { status: 202 })
  if (submission.state === "failed") return Response.json({ error: "AI call failed" }, { status: 503 })
  return Response.json(submission.response.body, { status: submission.response.status })
}
