import type { MetadataRoute } from "next"

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://aakd.app",
      changeFrequency: "weekly",
      priority: 1,
    },
  ]
}
