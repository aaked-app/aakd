import { spawn } from "node:child_process"
import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomBytes } from "node:crypto"
import { request } from "@playwright/test"

// Explicit, opt-in client compatibility probe. Never runs in the browser suite.
const baseURL = process.env.PLAYWRIGHT_BASE_URL
const binary = process.env.AAKD_CODEX_BINARY
if (!baseURL || !binary || process.env.AAKD_CLIENT_PROBE !== "1") {
  throw new Error("Set AAKD_CLIENT_PROBE=1, PLAYWRIGHT_BASE_URL and AAKD_CODEX_BINARY")
}
if (!["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)) {
  throw new Error("This disposable account probe is restricted to a local runtime")
}

const api = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } })
let keyId: string | undefined
let rawKey: string | undefined
try {
  const suffix = randomBytes(8).toString("hex")
  const signup = await api.post("/api/auth/sign-up/email", { data: {
    name: "Synthetic Codex Client", email: `codex-${suffix}@example.test`, password: randomBytes(32).toString("base64url"),
  } })
  if (!signup.ok()) throw new Error(`Probe signup: ${signup.status()}`)
  const org = await api.post("/api/auth/organization/create", { data: { name: `Codex probe ${suffix}`, slug: `codex-probe-${suffix}` } })
  if (!org.ok()) throw new Error(`Probe organization: ${org.status()}`)
  const active = await api.post("/api/auth/organization/set-active", { data: { organizationId: (await org.json()).id } })
  if (!active.ok()) throw new Error(`Probe organization activation: ${active.status()}`)
  const contract = await api.post("/api/contracts", { data: { title: `Synthetic Codex agreement ${suffix}` } })
  if (contract.status() !== 201) throw new Error(`Probe agreement creation: ${contract.status()}`)
  const contractId = (await contract.json()).id as string
  const created = await api.post("/api/org/api-keys", { data: { name: "Disposable Codex compatibility", scopes: ["read"] } })
  if (created.status() !== 201) throw new Error(`Probe key creation: ${created.status()}`)
  const key = await created.json()
  keyId = key.apiKey.id
  if (typeof key.rawKey !== "string") throw new Error("Probe key response has no key")
  rawKey = key.rawKey
  const directory = await mkdtemp(join(tmpdir(), "aakd-codex-probe-"))
  const args = ["exec", "--ignore-user-config", "--ephemeral", "--skip-git-repo-check", "--sandbox", "read-only", "--json", "-C", directory,
    "-c", `mcp_servers.aakd_probe.url=${JSON.stringify(`${baseURL}/api/mcp`)}`,
    "-c", 'mcp_servers.aakd_probe.bearer_token_env_var="AAKD_PROBE_TOKEN"',
    "-c", 'mcp_servers.aakd_probe.enabled_tools=["list_contracts"]',
    // The user explicitly authorized this single read on disposable data.
    // Apply approval only to this invocation/tool, never to global settings.
    "-c", 'mcp_servers.aakd_probe.tools.list_contracts.approval_mode="approve"',
    "Call the aakd_probe list_contracts MCP tool exactly once with limit 1. This is a synthetic test organization containing one authorized agreement. Do not use shell, browser, files, other tools, or make changes. Report whether the tool succeeded. Do not invent a tool result."]
  const child = spawn(binary, args, { cwd: directory, env: { ...process.env, AAKD_PROBE_TOKEN: key.rawKey }, stdio: ["ignore", "pipe", "pipe"] })
  let output = ""
  child.stdout.on("data", data => { output += data.toString() })
  child.stderr.on("data", data => { output += data.toString() })
  const timer = setTimeout(() => child.kill("SIGTERM"), 120_000)
  const exitCode = await new Promise<number | null>((resolve, reject) => { child.on("error", reject); child.on("close", resolve) })
  clearTimeout(timer)
  const events = output.split("\n").flatMap(line => { try { return [JSON.parse(line)] } catch { return [] } })
  const calls = events.filter(event => event.type === "item.completed" && event.item?.type === "mcp_tool_call")
  if (exitCode !== 0) throw new Error(`Codex client exited ${exitCode}`)
  if (calls.length !== 1 || calls[0].item.server !== "aakd_probe" || calls[0].item.tool !== "list_contracts" || calls[0].item.status !== "completed" || calls[0].item.error || calls[0].item.result?.isError) {
    throw new Error("Codex did not complete exactly one successful MCP read")
  }
  if (!JSON.stringify(calls[0].item.result).includes(contractId)) throw new Error("Codex read did not return the explicitly granted synthetic agreement")
  console.log(JSON.stringify({ step: "codex_client_read", status: "PASS", calls: 1, grantedAgreementReturned: true }))
} finally {
  if (keyId) {
    const revoked = await api.delete(`/api/org/api-keys/${keyId}`)
    if (revoked.status() !== 204) throw new Error(`Probe key revocation: ${revoked.status()}`)
    const denied = await api.get("/api/contracts", { headers: { Authorization: `Bearer ${rawKey}` } })
    if (denied.status() !== 401) throw new Error(`Revoked probe key was not rejected: ${denied.status()}`)
    console.log("Disposable probe key revoked and rejected even with a valid session")
  }
  await api.dispose()
}
