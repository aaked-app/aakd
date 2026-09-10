import { pinnedProviderFetch, ProviderEndpointError } from "@/lib/security/pinned-provider-fetch"

export class OllamaEndpointError extends Error {
  constructor() { super("Ollama endpoint is not allowed"); this.name = "OllamaEndpointError" }
}

/** Organization-controlled endpoints: validate the address actually used by the socket. */
export async function validatedOllamaFetch(urlString: string, init: RequestInit = {}): Promise<Response> {
  try {
    return await pinnedProviderFetch(urlString, init, {
      privateOrigins: process.env.OLLAMA_PRIVATE_ORIGINS,
      timeoutMs: 30_000,
      connectTimeoutMs: 10_000,
      maxResponseBytes: 1024 * 1024,
    })
  } catch (error) {
    if (error instanceof ProviderEndpointError) throw new OllamaEndpointError()
    throw new Error("Ollama request failed")
  }
}
