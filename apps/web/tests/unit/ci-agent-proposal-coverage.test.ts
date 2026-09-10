// @vitest-environment node
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import path from "node:path"
import dotenv from "dotenv"
import { describe, expect, it } from "vitest"

const moduleRequire = createRequire(import.meta.url)
const yaml = createRequire(moduleRequire.resolve("eslint"))("js-yaml") as {
  load: (input: string) => { jobs: Record<string, { steps: Array<{ name?: string; run?: string }> }> }
}

describe("CI governed-proposal acceptance coverage", () => {
  it("runs release browser checks against the built standalone artifact", () => {
    const workflow = yaml.load(readFileSync(path.resolve("../../.github/workflows/ci.yml"), "utf8"))
    const steps = workflow.jobs["functional-e2e"].steps
    const run = steps.find(step => step.name === "Run migrations and browser tests")?.run ?? ""
    expect(run).toContain("pnpm build")
    expect(run).toContain("apps/web/.next/standalone/apps/web/server.js")
    expect(run).toContain("cp -R apps/web/.next/static")
    expect(run.indexOf("pnpm build")).toBeLessThan(run.indexOf("apps/web/.next/standalone/apps/web/server.js"))
    expect(run.indexOf("apps/web/.next/standalone/apps/web/server.js")).toBeLessThan(run.indexOf("pnpm --filter web test:e2e"))
    expect(run).not.toContain("pnpm dev")
    expect(run).toContain("RUNTIME_NODE_ENV=development HOSTNAME=127.0.0.1")
    expect(run).toContain("AAKD_VISUAL_FIXTURE=1")
  })

  it("discovers the required browser journey as runnable in the generated CI environment", () => {
    const workflow = yaml.load(readFileSync(path.resolve("../../.github/workflows/ci.yml"), "utf8"))
    const setup = workflow.jobs["functional-e2e"].steps.find(step => step.name === "Create isolated E2E environment")
    if (!setup?.run) throw new Error("Functional acceptance environment setup is missing")
    const directory = mkdtempSync(path.join(tmpdir(), "aakd-ci-agent-coverage-"))
    try {
      execFileSync("bash", ["-c", setup.run], {
        env: { ...process.env, RUNNER_TEMP: directory, GITHUB_ENV: path.join(directory, "github.env") },
        stdio: "pipe",
      })
      const generated = dotenv.parse(readFileSync(path.join(directory, "aakd-e2e.env")))
      expect(new URL(generated.DATABASE_URL).pathname).toMatch(/^\/aakd_acceptance_[a-z0-9_]+$/)
      const output = execFileSync("pnpm", ["exec", "playwright", "test", "agent-action-proposal.regression.spec.ts", "--list", "--reporter=json"], {
        env: { ...process.env, ...generated, PLAYWRIGHT_BASE_URL: generated.NEXT_PUBLIC_APP_URL },
        stdio: "pipe",
        timeout: 30_000,
        maxBuffer: 2 * 1024 * 1024,
      })
      type Suite = { suites?: Suite[]; specs?: Array<{ tests: Array<{ expectedStatus: string }> }> }
      const report = JSON.parse(output.toString("utf8")) as { suites: Suite[]; errors?: unknown[] }
      const collect = (suite: Suite): string[] => [
        ...(suite.specs ?? []).flatMap(spec => spec.tests.map(test => test.expectedStatus)),
        ...(suite.suites ?? []).flatMap(collect),
      ]
      expect(report.errors ?? []).toEqual([])
      expect(report.suites.flatMap(collect)).toEqual(["passed"])
    } finally {
      rmSync(directory, { recursive: true, force: true })
    }
  }, 40_000)
})
