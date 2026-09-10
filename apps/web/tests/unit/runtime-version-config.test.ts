// @vitest-environment node
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const NODE_24_ALPINE_IMAGE = "node@sha256:50c8e8ca1d27439048670df5883f32d57cf81cff6233222c893fd0d9884cbd81"
const require = createRequire(import.meta.url)
const yaml = createRequire(require.resolve("eslint"))("js-yaml") as {
  load(input: string): { jobs?: Record<string, { steps?: Array<{ uses?: string; with?: Record<string, unknown> }> }> }
}

function unapprovedDockerSources(dockerfile: string): string[] {
  const approvedAliases = new Set<string>()
  const unapproved: string[] = []
  for (const line of dockerfile.split("\n").filter((candidate) => /^\s*FROM\s/i.test(candidate))) {
    const tokens = line.trim().split(/\s+/)
    tokens.shift()
    while (tokens[0]?.startsWith("--")) tokens.shift()
    const source = tokens.shift() ?? "<missing>"
    const aliasIndex = tokens.findIndex((token) => token.toLowerCase() === "as")
    const alias = aliasIndex >= 0 ? tokens[aliasIndex + 1]?.toLowerCase() : undefined
    const approved = source === NODE_24_ALPINE_IMAGE || approvedAliases.has(source.toLowerCase())
    if (!approved) unapproved.push(source)
    if (alias && approved) approvedAliases.add(alias)
  }
  return unapproved
}

function setupNodeVersions(workflow: string): unknown[] {
  const parsed = yaml.load(workflow)
  return Object.values(parsed.jobs ?? {}).flatMap((job) =>
    (job.steps ?? [])
      .filter((step) => step.uses?.startsWith("actions/setup-node@"))
      .map((step) => step.with?.["node-version"]),
  )
}

describe("supported Node.js release runtime", () => {
  it("pins every Docker FROM source or alias to the verified Node 24 Alpine index", () => {
    for (const name of ["Dockerfile", "Dockerfile.worker"]) {
      const dockerfile = readFileSync(resolve(process.cwd(), name), "utf8")
      expect([...dockerfile.matchAll(/^FROM\s+/gmi)].length).toBeGreaterThan(0)
      expect(unapprovedDockerSources(dockerfile)).toEqual([])
    }
  })

  it("rejects floating, EOL, and unrooted Docker stages", () => {
    expect(unapprovedDockerSources(`FROM node:20-alpine AS base\nFROM base AS runner\n`)).toEqual(["node:20-alpine", "base"])
    expect(unapprovedDockerSources("FROM --platform=linux/amd64 node:20-alpine AS base\n")).toEqual(["node:20-alpine"])
    expect(unapprovedDockerSources(`FROM ${NODE_24_ALPINE_IMAGE} AS base\nFROM base AS runner\n`)).toEqual([])
    expect(unapprovedDockerSources("FROM scratch AS runner\n")).toEqual(["scratch"])
  })

  it("uses exactly Node 24 for every CI setup-node step and declares only that release major", () => {
    const workflow = readFileSync(resolve(process.cwd(), "../../.github/workflows/ci.yml"), "utf8")
    const versions = setupNodeVersions(workflow)
    expect(versions.length).toBeGreaterThan(0)
    expect(versions.every((version) => version === "24")).toBe(true)

    const rootPackage = JSON.parse(readFileSync(resolve(process.cwd(), "../../package.json"), "utf8")) as {
      engines?: { node?: string }
    }
    expect(rootPackage.engines?.node).toBe(">=24 <25")
  })

  it("detects missing and non-exact setup-node selectors", () => {
    expect(setupNodeVersions(`jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n`)).toEqual([undefined])
    expect(setupNodeVersions(`jobs:\n  test:\n    steps:\n      - uses: actions/setup-node@v4\n        with:\n          node-version: lts/*\n`)).toEqual(["lts/*"])
  })
})
