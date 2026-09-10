import Anthropic from "@anthropic-ai/sdk"
import { boundedAiFetch } from "@/lib/ai/provider-fetch"
import { resolveAiConfig } from "@/lib/ai/resolve"
import { QA_SYSTEM_PROMPT } from "@/lib/ai/prompts"
import { validatedOllamaFetch } from "@/lib/ai/ollama-fetch"
import { readBoundedResponseBody } from "@/lib/import/bounded-response"

/** Shared by browser and MCP questions; configuration is always organization-specific. */
export async function answerContractQuestion(
  contractTitle: string,
  contextText: string,
  question: string,
  organizationId: string,
): Promise<string | null> {
  try {
    if (!contextText.trim() || !question.trim()) return null
    const config = await resolveAiConfig(organizationId)
    const userContent = `<contract_title>${contractTitle}</contract_title>\n\nRelevant contract excerpts:\n${contextText}\n\n<user_question>${question}</user_question>`
    let answer: unknown = null
    if (config.provider === "anthropic" && config.apiKey) {
      const client = new Anthropic({ apiKey: config.apiKey, logLevel: "off", fetch: boundedAiFetch })
      const message = await client.messages.create({
        model: config.model ?? "claude-haiku-4-5", max_tokens: 1024,
        system: QA_SYSTEM_PROMPT, messages: [{ role: "user", content: userContent }],
      }, { signal: AbortSignal.timeout(30_000) })
      const block = message.content.find(block => block.type === "text")
      answer = block?.type === "text" ? block.text : null
    } else if (config.provider === "openai" && config.apiKey) {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(30_000),
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
        body: JSON.stringify({ model: config.model ?? "gpt-4o-mini", max_tokens: 1024,
          messages: [{ role: "system", content: QA_SYSTEM_PROMPT }, { role: "user", content: userContent }] }),
      })
      if (!response.ok) throw new Error("Provider rejected request")
      const data = JSON.parse((await readBoundedResponseBody(response, 1024 * 1024)).toString("utf8"))
      answer = data.choices?.[0]?.message?.content
    } else if (config.provider === "ollama") {
      const baseUrl = config.source === "org" ? config.apiKey : process.env.OLLAMA_BASE_URL
      if (!baseUrl) return null
      const endpoint = `${baseUrl.replace(/\/$/, "")}/api/chat`
      const response = await (config.source === "org" ? validatedOllamaFetch : boundedAiFetch)(endpoint, {
        method: "POST", redirect: "error", signal: AbortSignal.timeout(30_000),
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: config.model ?? "llama3", stream: false, options: { num_predict: 1024 },
          messages: [{ role: "system", content: QA_SYSTEM_PROMPT }, { role: "user", content: userContent }] }),
      })
      if (!response.ok) throw new Error("Provider rejected request")
      const data = JSON.parse((await readBoundedResponseBody(response, 1024 * 1024)).toString("utf8"))
      answer = data.message?.content
    }
    if (answer == null) return null
    if (typeof answer !== "string" || answer.length > 16_000) throw new Error("Invalid provider answer")
    return answer.trim() || null
  } catch {
    throw new Error("AI question answering failed")
  }
}
