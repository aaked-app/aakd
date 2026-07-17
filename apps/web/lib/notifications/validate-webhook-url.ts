import dns from "dns/promises"
import net from "net"

// Patterns matching RFC-1918, loopback, link-local, and other reserved ranges
const BLOCKED_IP_RANGES = [
  /^127\./,                          // loopback IPv4
  /^10\./,                           // RFC-1918
  /^172\.(1[6-9]|2[0-9]|3[01])\./,  // RFC-1918
  /^192\.168\./,                     // RFC-1918
  /^169\.254\./,                     // link-local (AWS IMDS / GCP metadata)
  /^0\./,                            // reserved / "this" network
  /^100\.(6[4-9]|[7-9][0-9]|1[01][0-9]|12[0-7])\./, // CGNAT RFC-6598
  /^::1$/,                           // IPv6 loopback
  /^fc00:/i,                         // IPv6 unique local
  /^fd[0-9a-f]{2}:/i,               // IPv6 unique local
  /^fe80:/i,                         // IPv6 link-local
  /^0\.0\.0\.0$/,                    // unspecified
]

// Narrower blocklist for the Ollama connectivity-test endpoint
// (org/ai-config/test). A self-hosted Ollama server legitimately runs on an
// RFC-1918 LAN address (or a Docker service hostname resolving to one) — that
// range must stay reachable. Only reject ranges that are NEVER a legitimate
// Ollama target: loopback, link-local (which covers the cloud metadata IP
// 169.254.169.254), and their IPv6 equivalents.
const NEVER_LEGITIMATE_IP_RANGES = [
  /^127\./,                          // loopback IPv4
  /^169\.254\./,                     // link-local (AWS IMDS / GCP metadata)
  /^::1$/,                           // IPv6 loopback
  /^fc00:/i,                         // IPv6 unique local
  /^fd[0-9a-f]{2}:/i,               // IPv6 unique local
  /^fe80:/i,                         // IPv6 link-local
]

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "0.0.0.0",
  "::1",
  "ip6-localhost",
  "ip6-loopback",
  "metadata.google.internal",        // GCP metadata service
])

// WHATWG URL always normalizes a bracketed IPv6 literal's hostname to its
// canonical bracketed+compressed form (e.g. "[::1]", "[::ffff:a9fe:a9fe]") —
// net.isIP() and our range regexes both expect the unbracketed form.
function stripBrackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname
}

// Matches an IPv4 address embedded inside an IPv6 literal — the two forms
// the URL parser can normalize a literal into:
//   - IPv4-mapped (::ffff:a9fe:a9fe, or pre-normalization ::ffff:169.254.169.254)
//   - NAT64 well-known prefix (64:ff9b::a9fe:a9fe, RFC 6052)
// Without this, an attacker reaches a blocked IPv4 target (e.g. the cloud
// metadata IP) by wrapping it in an IPv6 literal, since the address never
// textually matches an IPv4 regex like /^169\.254\./.
const IPV4_EMBEDDED_HEX_RE = /^(?:::ffff:|64:ff9b::)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i
const IPV4_EMBEDDED_DOTTED_RE = /^(?:::ffff:|64:ff9b::)(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/i

function extractEmbeddedIPv4(ip: string): string | null {
  const dotted = ip.match(IPV4_EMBEDDED_DOTTED_RE)
  if (dotted) return dotted[1]

  const hex = ip.match(IPV4_EMBEDDED_HEX_RE)
  if (hex) {
    const hi = parseInt(hex[1], 16)
    const lo = parseInt(hex[2], 16)
    return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`
  }
  return null
}

function matchesAny(ip: string, ranges: RegExp[]): boolean {
  if (ranges.some((re) => re.test(ip))) return true
  const embedded = extractEmbeddedIPv4(ip)
  return embedded !== null && ranges.some((re) => re.test(embedded))
}

/**
 * Shared core: resolves `urlString`'s hostname (or checks it directly when
 * already a literal IP) and throws if any resolved/literal address matches
 * `blockedRanges`. `resolvedErrorMessage` lets each caller phrase the
 * "resolves to a blocked range" case for its own context.
 */
async function checkUrlAgainstRanges(
  urlString: string,
  blockedRanges: RegExp[],
  resolvedErrorMessage: string,
): Promise<void> {
  let url: URL
  try {
    url = new URL(urlString)
  } catch {
    throw new Error("Invalid URL format")
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("Only http and https URLs are allowed")
  }

  const hostname = stripBrackets(url.hostname.toLowerCase())

  if (BLOCKED_HOSTNAMES.has(hostname)) {
    throw new Error("Private or internal URLs are not allowed")
  }

  // If the hostname is a literal IP address, check it directly.
  // dns.resolve4/6 is designed for hostnames → it returns ENOTFOUND for
  // literal IPs, which the catch block would swallow, leaving the IP unchecked.
  if (net.isIP(hostname) !== 0) {
    if (matchesAny(hostname, blockedRanges)) {
      throw new Error("Private or internal IP addresses are not allowed")
    }
    // Literal public (or, for the narrow blocklist, RFC-1918) IP — nothing
    // else to check.
    return
  }

  // Hostname case: resolve to IPs and verify none are blocked.
  // DNS failure is non-fatal — we let the caller (delivery/test) fail safely
  // rather than blocking on a transient DNS error.
  try {
    const v4Addresses = await dns.resolve4(hostname).catch(() => [] as string[])
    const v6Addresses = await dns.resolve6(hostname).catch(() => [] as string[])
    const allIPs = [...v4Addresses, ...v6Addresses]

    for (const ip of allIPs) {
      if (matchesAny(ip, blockedRanges)) {
        throw new Error(resolvedErrorMessage)
      }
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    // Only re-throw our own validation errors; swallow DNS errors.
    if (
      message.includes("private") ||
      message.includes("internal") ||
      message.includes("not allowed") ||
      message.includes("loopback") ||
      message.includes("link-local")
    ) {
      throw err
    }
    // DNS lookup failed — allow; delivery/test will fail safely.
  }
}

/**
 * Validates a webhook URL to prevent SSRF attacks.
 *
 * Rejects:
 * - Non-http/https protocols
 * - localhost and other loopback hostnames
 * - RFC-1918 private IP ranges
 * - Link-local IPs (AWS IMDS, GCP metadata, etc.)
 * - Literal private IP addresses in the URL (bypasses DNS-only checks)
 *
 * Throws an Error with a user-friendly message when the URL is rejected.
 */
export async function validateWebhookUrl(urlString: string): Promise<void> {
  return checkUrlAgainstRanges(
    urlString,
    BLOCKED_IP_RANGES,
    "Webhook URL resolves to a private or internal IP range",
  )
}

/**
 * Validates the base URL for the Ollama connectivity-test endpoint
 * (org/ai-config/test). Deliberately narrower than validateWebhookUrl: this
 * product is self-hostable, and a self-hosted Ollama server legitimately
 * runs on an RFC-1918 LAN address (e.g. 192.168.1.10, or a Docker service
 * name that resolves to one) — that range must stay reachable. Only rejects
 * targets that are never legitimate here: loopback, link-local (including
 * the cloud metadata IP 169.254.169.254), and their IPv6 equivalents.
 *
 * Throws an Error with a user-friendly message when the URL is rejected.
 */
export async function validateOllamaTestUrl(urlString: string): Promise<void> {
  return checkUrlAgainstRanges(
    urlString,
    NEVER_LEGITIMATE_IP_RANGES,
    "Ollama URL resolves to a loopback or link-local address, which is never a valid target",
  )
}
