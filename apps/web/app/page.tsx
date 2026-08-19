import type { Metadata } from "next"

import LandingPageClient from "./landing-page-client"

const title = "Aakd | Open-source contract lifecycle management"
const description =
  "Self-hostable contract lifecycle management for agreements, cited review, obligations, renewals, approvals, and governed agent access."

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
  },
}

// The client landing page reads the locale cookie in the browser. Keep this
// route dynamic so production builds do not serialize a locale-specific tree.
export const dynamic = "force-dynamic"

export default function LandingPage() {
  return <LandingPageClient />
}
