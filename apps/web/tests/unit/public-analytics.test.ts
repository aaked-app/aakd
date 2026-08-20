import posthog from "posthog-js"
import fc from "fast-check"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  capturePublicMarketingEvent,
  classifyPublicReferrer,
  publicPageviewUrl,
  resetPublicMarketingEventSession,
  sanitizePublicPageview,
} from "@/components/providers/posthog-provider"

describe("public analytics pageviews", () => {
  const capturedEvent = {
    uuid: "captured-event",
    event: "test-event",
    properties: {},
  }

  beforeEach(() => {
    const values = new Map<string, string>()
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        clear: () => values.clear(),
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => values.delete(key),
        setItem: (key: string, value: string) => values.set(key, value),
      },
    })
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "",
    })
    resetPublicMarketingEventSession()
    window.localStorage.clear()
    window.history.replaceState({}, "", "/")
    vi.stubEnv("NEXT_PUBLIC_POSTHOG_KEY", "test-public-key")
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
  })

  it("captures only the consented public homepage without query parameters", () => {
    expect(publicPageviewUrl("https://aakd.app", "/", "accepted")).toBe("https://aakd.app/")
  })

  it("does not capture authentication, invitation, or private workspace URLs", () => {
    expect(publicPageviewUrl("https://aakd.app", "/reset-password", "accepted")).toBeNull()
    expect(publicPageviewUrl("https://aakd.app", "/accept-invitation", "accepted")).toBeNull()
    expect(publicPageviewUrl("https://aakd.app", "/contracts/contract-secret", "accepted")).toBeNull()
  })

  it("does not capture until consent has been accepted", () => {
    expect(publicPageviewUrl("https://aakd.app", "/", null)).toBeNull()
    expect(publicPageviewUrl("https://aakd.app", "/", "declined")).toBeNull()
  })

  it("allows only a sanitized public pageview through the analytics client", () => {
    expect(sanitizePublicPageview({
      uuid: "event-id",
      event: "$pageview",
      properties: {
        token: "test-public-key",
        distinct_id: "anonymous-id",
        $current_url: "https://aakd.app/?token=secret&search=private",
        $referrer: "https://example.test/?invite=secret",
        utm_campaign: "private-campaign",
      },
    })).toEqual({
      uuid: "event-id",
      event: "$pageview",
      properties: {
        token: "test-public-key",
        distinct_id: "anonymous-id",
        $device_id: undefined,
        $insert_id: undefined,
        $lib: undefined,
        $lib_version: undefined,
        $time: undefined,
        $current_url: "https://aakd.app/",
        $host: "aakd.app",
        $pathname: "/",
      },
    })
    expect(sanitizePublicPageview({ uuid: "event-id", event: "$autocapture", properties: {} })).toBeNull()
  })

  it("allows only named public CTA events and removes unsafe dimensions", () => {
    expect(sanitizePublicPageview({
      uuid: "event-id",
      event: "github_outbound_clicked",
      properties: {
        token: "test-public-key",
        distinct_id: "anonymous-id",
        cta_name: "hero_view_github",
        destination_class: "github",
        referrer_domain: "www.google.com",
        utm_campaign: "summer_launch",
        source_class: "google_organic",
        contract_text: "must never leave the browser",
        $current_url: "https://aakd.app/?token=secret",
      },
    })).toEqual({
      uuid: "event-id",
      event: "github_outbound_clicked",
      properties: {
        token: "test-public-key",
        distinct_id: "anonymous-id",
        $device_id: undefined,
        $insert_id: undefined,
        $lib: undefined,
        $lib_version: undefined,
        $time: undefined,
        page_path: "/",
        cta_name: "hero_view_github",
        destination_class: "github",
        source_class: "google_organic",
      },
    })

    expect(sanitizePublicPageview({
      uuid: "event-id",
      event: "unapproved_event",
      properties: { token: "test-public-key" },
    })).toBeNull()

    expect(sanitizePublicPageview({
      uuid: "event-id",
      event: "github_outbound_clicked",
      properties: {
        token: "different-project-key",
        cta_name: "hero_view_github",
      },
    })).toBeNull()
  })

  it("emits only the first accepted homepage CTA in a runtime with immediate beacon delivery", () => {
    window.localStorage.setItem("cookie_consent", "accepted")
    const capture = vi.spyOn(posthog, "capture").mockReturnValue(capturedEvent)

    expect(capturePublicMarketingEvent("hero_view_github")).toBe(true)
    expect(capturePublicMarketingEvent("footer_view_github")).toBe(false)
    expect(capturePublicMarketingEvent("self_hosting_guide")).toBe(false)

    expect(capture).toHaveBeenNthCalledWith(
      1,
      "github_outbound_clicked",
      {
        page_path: "/",
        cta_name: "hero_view_github",
        destination_class: "github",
        source_class: "direct_or_unknown",
      },
      { send_instantly: true, transport: "sendBeacon" },
    )
    expect(capture).toHaveBeenCalledTimes(1)
  })

  it("classifies only reviewed referrer hostname boundaries without transmitting the hostname", () => {
    expect(classifyPublicReferrer("https://www.google.com/search?q=aakd")).toBe("google_organic")
    expect(classifyPublicReferrer("https://google.co.uk/search?q=aakd")).toBe("google_organic")
    expect(classifyPublicReferrer("https://www.bing.com/search?q=aakd")).toBe("bing_organic")
    expect(classifyPublicReferrer("https://chatgpt.com/c/secret")).toBe("known_ai_referral")
    expect(classifyPublicReferrer("https://gemini.google.com/app/secret")).toBe("known_ai_referral")
    expect(classifyPublicReferrer("https://evilgoogle.com/")).toBe("other_referral")
    expect(classifyPublicReferrer("https://chatgpt.com.evil/")).toBe("other_referral")
    expect(classifyPublicReferrer("https://mail.google.com/")).toBe("other_referral")
    expect(classifyPublicReferrer("https://docs.google.com/")).toBe("other_referral")
    expect(classifyPublicReferrer("https://maps.bing.com/")).toBe("other_referral")
    expect(classifyPublicReferrer("https://help.chatgpt.com/")).toBe("other_referral")
    expect(classifyPublicReferrer("")).toBe("direct_or_unknown")
    expect(classifyPublicReferrer("not a URL")).toBe("direct_or_unknown")
    expect(classifyPublicReferrer("mailto:person@example.com")).toBe("direct_or_unknown")
  })

  it("maps arbitrary and oversized referrer input to only a fixed source class", () => {
    const allowed = new Set([
      "google_organic",
      "bing_organic",
      "known_ai_referral",
      "other_referral",
      "direct_or_unknown",
    ])

    fc.assert(fc.property(fc.string({ maxLength: 20_000 }), (referrer) => {
      expect(allowed.has(classifyPublicReferrer(referrer))).toBe(true)
    }))
  })

  it("emits only the fixed source class derived from a reviewed referrer", () => {
    Object.defineProperty(document, "referrer", {
      configurable: true,
      value: "https://www.google.com/search?q=private-query",
    })
    window.localStorage.setItem("cookie_consent", "accepted")
    const capture = vi.spyOn(posthog, "capture").mockReturnValue(capturedEvent)

    expect(capturePublicMarketingEvent("hero_create_workspace")).toBe(true)
    expect(capture).toHaveBeenCalledWith(
      "registration_started",
      {
        page_path: "/",
        cta_name: "hero_create_workspace",
        destination_class: "registration",
        source_class: "google_organic",
      },
      { send_instantly: true, transport: "sendBeacon" },
    )
  })

  it("does not emit CTA events without accepted consent or from a private path", () => {
    const capture = vi.spyOn(posthog, "capture").mockReturnValue(capturedEvent)

    expect(capturePublicMarketingEvent("hero_view_github")).toBe(false)
    window.localStorage.setItem("cookie_consent", "declined")
    expect(capturePublicMarketingEvent("hero_view_github")).toBe(false)

    window.localStorage.setItem("cookie_consent", "accepted")
    window.history.replaceState({}, "", "/contracts/private-contract?utm_campaign=secret")
    expect(capturePublicMarketingEvent("hero_view_github")).toBe(false)
    expect(capture).not.toHaveBeenCalled()
  })

  it("resets only when the in-memory page session is explicitly reset", () => {
    window.localStorage.setItem("cookie_consent", "accepted")
    const capture = vi.spyOn(posthog, "capture").mockReturnValue(capturedEvent)

    expect(capturePublicMarketingEvent("hero_create_workspace")).toBe(true)
    expect(capturePublicMarketingEvent("self_hosting_guide")).toBe(false)

    resetPublicMarketingEventSession()

    expect(capturePublicMarketingEvent("final_create_workspace")).toBe(true)
    expect(capture).toHaveBeenCalledTimes(2)
  })

  it("fails closed when browser storage or the analytics delivery hook fails", () => {
    const capture = vi.spyOn(posthog, "capture")
      .mockImplementationOnce(() => { throw new Error("transport unavailable") })
      .mockReturnValue(capturedEvent)
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get: () => { throw new Error("storage unavailable") },
    })

    expect(capturePublicMarketingEvent("hero_view_github")).toBe(false)
    expect(capture).not.toHaveBeenCalled()

    const values = new Map([["cookie_consent", "accepted"]])
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => values.get(key) ?? null,
      },
    })

    expect(capturePublicMarketingEvent("hero_view_github")).toBe(false)
    expect(capturePublicMarketingEvent("hero_view_github")).toBe(true)
    expect(capture).toHaveBeenCalledTimes(2)
  })
})
