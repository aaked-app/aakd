import { NextRequest } from "next/server"
import { describe, expect, it } from "vitest"

import { middleware } from "@/middleware"

function request(path: string) {
  return new NextRequest(`https://aakd.example${path}`)
}

describe("public password recovery routes", () => {
  it.each([
    "/forgot-password",
    "/reset-password?token=reset-token",
    "/robots.txt",
    "/sitemap.xml",
  ])("allows an unauthenticated request to %s", (path) => {
    const response = middleware(request(path))

    expect(response.status).toBe(200)
    expect(response.headers.get("x-middleware-next")).toBe("1")
    expect(response.headers.get("location")).toBeNull()
  })

  it("still redirects an unauthenticated dashboard request to login", () => {
    const response = middleware(request("/dashboard"))

    expect(response.status).toBe(307)
    expect(response.headers.get("location")).toBe(
      "https://aakd.example/login?callbackUrl=%2Fdashboard",
    )
  })

  it.each([
    "/actions",
    "/ai/agents",
    "/analytics",
    "/contracts",
    "/obligations",
    "/onboarding",
    "/renewals",
    "/search",
    "/settings/org",
    "/templates",
  ])("keeps the protected %s path behind authentication", (path) => {
    expect(middleware(request(path)).status).toBe(307)
  })

  it("does not treat a lookalike password-recovery path as public", () => {
    const response = middleware(request("/reset-password-archive"))

    expect(response.status).toBe(307)
  })
})
