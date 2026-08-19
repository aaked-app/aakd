import { describe, expect, it } from "vitest"

import robots from "@/app/robots"
import sitemap from "@/app/sitemap"

describe("public discovery routes", () => {
  it("allows the public site while keeping authentication and API paths out of crawls", () => {
    expect(robots()).toEqual({
      rules: {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/actions",
          "/ai",
          "/analytics",
          "/api/",
          "/contracts",
          "/dashboard",
          "/obligations",
          "/onboarding",
          "/renewals",
          "/search",
          "/settings",
          "/templates",
        ],
      },
      sitemap: "https://aakd.app/sitemap.xml",
      host: "https://aakd.app",
    })
  })

  it("excludes every non-public page root from crawler discovery", () => {
    const rules = robots().rules
    const disallow = Array.isArray(rules) ? rules[0]?.disallow : rules.disallow

    expect(disallow).toEqual(expect.arrayContaining([
      "/actions",
      "/ai",
      "/analytics",
      "/contracts",
      "/dashboard",
      "/obligations",
      "/onboarding",
      "/renewals",
      "/search",
      "/settings",
      "/templates",
    ]))
  })

  it("lists only the canonical public landing page", () => {
    expect(sitemap()).toEqual([
      expect.objectContaining({
        url: "https://aakd.app",
        changeFrequency: "weekly",
        priority: 1,
      }),
    ])
  })
})
