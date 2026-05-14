/**
 * Secure response headers for API routes.
 *
 * Caddy already sets HSTS, Referrer-Policy, etc. at the proxy level.
 * These headers are defense-in-depth for non-Caddy deployments (local dev,
 * direct container access, etc.).
 *
 * Usage:
 *   return Response.json(data, { headers: SECURE_HEADERS })
 */
export const SECURE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store",
} as const
