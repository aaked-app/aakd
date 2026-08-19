import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
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
  }
}
