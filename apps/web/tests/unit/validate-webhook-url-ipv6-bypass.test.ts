/**
 * Regression tests for the IPv6 bracket-literal / IPv4-mapped SSRF bypass
 * (security review blocker, 2026-07-17).
 *
 * `checkUrlAgainstRanges` used `net.isIP(hostname)` to detect literal IPs,
 * but `new URL(...).hostname` returns bracketed IPv6 (e.g. "[::1]"), and
 * `net.isIP("[::1]")` returns 0 — so bracketed literals fell through to the
 * DNS-resolution branch, `dns.resolve4/6("[::1]")` threw ENOTFOUND, and that
 * was swallowed as "DNS failed → allow". Every IPv6 rule in both blocklists
 * was dead code for literal URL inputs as a result.
 *
 * These four URLs (reproduced live in review) must be rejected by BOTH
 * validateWebhookUrl and validateOllamaTestUrl — none of them is an
 * RFC-1918 LAN address, so neither validator's self-host allowance applies.
 */
import { describe, it, expect } from "vitest"
import { validateWebhookUrl, validateOllamaTestUrl } from "@/lib/notifications/validate-webhook-url"

const BYPASS_URLS = [
  "http://[::1]:6379/",
  "http://[fe80::1]/",
  "http://[fc00::1]/",
  "http://[::ffff:169.254.169.254]/latest/meta-data/",
]

describe.each([
  ["validateWebhookUrl", validateWebhookUrl],
  ["validateOllamaTestUrl", validateOllamaTestUrl],
])("%s — IPv6 bracket-literal / IPv4-mapped bypass", (_name, validate) => {
  it.each(BYPASS_URLS)("rejects %s", async (url) => {
    await expect(validate(url)).rejects.toThrow()
  })
})

describe("validateOllamaTestUrl — self-host RFC-1918 still allowed through IPv4-mapped IPv6 form", () => {
  it("allows an IPv4-mapped RFC-1918 address (::ffff:192.168.1.10)", async () => {
    await expect(validateOllamaTestUrl("http://[::ffff:192.168.1.10]:11434/")).resolves.toBeUndefined()
  })
})

describe("validateWebhookUrl — IPv4-mapped RFC-1918 address is still blocked (unlike Ollama)", () => {
  it("rejects an IPv4-mapped RFC-1918 address (::ffff:10.0.0.5)", async () => {
    await expect(validateWebhookUrl("http://[::ffff:10.0.0.5]/")).rejects.toThrow()
  })
})
