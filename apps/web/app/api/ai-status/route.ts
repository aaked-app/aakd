import { resolveAuth } from "@/lib/auth/middleware"
import { prisma } from "@/lib/db/client"

export async function GET(req: Request) {
  const ctx = await resolveAuth(req)
  if (!ctx) return Response.json({ error: "Unauthorized" }, { status: 401 })

  // 1. Check for org-level BYOK config
  const orgConfig = await prisma.orgAiConfig.findUnique({
    where: { organizationId: ctx.organizationId },
    select: { provider: true, model: true },
  })

  if (orgConfig) {
    return Response.json({
      provider: orgConfig.provider,
      model: orgConfig.model,
      hasKey: true,
      source: "org",
    })
  }

  // 2. Fall back to server env vars
  const envProvider = process.env.AI_PROVIDER ?? null
  if (envProvider === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    return Response.json({
      provider: "anthropic",
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5",
      hasKey: true,
      source: "env",
    })
  }
  if (envProvider === "openai" && process.env.OPENAI_API_KEY) {
    return Response.json({
      provider: "openai",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      hasKey: true,
      source: "env",
    })
  }
  if (envProvider === "ollama" && process.env.OLLAMA_BASE_URL) {
    return Response.json({
      provider: "ollama",
      model: process.env.OLLAMA_MODEL ?? "llama3",
      hasKey: true,
      source: "env",
    })
  }

  // Auto-detect
  if (process.env.ANTHROPIC_API_KEY) {
    return Response.json({
      provider: "anthropic",
      model: process.env.ANTHROPIC_MODEL ?? "claude-haiku-4-5",
      hasKey: true,
      source: "env",
    })
  }
  if (process.env.OPENAI_API_KEY) {
    return Response.json({
      provider: "openai",
      model: process.env.OPENAI_MODEL ?? "gpt-4o-mini",
      hasKey: true,
      source: "env",
    })
  }
  if (process.env.OLLAMA_BASE_URL) {
    return Response.json({
      provider: "ollama",
      model: process.env.OLLAMA_MODEL ?? "llama3",
      hasKey: true,
      source: "env",
    })
  }

  return Response.json({ provider: null, model: null, hasKey: false, source: null })
}
