/**
 * Delivery-time SSRF revalidation (P2 audit finding 2.5.2 / 3.3).
 *
 * lib/notifications/validate-webhook-url.ts is the SSRF guard called both at
 * webhook registration (org/webhooks POST route) and, as of this fix, again
 * in worker.ts's `notification.deliver` handler immediately before each
 * fetch(webhookUrl) attempt. This closes a DNS-rebinding TOCTOU window: a
 * target that resolved to a public IP at registration time could be
 * repointed at a private/link-local address before delivery.
 *
 * This file isolates the DNS-resolution branch of validateWebhookUrl with a
 * mocked `dns/promises`, so it doesn't depend on real network resolution
 * (unlike the literal-IP and hostname-allowlist cases already covered in
 * worker-handlers.test.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("dns/promises", () => ({
  default: {
    resolve4: vi.fn(),
    resolve6: vi.fn(),
  },
}))

import dns from "dns/promises"
import { validateWebhookUrl } from "@/lib/notifications/validate-webhook-url"

describe("validateWebhookUrl — delivery-time DNS-rebinding revalidation", () => {
  beforeEach(() => {
    vi.mocked(dns.resolve4).mockReset()
    vi.mocked(dns.resolve6).mockReset()
  })

  it("rejects a hostname that now resolves to the cloud metadata IP (169.254.169.254)", async () => {
    // Simulates the attack the delivery-time revalidation closes: the
    // registered target passed validation with a public IP, but its DNS
    // record has since been repointed to a private/link-local address.
    vi.mocked(dns.resolve4).mockResolvedValue(["169.254.169.254"])
    vi.mocked(dns.resolve6).mockResolvedValue([])

    await expect(
      validateWebhookUrl("https://rebindable-target.example.com/hook"),
    ).rejects.toThrow("Webhook URL resolves to a private or internal IP range")
  })

  it("rejects a hostname that now resolves to an RFC-1918 address", async () => {
    vi.mocked(dns.resolve4).mockResolvedValue(["10.0.0.5"])
    vi.mocked(dns.resolve6).mockResolvedValue([])

    await expect(
      validateWebhookUrl("https://rebindable-target.example.com/hook"),
    ).rejects.toThrow("Webhook URL resolves to a private or internal IP range")
  })

  it("still allows a hostname that resolves only to public IPs", async () => {
    vi.mocked(dns.resolve4).mockResolvedValue(["93.184.216.34"])
    vi.mocked(dns.resolve6).mockResolvedValue([])

    await expect(
      validateWebhookUrl("https://still-public.example.com/hook"),
    ).resolves.toBeUndefined()
  })
})
