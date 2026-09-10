import dns from "node:dns/promises"
import net from "node:net"
import { Agent, buildConnector } from "undici"
import {
  assertProviderConnectionAddress,
  isPrivateProviderOriginAllowed,
} from "@/lib/notifications/validate-webhook-url"
import { readBoundedResponseBody } from "@/lib/import/bounded-response"

export type PinnedProviderFetchOptions = {
  privateOrigins?: string
  timeoutMs: number
  connectTimeoutMs: number
  maxResponseBytes: number
}

export class ProviderEndpointError extends Error {
  constructor() {
    super("Provider endpoint is not allowed")
    this.name = "ProviderEndpointError"
  }
}

export async function pinnedProviderFetch(
  urlString: string,
  init: RequestInit,
  policy: PinnedProviderFetchOptions,
): Promise<Response> {
  let url: URL
  let allowPrivate = false
  try {
    url = new URL(urlString)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash) throw new Error()
    allowPrivate = isPrivateProviderOriginAllowed(url, policy.privateOrigins)
    const hostname = url.hostname.replace(/^\[|\]$/g, "")
    if (net.isIP(hostname)) assertProviderConnectionAddress(hostname, allowPrivate)
  } catch {
    throw new ProviderEndpointError()
  }

  const timeout = AbortSignal.timeout(policy.timeoutMs)
  const signal = init.signal ? AbortSignal.any([init.signal, timeout]) : timeout
  const connector = buildConnector({ timeout: policy.connectTimeoutMs })
  const dispatcher = new Agent({
    connections: 1,
    connect(options, callback) {
      const target = options.hostname.replace(/^\[|\]$/g, "")
      const addresses = net.isIP(target)
        ? Promise.resolve([{ address: target, family: net.isIP(target) }])
        : dns.lookup(target, { all: true, verbatim: true })
      void addresses.then(resolved => {
        if (signal.aborted || !resolved.length) throw new Error("Provider connection unavailable")
        for (const entry of resolved) assertProviderConnectionAddress(entry.address, allowPrivate)
        connector({
          ...options,
          hostname: resolved[0].address,
          servername: options.servername || (net.isIP(target) ? undefined : target),
        }, callback)
      }).catch(() => callback(new Error("Provider connection unavailable"), null))
    },
  })

  try {
    const options: RequestInit & { dispatcher: Agent } = {
      ...init,
      signal,
      redirect: "error",
      dispatcher,
    }
    const response = await fetch(url.href, options)
    const body = await readBoundedResponseBody(response, policy.maxResponseBytes)
    const headers = new Headers(response.headers)
    headers.delete("content-encoding")
    headers.delete("content-length")
    return new Response(response.status === 204 ? null : new Uint8Array(body), {
      status: response.status,
      headers,
    })
  } finally {
    await dispatcher.destroy()
  }
}
