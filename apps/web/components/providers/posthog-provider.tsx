"use client"

import posthog from "posthog-js"
import type { CaptureResult } from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import { useEffect } from "react"
import { usePathname } from "next/navigation"

const PUBLIC_MARKETING_CTAS = {
  header_create_workspace: { event: "registration_started", destinationClass: "registration" },
  menu_create_workspace: { event: "registration_started", destinationClass: "registration" },
  hero_create_workspace: { event: "registration_started", destinationClass: "registration" },
  final_create_workspace: { event: "registration_started", destinationClass: "registration" },
  hero_view_github: { event: "github_outbound_clicked", destinationClass: "github" },
  final_view_github: { event: "github_outbound_clicked", destinationClass: "github" },
  footer_view_github: { event: "github_outbound_clicked", destinationClass: "github" },
  self_hosting_guide: { event: "self_hosting_guide_opened", destinationClass: "self_hosting" },
  footer_self_hosting: { event: "self_hosting_guide_opened", destinationClass: "self_hosting" },
  footer_api_reference: { event: "github_outbound_clicked", destinationClass: "github" },
  footer_security: { event: "github_outbound_clicked", destinationClass: "github" },
} as const

type PublicMarketingCta = keyof typeof PUBLIC_MARKETING_CTAS
type PublicSourceClass =
  | "google_organic"
  | "bing_organic"
  | "known_ai_referral"
  | "other_referral"
  | "direct_or_unknown"

const PUBLIC_SOURCE_CLASSES = new Set<PublicSourceClass>([
  "google_organic",
  "bing_organic",
  "known_ai_referral",
  "other_referral",
  "direct_or_unknown",
])

const GOOGLE_REFERRERS = new Set(["google.com", "www.google.com", "google.co.uk", "www.google.co.uk"])
const BING_REFERRERS = new Set(["bing.com", "www.bing.com"])
const KNOWN_AI_REFERRERS = new Set([
  "chatgpt.com",
  "perplexity.ai",
  "claude.ai",
  "copilot.microsoft.com",
  "gemini.google.com",
])

let capturedPublicMarketingEvent = false

function isPublicMarketingCta(value: unknown): value is PublicMarketingCta {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(PUBLIC_MARKETING_CTAS, value)
}

function isPublicSourceClass(value: unknown): value is PublicSourceClass {
  return typeof value === "string" && PUBLIC_SOURCE_CLASSES.has(value as PublicSourceClass)
}

export function classifyPublicReferrer(referrer: string): PublicSourceClass {
  if (!referrer) return "direct_or_unknown"

  try {
    const url = new URL(referrer)
    if (url.protocol !== "http:" && url.protocol !== "https:") return "direct_or_unknown"

    const hostname = url.hostname.toLowerCase().replace(/\.$/, "")
    if (!hostname) return "direct_or_unknown"
    if (KNOWN_AI_REFERRERS.has(hostname)) return "known_ai_referral"
    if (GOOGLE_REFERRERS.has(hostname)) return "google_organic"
    if (BING_REFERRERS.has(hostname)) return "bing_organic"
    return "other_referral"
  } catch {
    return "direct_or_unknown"
  }
}

function hasPublicAnalyticsConsent(): boolean {
  try {
    return window.localStorage.getItem("cookie_consent") === "accepted"
  } catch {
    return false
  }
}

export function publicPageviewUrl(origin: string, pathname: string, consent: string | null): string | null {
  if (consent !== "accepted" || pathname !== "/") return null
  return `${origin}/`
}

export function sanitizePublicMarketingEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null

  const { distinct_id, $device_id, $insert_id, $lib, $lib_version, $time } = event.properties

  if (event.event === "$pageview") {
    return {
      uuid: event.uuid,
      event: "$pageview",
      properties: {
        distinct_id,
        $device_id,
        $insert_id,
        $lib,
        $lib_version,
        $time,
        $current_url: "https://aakd.app/",
        $host: "aakd.app",
        $pathname: "/",
      },
    }
  }

  const ctaName = event.properties.cta_name
  if (!isPublicMarketingCta(ctaName)) return null

  const definition = PUBLIC_MARKETING_CTAS[ctaName]
  if (event.event !== definition.event) return null
  const sourceClass = isPublicSourceClass(event.properties.source_class)
    ? event.properties.source_class
    : "direct_or_unknown"

  return {
    uuid: event.uuid,
    event: event.event,
    properties: {
      distinct_id,
      $device_id,
      $insert_id,
      $lib,
      $lib_version,
      $time,
      page_path: "/",
      cta_name: ctaName,
      destination_class: definition.destinationClass,
      source_class: sourceClass,
    },
  }
}

// Backwards-compatible export for existing callers and tests.
export const sanitizePublicPageview = sanitizePublicMarketingEvent

export function resetPublicMarketingEventSession() {
  capturedPublicMarketingEvent = false
}

export function capturePublicMarketingEvent(ctaName: PublicMarketingCta): boolean {
  if (
    !process.env.NEXT_PUBLIC_POSTHOG_KEY ||
    !hasPublicAnalyticsConsent() ||
    window.location.pathname !== "/"
  ) {
    return false
  }

  const definition = PUBLIC_MARKETING_CTAS[ctaName]
  if (capturedPublicMarketingEvent) return false

  try {
    const captured = posthog.capture(definition.event, {
      page_path: "/",
      cta_name: ctaName,
      destination_class: definition.destinationClass,
      source_class: classifyPublicReferrer(document.referrer),
    }, {
      send_instantly: true,
      transport: "sendBeacon",
    })
    if (!captured) return false

    capturedPublicMarketingEvent = true
    return true
  } catch {
    return false
  }
}

function capturePublicPageview(pathname: string) {
  const url = publicPageviewUrl(window.origin, pathname, hasPublicAnalyticsConsent() ? "accepted" : null)
  if (url) {
    posthog.opt_in_capturing()
    posthog.capture("$pageview", { $current_url: url })
  } else {
    posthog.opt_out_capturing()
  }
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
    if (!key) return

    // Public-site analytics are opt-in. A direct visit to an authenticated
    // page has no consent banner, so it must remain opted out by default too.
    posthog.init(key, {
      api_host: host ?? "https://eu.i.posthog.com",
      person_profiles: "identified_only",
      autocapture: false,
      rageclick: false,
      capture_pageview: false,
      capture_pageleave: false,
      capture_performance: false,
      capture_exceptions: false,
      disable_session_recording: true,
      disable_persistence: true,
      disable_surveys: true,
      disable_surveys_automatic_display: true,
      save_referrer: false,
      save_campaign_params: false,
      advanced_disable_flags: true,
      opt_out_capturing_by_default: true,
      before_send: sanitizePublicMarketingEvent,
      loaded: (ph) => ph.opt_out_capturing(),
    })
  }, [])

  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return
    capturePublicPageview(pathname)
  }, [pathname])

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key) return <>{children}</>

  return (
    <PHProvider client={posthog}>
      {children}
    </PHProvider>
  )
}
