import { validatedOllamaFetch, OllamaEndpointError } from "@/lib/ai/ollama-fetch"
import { boundedAiFetch } from "@/lib/ai/provider-fetch"
import { readBoundedResponseBody } from "@/lib/import/bounded-response"

type ConfigTestInput = {
  provider: "anthropic" | "openai" | "ollama"
  credential: string
  model: string | null
}

function cloudProviderError(provider: "anthropic" | "openai", status: number): string {
  const name = provider === "anthropic" ? "Anthropic" : "OpenAI"
  if (status === 401) return "Invalid API key"
  if (status === 403) return `${name} API key lacks access to the selected model.`
  if (status === 429) return `${name} rate limit or quota exceeded. Try again later or check your provider account.`
  if (status >= 500) return `${name} is temporarily unavailable (HTTP ${status}). Try again later.`
  return `${name} rejected the test request. Check the selected model and account access.`
}

export async function testAiProviderConnection(input: ConfigTestInput): Promise<{ valid: boolean; error?: string }> {
  if (input.provider === "ollama") {
    let tagsUrl: string
    try {
      tagsUrl = new URL("/api/tags", input.credential).toString()
    } catch {
      return { valid: false, error: "Invalid Ollama base URL" }
    }
    let response: Response
    try {
      response = await validatedOllamaFetch(tagsUrl, { signal: AbortSignal.timeout(5_000) })
    } catch (error) {
      if (error instanceof OllamaEndpointError) return { valid: false, error: "This Ollama URL is not allowed" }
      throw error
    }
    if (!response.ok) return { valid: false, error: `Ollama server responded with ${response.status}. Check that it is running and reachable.` }
    if (!input.model) return { valid: true }
    const data = (await response.json().catch(() => ({}))) as { models?: Array<{ name?: string; model?: string }> }
    const available = new Set((data.models ?? []).flatMap((item) => [item.name, item.model].filter((value): value is string => Boolean(value))))
    return available.has(input.model)
      ? { valid: true }
      : { valid: false, error: `Ollama model "${input.model}" is not installed` }
  }

  const isAnthropic = input.provider === "anthropic"
  const response = await boundedAiFetch(isAnthropic ? "https://api.anthropic.com/v1/messages" : "https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: isAnthropic
      ? { "Content-Type": "application/json", "x-api-key": input.credential, "anthropic-version": "2023-06-01" }
      : { "Content-Type": "application/json", Authorization: `Bearer ${input.credential}` },
    body: JSON.stringify(isAnthropic
      ? { model: input.model || "claude-haiku-4-5", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }
      : { model: input.model || "gpt-4o-mini", max_tokens: 1, messages: [{ role: "user", content: "hi" }] }),
    signal: AbortSignal.timeout(8_000),
  })
  if (!response.ok) return { valid: false, error: cloudProviderError(input.provider, response.status) }
  try {
    const data = JSON.parse((await readBoundedResponseBody(response, 1024 * 1024)).toString("utf8")) as Record<string, unknown>
    const valid = typeof data.id === "string" && data.id.length > 0
    return valid ? { valid: true } : { valid: false, error: `${isAnthropic ? "Anthropic" : "OpenAI"} returned an invalid response.` }
  } catch {
    return { valid: false, error: `${isAnthropic ? "Anthropic" : "OpenAI"} returned an invalid response.` }
  }
}
