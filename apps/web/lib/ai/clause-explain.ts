import Anthropic from "@anthropic-ai/sdk"
import { z } from "zod"

import { validatedOllamaFetch } from "@/lib/ai/ollama-fetch"
import { boundedAiFetch } from "@/lib/ai/provider-fetch"
import { resolveAiConfig } from "@/lib/ai/resolve"
import { readBoundedResponseBody } from "@/lib/import/bounded-response"

export const ExplainResultSchema = z.object({
  explanation: z.string().trim().min(1).max(4000),
  risk: z.enum(["low", "medium", "high", "unknown"]),
  riskReason: z.string().max(4000).optional(),
  suggestion: z.string().max(4000).optional(),
})
export type ExplainResult = z.infer<typeof ExplainResultSchema>

const EXPLAIN_SYSTEM_PROMPT = `You are a plain-English contract advisor helping non-lawyers understand contract clauses.

When given a contract clause, you must respond with a JSON object (no markdown fences) with exactly these fields:
- "explanation": A 2-3 sentence plain English explanation. No legal jargon. What does this mean practically for the reader?
- "risk": One of "low", "medium", or "high" — how risky is this clause for the party reading it?
- "riskReason": A 1-2 sentence explanation of why you assigned this risk level.
- "suggestion": (optional) A 1-2 sentence suggested alternative wording if the clause is medium or high risk.

Respond ONLY with the JSON object. No preamble, no explanation outside the JSON.`

export async function explainContractClause(clauseText: string, organizationId: string): Promise<ExplainResult | null> {
  const aiConfig = await resolveAiConfig(organizationId)
  const userContent = `Explain this contract clause:\n\n<clause>${clauseText}</clause>`

  if (aiConfig.provider === "anthropic" && aiConfig.apiKey) {
    const anthropic = new Anthropic({ apiKey: aiConfig.apiKey, logLevel: "off", fetch: boundedAiFetch })
    const msg = await anthropic.messages.create({
      model: aiConfig.model ?? "claude-haiku-4-5",
      max_tokens: 512,
      system: EXPLAIN_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userContent }],
    }, { signal: AbortSignal.timeout(30_000) })
    const block = msg.content.find((value) => value.type === "text")
    if (!block || block.type !== "text") return null
    return ExplainResultSchema.parse(JSON.parse(block.text.trim()))
  }

  if (aiConfig.provider === "openai" && aiConfig.apiKey) {
    const res = await boundedAiFetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${aiConfig.apiKey}` },
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
    if (!res.ok) throw new Error(`OpenAI chat API error ${res.status}`)
    const data = JSON.parse((await readBoundedResponseBody(res, 1024 * 1024)).toString("utf8")) as {
      choices?: Array<{ message?: { content?: string | null } }>
    }
    const content = data.choices?.[0]?.message?.content?.trim()
    return content ? ExplainResultSchema.parse(JSON.parse(content)) : null
  }

  if (aiConfig.provider === "ollama") {
    const baseUrl = aiConfig.source === "org" ? aiConfig.apiKey : process.env.OLLAMA_BASE_URL
    if (!baseUrl) return null
    const res = await (aiConfig.source === "org" ? validatedOllamaFetch : boundedAiFetch)(`${baseUrl.replace(/\/$/, "")}/api/chat`, {
      method: "POST",
      signal: AbortSignal.timeout(30_000),
      redirect: "error",
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
    const data = JSON.parse((await readBoundedResponseBody(res, 1024 * 1024)).toString("utf8")) as { message?: { content?: string } }
    const content = data.message?.content?.trim()
    return content ? ExplainResultSchema.parse(JSON.parse(content)) : null
  }

  return null
}
