const REQUEST_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/

/** Accept only bounded, log-safe correlation IDs supplied by a trusted proxy. */
export function requestIdFrom(value: string | null | undefined): string {
  return value && REQUEST_ID_PATTERN.test(value) ? value : globalThis.crypto.randomUUID()
}

/**
 * Cookie-authenticated state changes must originate from this deployment.
 * API-key requests are intentionally excluded because they do not rely on a
 * browser cookie and are authenticated by the Authorization header instead.
 */
export function isTrustedMutationOrigin(
  method: string,
  origin: string | null,
  requestOrigin: string,
  hasSessionCookie: boolean,
): boolean {
  if (!hasSessionCookie || !["POST", "PUT", "PATCH", "DELETE"].includes(method)) return true
  if (!origin) return true

  const configured = [process.env.BETTER_AUTH_URL, process.env.NEXT_PUBLIC_APP_URL]
    .filter((value): value is string => Boolean(value))
    .map((value) => {
      try {
        return new URL(value).origin
      } catch {
        return null
      }
    })
    .filter((value): value is string => Boolean(value))

  return [...configured, requestOrigin].includes(origin)
}

export function applySecurityHeaders<T extends Headers>(headers: T): T {
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("X-Frame-Options", "DENY")
  headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
  headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  headers.set("Cross-Origin-Opener-Policy", "same-origin")
  headers.set("Cross-Origin-Resource-Policy", "same-origin")
  return headers
}
