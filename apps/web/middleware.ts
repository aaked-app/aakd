import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { LOCALES, DEFAULT_LOCALE } from "@/lib/i18n/config"
import { applySecurityHeaders, isTrustedMutationOrigin, requestIdFrom } from "@/lib/security/request"

// Routes that don't require authentication
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/create-org",
  "/accept-invitation",
  "/api/auth",
  "/api/health",
  "/api/webhooks",
  "/api/user/unsubscribe",
]

// Locale resolution is cookie-based with no URL prefix — `i18n.ts` reads the
// `NEXT_LOCALE` cookie at request time. This middleware ensures a default
// cookie exists so first-time visitors see English instead of an empty value
// hitting the messages loader.
function ensureLocaleCookie(req: NextRequest, res: NextResponse) {
  const current = req.cookies.get("NEXT_LOCALE")?.value
  if (current && (LOCALES as readonly string[]).includes(current)) return res
  res.cookies.set("NEXT_LOCALE", DEFAULT_LOCALE, {
    path: "/",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
  })
  return res
}

function finalize(req: NextRequest, res: NextResponse, requestId: string) {
  applySecurityHeaders(res.headers)
  res.headers.set("x-request-id", requestId)
  res.headers.append("Vary", "Cookie")
  if (req.nextUrl.pathname.startsWith("/api/") || req.cookies.has("better-auth.session_token") || req.cookies.has("__Secure-better-auth.session_token")) {
    res.headers.set("Cache-Control", "no-store")
  }
  return res
}

export function middleware(req: NextRequest) {
  // Propagate or generate a request ID for log correlation
  const requestId = requestIdFrom(req.headers.get("x-request-id"))

  const { pathname } = req.nextUrl

  // Allow public paths and static assets
  const isPublic =
    pathname === "/" ||
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")

  if (isPublic) {
    return finalize(req, ensureLocaleCookie(req, NextResponse.next()), requestId)
  }

  // Allow API routes that carry a Bearer token — the route handler's
  // resolveAuth() will validate the key. Without this check, requests
  // with a valid cf_live_ token but no session cookie are redirected to
  // /login before the route handler ever runs, making API key auth dead.
  const authHeader = req.headers.get("Authorization")
  if (pathname.startsWith("/api/") && authHeader?.startsWith("Bearer ")) {
    return finalize(req, ensureLocaleCookie(req, NextResponse.next()), requestId)
  }

  // Check for Better Auth session cookie
  const sessionToken =
    req.cookies.get("better-auth.session_token")?.value ||
    req.cookies.get("__Secure-better-auth.session_token")?.value

  if (!isTrustedMutationOrigin(req.method, req.headers.get("origin"), req.nextUrl.origin, Boolean(sessionToken))) {
    return finalize(req, ensureLocaleCookie(req, NextResponse.json({ error: "Cross-origin request rejected" }, { status: 403 })), requestId)
  }

  if (!sessionToken) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return finalize(req, ensureLocaleCookie(req, NextResponse.redirect(loginUrl)), requestId)
  }

  return finalize(req, ensureLocaleCookie(req, NextResponse.next()), requestId)
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - public folder files
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
