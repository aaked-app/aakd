import dns from "node:dns/promises"
import { once } from "node:events"
import { readFile } from "node:fs/promises"
import { createServer } from "node:https"
import { networkInterfaces } from "node:os"
import type { TLSSocket } from "node:tls"
import { validatedOllamaFetch } from "../../lib/ai/ollama-fetch"

async function main() {
  const certificatePath = process.env.AAKD_TEST_TLS_CERTIFICATE
  const privateKeyPath = process.env.AAKD_TEST_TLS_PRIVATE_KEY
  if (!certificatePath || !privateKeyPath) throw new Error("TLS fixture paths are required")
  if (process.env.NODE_TLS_REJECT_UNAUTHORIZED === "0") throw new Error("TLS verification must remain enabled")

  const address = Object.values(networkInterfaces()).flat()
    .find(item => item?.family === "IPv4" && !item.internal)?.address
  if (!address) throw new Error("TLS fixture needs a non-loopback local IPv4 interface")

  let host = ""
  let sni = ""
  let lookupCalls = 0
  const server = createServer({
    cert: await readFile(certificatePath),
    key: await readFile(privateKeyPath),
  }, (request, response) => {
    host = request.headers.host ?? ""
    sni = (request.socket as TLSSocket).servername || ""
    response.setHeader("Content-Type", "application/json")
    response.end('{"ok":true}')
  })
  server.listen(0, address)
  await once(server, "listening")
  const { port } = server.address() as { port: number }
  process.env.OLLAMA_PRIVATE_ORIGINS = `https://rebind-tls.test:${port}`
  const originalLookup = dns.lookup
  dns.lookup = (async () => {
    lookupCalls++
    return [{ address, family: 4 }]
  }) as unknown as typeof dns.lookup

  try {
    const response = await validatedOllamaFetch(`https://rebind-tls.test:${port}/api/chat`)
    const body = await response.json()
    process.stdout.write(JSON.stringify({ body, host, lookupCalls, sni, status: response.status }))
  } finally {
    dns.lookup = originalLookup
    server.closeAllConnections()
    await new Promise<void>(resolve => server.close(() => resolve()))
  }
}

void main().catch(error => {
  process.stderr.write(error instanceof Error ? error.stack ?? error.message : String(error))
  process.exitCode = 1
})
