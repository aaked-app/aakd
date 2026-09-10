// @vitest-environment node
import dns from "node:dns/promises"
import { execFile } from "node:child_process"
import { createServer } from "node:http"
import { once } from "node:events"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { networkInterfaces, tmpdir } from "node:os"
import { join } from "node:path"
import { promisify } from "node:util"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { OllamaEndpointError, validatedOllamaFetch } from "@/lib/ai/ollama-fetch"

const execFileAsync = promisify(execFile)
// Public test-only certificate for rebind-tls.test; never used by application code.
const TEST_TLS_CERTIFICATE = `-----BEGIN CERTIFICATE-----
MIIDMTCCAhmgAwIBAgIUber5vNROc5ZowT3qsjy/cUNyf5MwDQYJKoZIhvcNAQEL
BQAwGjEYMBYGA1UEAwwPcmViaW5kLXRscy50ZXN0MB4XDTI2MDkwOTE4MjAxMloX
DTM2MDkwNjE4MjAxMlowGjEYMBYGA1UEAwwPcmViaW5kLXRscy50ZXN0MIIBIjAN
BgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtCQVvWM4h3GnKzBUFIKdyykS/L5i
WlXkqYT4IAy7gJZg/KxbXyks7fwu72a6JR+4K19QLokdr9kvdMpZzFj2dKtkwz2N
kPmQD6uNCtISibhs3UbCA40RkyJgbgHBcMvdSGj5BNXnoq+PE35EgprehYluX+QI
s4fSm+uH+NeNUQ4RaVNObLxKdu+0ZBqdTLk5qvSyh3L4r8wALNJDk+orouZ5eDIa
vS324YSeZ6QxW75+aQUw8EUJZJwzssYIAU+NnE4jm67jrAm+NXw5Lkdl+YN6PTI5
kJnOARcnhEOT2ygtdL/RmAhN+w910jOicDwFOIZe6aKUOJcPfEY8juV+AQIDAQAB
o28wbTAdBgNVHQ4EFgQU0gTAGCuU2vzQkoEbOHPZnYZTtpgwHwYDVR0jBBgwFoAU
0gTAGCuU2vzQkoEbOHPZnYZTtpgwGgYDVR0RBBMwEYIPcmViaW5kLXRscy50ZXN0
MA8GA1UdEwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAB6qatceNnTCqICw
ckEkw5t1rWqjhZcF8FSTHgsm2sezZ8goSixzdcngAmgnqvIR658irc6JD0BMblqE
hrgYBweSIOjdplorjXz+Uc2r90iMR0l15r5GBCAeUyP09B0WRkDIYl0pIGslu5X6
08rxi4AvERPRlU70aixHcVC2r8X5Lz4Mo5eNUIYkph/bAYT7plt7HcomDF5QQf9G
kUE7f0iTnirjKwZYcx0I67VsPOtn4SmEdkHo2JWm2NGhArAhGkBQP4Acj83483IG
QhU+EINU+7itMbT4s1DWTftFfL+XnYMb6RNWpIdtm0FVK95uwNuS5zTFuka08Fso
M0hJ4eM=
-----END CERTIFICATE-----
`
const TEST_TLS_PRIVATE_KEY = `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQC0JBW9YziHcacr
MFQUgp3LKRL8vmJaVeSphPggDLuAlmD8rFtfKSzt/C7vZrolH7grX1AuiR2v2S90
ylnMWPZ0q2TDPY2Q+ZAPq40K0hKJuGzdRsIDjRGTImBuAcFwy91IaPkE1eeir48T
fkSCmt6FiW5f5Aizh9Kb64f4141RDhFpU05svEp277RkGp1MuTmq9LKHcvivzAAs
0kOT6iui5nl4Mhq9LfbhhJ5npDFbvn5pBTDwRQlknDOyxggBT42cTiObruOsCb41
fDkuR2X5g3o9MjmQmc4BFyeEQ5PbKC10v9GYCE37D3XSM6JwPAU4hl7popQ4lw98
RjyO5X4BAgMBAAECggEAQYyl6oHZ1pNZMKKH3eS/lWcvVQ/UCyoZKERN45+udPaD
eT4gi4qYokqzK4MWdh7KLeIjc6OKTWw61AUz0uOGXuLlKhRSWLAvJzyV+JuDimC1
IHm4bIFfJUqLi0wRP0G3ljs4bfWGMdEvP3khZeMD2NSu+K6qKeXhEcKNelO5RQY8
o0AIlnPfUyG0EStx29KdiK9ngvI/KlyUllbJu4YSi4Vq65qjv9e5M251xE1i6lBn
jt6YkUtKppyJK2w8AjLYA2I0Fy/wKD+BLqLRm60VV94+X/H29zl25NPDClGJANkH
l+/PDsZvlGsZWQVYahL5N0bj8tLLuk6/deubCAQlfwKBgQDcJSpiFsD+qmgnoxTs
feDmAuJdhM35BtXd/5/Ad8wvZMBNUkdLY1TZQf55zBFQvkzHc8y0QZkcxxFXj5EE
NP+V5NSExl/hQ/Zn/po5HLS6Fzt+TLAfQYCK+hkNH1GI4WWA86VUxJD+dSXb9Gen
NGTCUSypDwvNyhX0V9+6f5OVRwKBgQDRevcGGucUT3DnB8Jz011cPF/mcrQBPKN2
+kL76rOCvTJg7mgSSzo9MrgKvTyWju1doUnRtYb91G7nPOLNcVi6+0/TEKEXBrgc
zuDAnWXlYsQZIuZCmE5RVBKdDvKTf2jJNbEm0/ndShnpFqhJ4jow3G6SOPZHBK4e
rtIScVEWdwKBgDaHOiVLr4gk22GeAmvFjjRK2JkDcSVSrRys2XwJ8Fh44y0DyUcC
Fp0tvIOcqVlPmaL5quWnLe6z3DbNB8V7/ya4pG8y18LrW5hMtxSYaKeDY6gYBLPp
PJav9g6LCF4YPlUfhH8npSZyC+uccSQ4VRDQnHhPksPpX2DDd1YxjXO3AoGALYQq
aIkv7JnWTlzBQ6mJf6EetVP3CM3ENvXp2BMHLkEt0SH8Ov1dii6bDrpPj+c+bDm/
cHGhA0ZFUrlIDpuyS+6PSa0zU22CU8Af1bpdiZoMQenzXkT5v3IlGTtGOgZVHmMs
OuOURyDywFLL/kHJoxRCckMuQAAkVUZnHtrAY8ECgYBTJIBBkpeOVnX7nK1dRNWq
9SWnzGq8FyViqez1HjZuZL7lDWo6pUXm4etcJMi3kMA+vxqgs1Mhn0Jaog9/g2vh
kwyILfy3K3ON9HKfV9WISVLuk6JqrcOnYSQOV12X6SoX4v/tmHVVYIYqsd1Ipq3+
Q/Gtofkid7wOu3R2hW3MYA==
-----END PRIVATE KEY-----
`

