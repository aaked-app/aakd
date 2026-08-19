"use client"

import posthog from "posthog-js"
import type { CaptureResult } from "posthog-js"
import { PostHogProvider as PHProvider } from "posthog-js/react"
import { useEffect } from "react"
import { usePathname } from "next/navigation"

type PublicMarketingEvent =
  | "marketing_cta_clicked"
  | "github_outbound_clicked"
  | "self_hosting_guide_opened"
  | "registration_started"

const PUBLIC_MARKETING_EVENTS = new Set<PublicMarketingEvent>([
  "marketing_cta_clicked",
  "github_outbound_clicked",
  "self_hosting_guide_opened",
  "registration_started",
])

function safeValue(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-z0-9][a-z0-9._-]{0,79}$/i.test(value) ? value : undefined
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

  if (!PUBLIC_MARKETING_EVENTS.has(event.event as PublicMarketingEvent)) return null

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
      cta_name: safeValue(event.properties.cta_name),
      destination_class: safeValue(event.properties.destination_class),
      referrer_domain: safeValue(event.properties.referrer_domain),
      utm_campaign: safeValue(event.properties.utm_campaign),
    },
  }
}

// Backwards-compatible export for existing callers and tests.
export const sanitizePublicPageview = sanitizePublicMarketingEvent

export function capturePublicMarketingEvent(
  event: PublicMarketingEvent,
  ctaName: string,
  destinationClass: string,
) {
  if (
    !process.env.NEXT_PUBLIC_POSTHOG_KEY ||
    localStorage.getItem("cookie_consent") !== "accepted" ||
    window.location.pathname !== "/"
  ) {
    return
  }

  let referrerDomain: string | undefined
  try {
    referrerDomain = document.referrer ? new URL(document.referrer).hostname : undefined
  } catch {
    referrerDomain = undefined
  }

  const campaign = new URLSearchParams(window.location.search).get("utm_campaign") ?? undefined
  posthog.capture(event, {
    cta_name: ctaName,
    destination_class: destinationClass,
    referrer_domain: referrerDomain,
    utm_campaign: campaign,
  })
}

function capturePublicPageview(pathname: string) {
  const url = publicPageviewUrl(window.origin, pathname, localStorage.getItem("cookie_consent"))
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
