import type { Metadata } from "next"

import LandingPageClient from "./landing-page-client"

const title = "Aakd | Open-source contract lifecycle management"
const description =
  "Self-hostable contract lifecycle management for agreements, cited review, obligations, renewals, approvals, and governed agent access."

export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    url: "/",
    siteName: "Aakd",
    type: "website",
  },
  twitter: {
    card: "summary",
    title,
    description,
  },
}

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": "https://aakd.app/#website",
      name: "Aakd",
      url: "https://aakd.app",
    },
    {
      "@type": "SoftwareApplication",
      "@id": "https://aakd.app/#software",
      name: "Aakd",
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      description,
      url: "https://aakd.app",
      sameAs: ["https://github.com/aaked-app/aakd"],
      license: "https://www.gnu.org/licenses/agpl-3.0.html",
      featureList: [
        "Source-linked contract facts and obligations",
        "Human review and correction",
        "Assigned actions, deadlines, approvals, and completion evidence",
        "Self-hosted deployment",
      ],
    },
  ],
}

// The client landing page reads the locale cookie in the browser. Keep this
// route dynamic so production builds do not serialize a locale-specific tree.
export const dynamic = "force-dynamic"

export default function LandingPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <LandingPageClient />
    </>
  )
}
