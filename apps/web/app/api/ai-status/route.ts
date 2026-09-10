import { resolveAuth } from "@/lib/auth/middleware"
import { resolveAiConfig } from "@/lib/ai/resolve"

export async function GET(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  const config = await resolveAiConfig(ctx.organizationId)
  return Response.json({
    provider: config.provider,
    model: config.model,
    hasKey: config.provider !== null,
    source: config.source,
  })
}
