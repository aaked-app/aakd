import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Routes that don't require authentication
const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/create-org",
  "/api/auth",
]

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Allow public paths and static assets
  const isPublic =
    PUBLIC_PATHS.some((p) => pathname.startsWith(p)) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")

  if (isPublic) return NextResponse.next()

  // Check for Better Auth session cookie
  const sessionToken =
    req.cookies.get("better-auth.session_token")?.value ||
    req.cookies.get("__Secure-better-auth.session_token")?.value

  if (!sessionToken) {
    const loginUrl = new URL("/login", req.url)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
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
