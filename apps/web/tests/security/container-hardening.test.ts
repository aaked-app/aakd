import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

describe("container hardening", () => {
  it("runs the worker as a non-root user", () => {
    const dockerfile = readFileSync(resolve(process.cwd(), "Dockerfile.worker"), "utf8")
    expect(dockerfile).toMatch(/USER workerjs/)
  })

  it("defines an application healthcheck", () => {
    const dockerfile = readFileSync(resolve(process.cwd(), "Dockerfile"), "utf8")
    expect(dockerfile).toMatch(/HEALTHCHECK.*api\/health/)
  })
})
