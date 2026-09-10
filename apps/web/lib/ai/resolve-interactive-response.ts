const pendingResponseSchema = {
  parse(value: unknown): string | null {
    if (!value || typeof value !== "object") return null
    const jobId = (value as { jobId?: unknown }).jobId
    return typeof jobId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(jobId)
      ? jobId
      : null
  },
}

const INTERACTIVE_AI_MAX_WAIT_MS = 300_000

/** Continues the same identity-owned job until it reaches a terminal response or its server TTL. */
export async function resolveInteractiveResponse(response: Response, signal?: AbortSignal): Promise<Response> {
  if (response.status !== 202) return response
  const jobId = pendingResponseSchema.parse(await response.clone().json().catch(() => null))
  if (!jobId) return response
  const deadline = Date.now() + INTERACTIVE_AI_MAX_WAIT_MS
  let current = response
  while (current.status === 202 && Date.now() < deadline) {
    if (signal?.aborted) throw signal.reason ?? new DOMException("The operation was aborted", "AbortError")
    current = await fetch(`/api/ai-requests/${encodeURIComponent(jobId)}`, { signal })
    if (current.status !== 202) return current
    const continuedJobId = pendingResponseSchema.parse(await current.clone().json().catch(() => null))
    if (continuedJobId !== jobId) return current
  }
  return Response.json({ error: "AI request timed out" }, { status: 503 })
}
