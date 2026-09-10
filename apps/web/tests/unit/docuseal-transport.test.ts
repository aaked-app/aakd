// @vitest-environment node
import { createServer } from "node:http"
import { once } from "node:events"
import { networkInterfaces } from "node:os"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  fetchDocuSealDocument,
  getSubmission,
  isAllowedDocuSealUrlFor,
  testDocuSealConnection,
} from "@/lib/docuseal"

function nonLoopbackIPv4(): string {
  const address = Object.values(networkInterfaces()).flat()
    .find(item => item?.family === "IPv4" && !item.internal)?.address
  if (!address) throw new Error("Native DocuSeal transport tests need a non-loopback local IPv4 interface")
  return address
}

async function closeServer(server: ReturnType<typeof createServer>) {
  server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
}

describe("DocuSeal provider transport", () => {
  beforeEach(() => vi.stubEnv("DOCUSEAL_PRIVATE_ORIGINS", ""))
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("denies an organization-controlled private listener before sending its API key", async () => {
    const address = nonLoopbackIPv4()
    let hits = 0
    const server = createServer((_request, response) => { hits++; response.end("should not arrive") })
    server.listen(0, address)
    await once(server, "listening")
    const { port } = server.address() as { port: number }
    try {
      await expect(testDocuSealConnection({ baseUrl: `http://${address}:${port}`, apiKey: "secret-key" }))
        .resolves.toBe(false)
      expect(hits).toBe(0)
    } finally {
      await closeServer(server)
    }
  })

  it("allows only the exact operator-approved private origin and does not follow redirects", async () => {
    const address = nonLoopbackIPv4()
    let hits = 0
    let receivedToken = ""
    const server = createServer((request, response) => {
      hits++
      receivedToken = String(request.headers["x-auth-token"] ?? "")
      response.statusCode = 302
      response.setHeader("Location", "http://169.254.169.254/latest/meta-data")
      response.end()
    })
    server.listen(0, address)
    await once(server, "listening")
    const { port } = server.address() as { port: number }
    vi.stubEnv("DOCUSEAL_PRIVATE_ORIGINS", `http://${address}:${port}`)
    try {
      await expect(testDocuSealConnection({ baseUrl: `http://${address}:${port}`, apiKey: "secret-key" }))
        .resolves.toBe(false)
      expect(hits).toBe(1)
      expect(receivedToken).toBe("secret-key")
      await expect(testDocuSealConnection({ baseUrl: `https://${address}:${port}`, apiKey: "secret-key" }))
        .resolves.toBe(false)
      await expect(testDocuSealConnection({ baseUrl: `http://${address}:${port + 1}`, apiKey: "secret-key" }))
        .resolves.toBe(false)
      expect(hits).toBe(1)
    } finally {
      await closeServer(server)
    }
  })

  it.each([
    "http://user:secret@10.20.30.40:3000",
    "http://10.20.30.40:3000/path",
    "http://10.20.30.40:3000?scope=wide",
    "http://10.20.30.40:3000#fragment",
    "http://10.20.30.40",
    "not-an-origin",
  ])("fails closed when the operator allowlist contains malformed entry %s", async configured => {
    vi.stubEnv("DOCUSEAL_PRIVATE_ORIGINS", configured)
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    await expect(testDocuSealConnection({ baseUrl: "http://10.20.30.40:3000", apiKey: "secret-key" }))
      .resolves.toBe(false)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("requires signed document URLs to match scheme, hostname, and effective port", () => {
    const config = { baseUrl: "https://docuseal.example:8443", apiKey: "secret-key" }
    expect(isAllowedDocuSealUrlFor("https://docuseal.example:8443/signed.pdf?token=ok", config)).toBe(true)
    expect(isAllowedDocuSealUrlFor("http://docuseal.example:8443/signed.pdf", config)).toBe(false)
    expect(isAllowedDocuSealUrlFor("https://docuseal.example:8444/signed.pdf", config)).toBe(false)
    expect(isAllowedDocuSealUrlFor("https://user:secret@docuseal.example:8443/signed.pdf", config)).toBe(false)
    expect(isAllowedDocuSealUrlFor("https://docuseal.example:8443/signed.pdf#fragment", config)).toBe(false)
  })

  it("bounds organization-controlled JSON responses to one MiB without exposing the body", async () => {
    const address = nonLoopbackIPv4()
    const server = createServer((_request, response) => {
      response.setHeader("Content-Type", "application/json")
      response.write(Buffer.alloc(1024 * 1024, 0x61))
      response.end("TOP_SECRET_PROVIDER_BODY")
    })
    server.listen(0, address)
    await once(server, "listening")
    const { port } = server.address() as { port: number }
    vi.stubEnv("DOCUSEAL_PRIVATE_ORIGINS", `http://${address}:${port}`)
    try {
      const error = await getSubmission(42, {
        baseUrl: `http://${address}:${port}`,
        apiKey: "secret-key",
      }).then(() => undefined, reason => reason as Error)
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).not.toContain("TOP_SECRET_PROVIDER_BODY")
    } finally {
      await closeServer(server)
    }
  })

  it("downloads a signed PDF only through the configured exact private origin", async () => {
    const address = nonLoopbackIPv4()
    const server = createServer((_request, response) => {
      response.setHeader("Content-Type", "application/pdf")
      response.end("%PDF-1.7\nsynthetic")
    })
    server.listen(0, address)
    await once(server, "listening")
    const { port } = server.address() as { port: number }
    const config = { baseUrl: `http://${address}:${port}`, apiKey: "secret-key" }
    vi.stubEnv("DOCUSEAL_PRIVATE_ORIGINS", config.baseUrl)
    try {
      const response = await fetchDocuSealDocument(`${config.baseUrl}/signed.pdf`, config)
      expect(Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString()).toBe("%PDF")
      await expect(fetchDocuSealDocument(`http://${address}:${port + 1}/signed.pdf`, config))
        .rejects.toThrow("Signed document URL rejected")
    } finally {
      await closeServer(server)
    }
  })
})
