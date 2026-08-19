import { describe, expect, it } from "vitest"

import { publicPageviewUrl, sanitizePublicPageview } from "@/components/providers/posthog-provider"

describe("public analytics pageviews", () => {
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
        distinct_id: "anonymous-id",
        $current_url: "https://aakd.app/?token=secret&search=private",
        $referrer: "https://example.test/?invite=secret",
        utm_campaign: "private-campaign",
      },
    })).toEqual({
      uuid: "event-id",
      event: "$pageview",
      properties: {
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
})
