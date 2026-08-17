#!/usr/bin/env bash
set -euo pipefail

# Standards-based MCP HTTP compatibility replay. This deliberately uses only
# Node's built-in fetch so it can run against a deployed Aakd instance without
# installing a client SDK or sending contract data to a third party.
: "${MCP_API_KEY:?Set MCP_API_KEY to a disposable Aakd API key}"
export MCP_URL="${MCP_URL:-http://localhost:3000/api/mcp}"

node <<'NODE'
const url = process.env.MCP_URL
const key = process.env.MCP_API_KEY
const headers = { "content-type": "application/json", authorization: `Bearer ${key}` }
let id = 0

async function request(method, params) {
  const response = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ jsonrpc: "2.0", id: ++id, method, params }),
  })
  const body = await response.json()
  if (!response.ok || body.error) {
    throw new Error(`${method}: HTTP ${response.status} ${JSON.stringify(body)}`)
  }
  return body
}

const initialize = await request("initialize", {
  protocolVersion: "2024-11-05",
  capabilities: {},
  clientInfo: { name: "aakd-mcp-http-replay", version: "1.0.0" },
})
if (initialize.result?.protocolVersion !== "2024-11-05") {
  throw new Error("initialize returned an unsupported protocol version")
}

const notification = await fetch(url, {
  method: "POST",
  headers,
  body: JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
})
if (notification.status !== 202) {
  throw new Error(`notifications/initialized: HTTP ${notification.status}`)
}

const tools = await request("tools/list")
const toolCount = tools.result?.tools?.length ?? 0
if (toolCount === 0) throw new Error("tools/list returned no tools")

const ping = await request("ping")
if (JSON.stringify(ping.result) !== "{}") throw new Error("ping returned an unexpected result")

const list = await request("tools/call", {
  name: "list_contracts",
  arguments: { limit: 10 },
})
if (!list.result?.content?.[0]?.text) throw new Error("list_contracts returned no tool content")

async function expectToolError(name, args, expected) {
  const result = await request("tools/call", { name, arguments: args })
  const text = String(result.result?.content?.[0]?.text ?? "")
  if (!result.result?.isError || !text.includes(expected)) {
    throw new Error(`${name}: expected guarded tool error, got ${JSON.stringify(result)}`)
  }
}

await expectToolError("ask_contract", { contractId: "compatibility-probe", question: "test" }, "text_read")
await expectToolError("create_contract", { title: "compatibility-probe" }, "write scope")

console.log(JSON.stringify({
  initialize: "ok",
  notification: 202,
  toolCount,
  ping: "ok",
  listContracts: "ok",
  scopeGuards: "ok",
}))
NODE
