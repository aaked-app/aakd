import { createHash } from "node:crypto"
import { resolveAiConfig } from "@/lib/ai/resolve"
import { readBoundedResponseBody } from "@/lib/import/bounded-response"
import { validatedOllamaFetch } from "@/lib/ai/ollama-fetch"
import { boundedAiFetch } from "@/lib/ai/provider-fetch"

export interface GeneratedEmbedding {
  vector: number[]
  /** Exact provider/model space; legacy unqualified model labels are incompatible. */
  model: string
}

const DIMENSIONS = 1536

function validatedVector(value: unknown): number[] {
  if (!Array.isArray(value) || value.length !== DIMENSIONS
    || !value.every(n => typeof n === "number" && Number.isFinite(n) && Math.abs(n) <= 3.4028234663852886e38)
    || !value.some(n => Math.fround(n) !== 0)) throw new Error("Invalid embedding")
  return value
}

/** Organization-selected provider only. Unsupported configurations use lexical retrieval. */
export async function generateEmbedding(text: string, organizationId: string): Promise<GeneratedEmbedding | null> {
  if (!organizationId || !text.trim()) return null
  try {
    const config = await resolveAiConfig(organizationId)
    const input = text.slice(0, 30_000)
    let endpoint: string
    let model: string
    let body: Record<string, unknown>
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (config.provider === "openai" && config.apiKey) {
      endpoint = "https://api.openai.com/v1/embeddings"
      model = "openai:text-embedding-3-small:1536"
      headers.Authorization = `Bearer ${config.apiKey}`
      body = { model: "text-embedding-3-small", input, dimensions: DIMENSIONS }
    } else if (config.provider === "ollama") {
      const baseUrl = config.source === "org" ? config.apiKey : process.env.OLLAMA_BASE_URL
      const embeddingModel = process.env.OLLAMA_EMBEDDING_MODEL?.trim()
      if (!baseUrl || !embeddingModel) return null
      const normalizedBase = new URL(baseUrl).href.replace(/\/$/, "")
      endpoint = `${normalizedBase}/api/embed`
      const destination = createHash("sha256").update(normalizedBase).digest("hex").slice(0, 24)
      model = `ollama:${destination}:${embeddingModel}:1536`
      body = { model: embeddingModel, input, dimensions: DIMENSIONS, truncate: false }
    } else return null

    const request = config.provider === "ollama" && config.source === "org" ? validatedOllamaFetch : boundedAiFetch
    const response = await request(endpoint, {
      method: "POST", headers, body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000), redirect: "error",
    })
    if (!response.ok) throw new Error("Provider rejected embeddings")
    const data = JSON.parse((await readBoundedResponseBody(response, 1024 * 1024)).toString("utf8"))
    const vector = validatedVector(config.provider === "openai" ? data.data?.[0]?.embedding : data.embeddings?.[0])
    return { vector, model }
  } catch {
    throw new Error("Embedding generation failed")
  }
}