function nonLoopbackIPv4(): string {
  const address = Object.values(networkInterfaces()).flat()
    .find(item => item?.family === "IPv4" && !item.internal)?.address
  if (!address) throw new Error("Native Ollama transport tests need a non-loopback local IPv4 interface")
  return address
}

async function closeServer(server: ReturnType<typeof createServer>) {
  server.closeAllConnections()
  await new Promise<void>(resolve => server.close(() => resolve()))
}

describe("Connection-bound Ollama transport", () => {
  beforeEach(() => {
    vi.stubEnv("OLLAMA_PRIVATE_ORIGINS", "")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("denies an organization-controlled RFC-1918 listener by default", async () => {
    const address = nonLoopbackIPv4()
    let hits = 0
    const server = createServer((_request, response) => { hits++; response.end("should not arrive") })
    server.listen(0, address)
    await once(server, "listening")
    const { port } = server.address() as { port: number }
    try {
      await expect(validatedOllamaFetch(`http://${address}:${port}/api/tags`))
        .rejects.toBeInstanceOf(OllamaEndpointError)
      expect(hits).toBe(0)
    } finally {
      await closeServer(server)
    }
  })

  it("allows only the exact operator-approved private origin", async () => {
    const address = nonLoopbackIPv4()
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response('{"ok":true}'))
    vi.stubEnv("OLLAMA_PRIVATE_ORIGINS", `http://${address}:11434`)

    await expect(validatedOllamaFetch(`http://${address}:11434/api/tags`)).resolves.toBeInstanceOf(Response)
    await expect(validatedOllamaFetch(`https://${address}:11434/api/tags`)).rejects.toBeInstanceOf(OllamaEndpointError)
    await expect(validatedOllamaFetch(`http://${address}:11435/api/tags`)).rejects.toBeInstanceOf(OllamaEndpointError)
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it.each([
    [`http://127.0.0.1:11434`, "http://127.0.0.1:11434"],
    [`http://169.254.169.254:80`, "http://169.254.169.254:80"],
    [`http://10.20.30.40:11434/path`, "http://10.20.30.40:11434"],
    [`http://10.20.30.40:11434?scope=wide`, "http://10.20.30.40:11434"],
    [`http://user:secret@10.20.30.40:11434`, "http://10.20.30.40:11434"],
    [`http://10.20.30.40:11434,not-an-origin`, "http://10.20.30.40:11434"],
  ])("fails closed for unsafe or malformed allowlist entry %s", async (configured, target) => {
    vi.stubEnv("OLLAMA_PRIVATE_ORIGINS", configured)
    const fetchSpy = vi.spyOn(globalThis, "fetch")

    await expect(validatedOllamaFetch(`${target}/api/tags`)).rejects.toBeInstanceOf(OllamaEndpointError)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
  it("rejects forbidden literal destinations before connecting", async () => {
    for (const target of ["http://[::]:11434", "http://127.0.0.1:11434", "http://169.254.169.254", "http://0.0.0.1", "http://[fea0::1]"]) {
      await expect(validatedOllamaFetch(target)).rejects.toThrow()
    }
  })
  it("rejects a hostname resolving to loopback without reaching a controlled listener", async () => {
    let hits = 0
    const server = createServer((_request, response) => { hits++; response.end("should not arrive") })
    server.listen(0, "127.0.0.1")
    await once(server, "listening")
    const { port } = server.address() as { port: number }
    const lookup = vi.spyOn(dns, "lookup").mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as never)
    try {
      await expect(validatedOllamaFetch(`http://blocked-ollama.test:${port}/api/chat`)).rejects.toThrow("Ollama request failed")
      expect(lookup).toHaveBeenCalledTimes(1)
      expect(hits).toBe(0)
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
  })
  it("pins the vetted address instead of resolving a hostname twice", async () => {
    const address = nonLoopbackIPv4()
    let hits = 0
    let receivedHost = ""
    const server = createServer((request, response) => { hits++; receivedHost = request.headers.host ?? ""; response.setHeader("Content-Type", "application/json"); response.end('{"ok":true}') })
    server.listen(0, address)
    await once(server, "listening")
    const { port } = server.address() as { port: number }
    const lookup = vi.spyOn(dns, "lookup")
      .mockResolvedValueOnce([{ address, family: 4 }] as never)
      .mockResolvedValue([{ address: "127.0.0.1", family: 4 }] as never)
    vi.stubEnv("OLLAMA_PRIVATE_ORIGINS", `http://rebind-ollama.test:${port}`)
    try {
      const response = await validatedOllamaFetch(`http://rebind-ollama.test:${port}/api/chat`)
      expect(await response.json()).toEqual({ ok: true })
      expect(lookup).toHaveBeenCalledTimes(1)
      expect(hits).toBe(1)
      expect(receivedHost).toBe(`rebind-ollama.test:${port}`)
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
  })

  it("rejects obfuscated forbidden IP literals before connecting", async () => {
    const targets = [
      "http://2130706433:11434",
      "http://0x7f000001:11434",
      "http://0177.0.0.1:11434",
      "http://[0:0:0:0:0:0:0:1]:11434",
      "http://[::ffff:127.0.0.1]:11434",
      "http://[64:ff9b::7f00:1]:11434",
    ]

    for (const target of targets) {
      await expect(validatedOllamaFetch(target)).rejects.toBeInstanceOf(OllamaEndpointError)
    }
  })

  it("honors caller aborts while a vetted server is stalled", async () => {
    const address = nonLoopbackIPv4()
    let hits = 0
    let disconnected = false
    const server = createServer((request) => {
      hits++
      request.on("close", () => { disconnected = true })
    })
    server.listen(0, address)
    await once(server, "listening")
    const { port } = server.address() as { port: number }
    vi.spyOn(dns, "lookup").mockResolvedValue([{ address, family: 4 }] as never)
    vi.stubEnv("OLLAMA_PRIVATE_ORIGINS", `http://abort-ollama.test:${port}`)
    const startedAt = performance.now()

    try {
      await expect(validatedOllamaFetch(`http://abort-ollama.test:${port}/api/chat`, {
        signal: AbortSignal.timeout(75),
      })).rejects.toThrow("Ollama request failed")
      expect(performance.now() - startedAt).toBeLessThan(2_000)
      expect(hits).toBe(1)
      await vi.waitFor(() => expect(disconnected).toBe(true))
    } finally {
      await closeServer(server)
    }
  })

  it("rejects a chunked response larger than one MiB without exposing its body", async () => {
    const address = nonLoopbackIPv4()
    let hits = 0
    const server = createServer((_request, response) => {
      hits++
      response.setHeader("Content-Type", "application/json")
      response.write(Buffer.alloc(1024 * 1024, 0x61))
      response.end("sensitive-provider-body")
    })
    server.listen(0, address)
    await once(server, "listening")
    const { port } = server.address() as { port: number }
    vi.spyOn(dns, "lookup").mockResolvedValue([{ address, family: 4 }] as never)
    vi.stubEnv("OLLAMA_PRIVATE_ORIGINS", `http://large-ollama.test:${port}`)

    try {
      const error = await validatedOllamaFetch(`http://large-ollama.test:${port}/api/chat`)
        .then(() => undefined, reason => reason as Error)
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe("Ollama request failed")
      expect(error?.message).not.toContain("sensitive-provider-body")
      expect(hits).toBe(1)
    } finally {
      await closeServer(server)
    }
  })

  it("preserves the original hostname for verified TLS SNI and Host", async () => {
    const tempDirectory = await mkdtemp(join(tmpdir(), "aakd-ollama-tls-"))
    const certificatePath = join(tempDirectory, "certificate.pem")
    const privateKeyPath = join(tempDirectory, "private-key.pem")
    await Promise.all([
      writeFile(certificatePath, TEST_TLS_CERTIFICATE, { mode: 0o600 }),
      writeFile(privateKeyPath, TEST_TLS_PRIVATE_KEY, { mode: 0o600 }),
    ])

    try {
      const require = createRequire(import.meta.url)
      const tsxImport = require.resolve("tsx")
      const fixture = new URL("../fixtures/ollama-tls-probe.ts", import.meta.url)
      const { stdout } = await execFileAsync(process.execPath, ["--import", tsxImport, fixture.pathname], {
        env: {
          ...process.env,
          AAKD_TEST_TLS_CERTIFICATE: certificatePath,
          AAKD_TEST_TLS_PRIVATE_KEY: privateKeyPath,
          NODE_EXTRA_CA_CERTS: certificatePath,
        },
        timeout: 15_000,
      })
      const result = JSON.parse(stdout) as Record<string, unknown>
      expect(result).toEqual({
        body: { ok: true },
        host: expect.stringMatching(/^rebind-tls\.test:\d+$/),
        lookupCalls: 1,
        sni: "rebind-tls.test",
        status: 200,
      })
    } finally {
      await rm(tempDirectory, { recursive: true, force: true })
    }
  }, 20_000)
})
