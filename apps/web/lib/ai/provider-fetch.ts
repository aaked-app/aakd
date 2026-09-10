import { readBoundedResponseBody } from "@/lib/import/bounded-response"

/** Non-streaming SDK transport: bounded bodies and sanitized upstream failures. */
export const boundedAiFetch: typeof fetch = async (input, init) => {
  try {
    const timeout = AbortSignal.timeout(30_000)
    const signal = init?.signal ? AbortSignal.any([init.signal, timeout]) : timeout
    const response = await fetch(input, { ...init, signal, redirect: "error" })
    if (!response.ok) {
      void response.body?.cancel().catch(() => undefined)
      return Response.json({ error: { message: "AI provider request failed" } }, { status: response.status })
    }
    const body = await readBoundedResponseBody(response, 1024 * 1024)
    if (response.status !== 204) JSON.parse(body.toString("utf8"))
    const headers = new Headers(response.headers)
    headers.delete("content-encoding")
    headers.delete("content-length")
    return new Response(response.status === 204 ? null : new Uint8Array(body), {
      status: response.status, statusText: response.statusText, headers,
    })
  } catch {
    throw new Error("AI provider request failed")
  }
}
