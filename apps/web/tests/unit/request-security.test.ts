import { describe, expect, it } from "vitest"
import {
  applySecurityHeaders,
  isTrustedMutationOrigin,
  requestIdFrom,
} from "@/lib/security/request"

describe("request security helpers", () => {
  it("replaces malformed correlation ids with a generated id", () => {
    expect(requestIdFrom("bad id\nforged-header")).toMatch(/^[0-9a-f-]{36}$/i)
    expect(requestIdFrom("a".repeat(65))).toMatch(/^[0-9a-f-]{36}$/i)
    expect(requestIdFrom("proxy-request-1")).toBe("proxy-request-1")
  })

  it("rejects cross-origin cookie mutations while allowing API-key requests", () => {
    expect(isTrustedMutationOrigin("POST", "https://evil.example", "https://app.example", true)).toBe(false)
    expect(isTrustedMutationOrigin("POST", "https://evil.example", "https://app.example", false)).toBe(true)
    expect(isTrustedMutationOrigin("GET", "https://evil.example", "https://app.example", true)).toBe(true)
  })

  it("sets the baseline browser security headers", () => {
    const headers = applySecurityHeaders(new Headers())
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(headers.get("X-Frame-Options")).toBe("DENY")
    expect(headers.get("Cross-Origin-Opener-Policy")).toBe("same-origin")
  })
})
