import { NextRequest, NextResponse } from "next/server"
import { resolveAuth } from "@/lib/auth/middleware"
import { requestContext } from "@/lib/context"
import { prisma } from "@/lib/db/client"
import { resolveAiConfig, withAiConfigCache } from "@/lib/ai/resolve"
import { logger } from "@/lib/logger"
import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"

const ClauseExplainSchema = z.object({
  text: z.string().min(1).max(3000),
})

interface ExplainResult {
  explanation: string
  risk: "low" | "medium" | "high" | "unknown"
  riskReason?: string
  suggestion?: string
}

const EXPLAIN_SYSTEM_PROMPT = `You are a plain-English contract advisor helping non-lawyers understand contract clauses.

When given a contract clause, you must respond with a JSON object (no markdown fences) with exactly these fields:
- "explanation": A 2-3 sentence plain English explanation. No legal jargon. What does this mean practically for the reader?
- "risk": One of "low", "medium", or "high" — how risky is this clause for the party reading it?
- "riskReason": A 1-2 sentence explanation of why you assigned this risk level.
- "suggestion": (optional) A 1-2 sentence suggested alternative wording if the clause is medium or high risk.

Respond ONLY with the JSON object. No preamble, no explanation outside the JSON.`

async function callExplainLLM(
  clauseText: string,
  organizationId: string,
): Promise<ExplainResult | null> {
  const aiConfig = await resolveAiConfig(organizationId)

  const userContent = `Explain this contract clause:\n\n<clause>${clauseText}</clause>`

  if (aiConfig.provider === "anthropic" && aiConfig.apiKey) {
    const anthropic = new Anthropic({ apiKey: aiConfig.apiKey })
    const msg = await anthropic.messages.create({
      model: aiConfig.model ?? "claude-haiku-4-5",
      max_tokens: 512,
      system: EXPLAIN_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    })
    const block = msg.content.find((b) => b.type === "text")
    if (!block || block.type !== "text") return null
    try {
      return JSON.parse(block.text.trim()) as ExplainResult
    } catch {
      // If the model didn't return valid JSON, extract what we can
      return {
        explanation: block.text.trim().slice(0, 500),
        risk: "medium",
        riskReason: "Could not parse structured response.",
      }
    }
  }

  if (aiConfig.provider === "openai" && aiConfig.apiKey) {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${aiConfig.apiKey}`,
      },
      body: JSON.stringify({
        model: aiConfig.model ?? "gpt-4o-mini",
        max_tokens: 512,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: EXPLAIN_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text().catch(() => "")
      throw new Error(`OpenAI chat API error ${res.status}: ${text}`)
    }

    const data = (await res.json()) as {
      choices: Array<{ message: { content: string | null } }>
    }
    const content = data.choices[0]?.message.content?.trim()
    if (!content) return null
    try {
      return JSON.parse(content) as ExplainResult
    } catch {
      return {
        explanation: content.slice(0, 500),
        risk: "medium",
        riskReason: "Could not parse structured response.",
      }
    }
  }

  if (aiConfig.provider === "ollama") {
    const baseUrl = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434"
    const res = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: aiConfig.model ?? "llama3",
        stream: false,
        messages: [
          { role: "system", content: EXPLAIN_SYSTEM_PROMPT },
          { role: "user", content: userContent },
        ],
      }),
    })
    if (!res.ok) throw new Error(`Ollama error ${res.status}`)
    const data = (await res.json()) as { message?: { content?: string } }
    const content = data.message?.content?.trim()
    if (!content) return null
    try {
      return JSON.parse(content) as ExplainResult
    } catch {
      return {
        explanation: content.slice(0, 500),
        risk: "medium",
        riskReason: "Could not parse structured response.",
      }
    }
  }

  return null
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const ctx = await resolveAuth(req)
  if (!ctx) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 })
  }

  const parsed = ClauseExplainSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_text" }, { status: 400 })
  }

  return withAiConfigCache(() =>
    requestContext.run(ctx, async () => {
      const contract = await prisma.contract.findUnique({
        where: { id: params.id },
        select: { id: true, organizationId: true },
      })

      if (!contract || contract.organizationId !== ctx.organizationId) {
        return NextResponse.json({ error: "not_found" }, { status: 404 })
      }

      const aiConfig = await resolveAiConfig(ctx.organizationId)
      if (!aiConfig.provider) {
        return NextResponse.json(
          {
            explanation:
              "AI explanation is not configured. Check your AI provider settings.",
            risk: "unknown",
          },
          { status: 200 },
        )
      }

      let result: ExplainResult | null
      try {
        result = await callExplainLLM(parsed.data.text, ctx.organizationId)
      } catch (err) {
        logger.error({ err, contractId: params.id }, "[clause-explain] LLM call failed")
        return NextResponse.json({ error: "ai_call_failed" }, { status: 503 })
      }

      if (!result) {
        return NextResponse.json(
          {
            explanation:
              "AI explanation is not configured. Check your AI provider settings.",
            risk: "unknown",
          },
          { status: 200 },
        )
      }

      return NextResponse.json(result)
    }),
  )
}
