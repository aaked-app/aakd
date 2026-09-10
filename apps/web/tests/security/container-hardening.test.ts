import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

describe("container hardening", () => {
  it("runs the worker as a non-root user", () => {
    const dockerfile = readFileSync(resolve(process.cwd(), "Dockerfile.worker"), "utf8")
    expect(dockerfile).toMatch(/USER workerjs/)
  })

  it("installs a multilingual font for LibreOffice PDF conversion", () => {
    const dockerfile = readFileSync(resolve(process.cwd(), "Dockerfile.worker"), "utf8")
    expect(dockerfile).toMatch(/apk add --no-cache[^\n]*\bfont-dejavu\b/)
  })

  it("ships and build-verifies the immutable English OCR model", () => {
    const dockerfile = readFileSync(resolve(process.cwd(), "Dockerfile.worker"), "utf8")
    expect(dockerfile).toContain("COPY --chown=workerjs:workerjs apps/web/eng.traineddata ./apps/web/eng.traineddata")
    expect(dockerfile).toContain("5dc5d8d640a212c9d6184921ba103b186f50e0fed9ee716c53e6b312b400d747  ./apps/web/eng.traineddata")
    expect(dockerfile).toMatch(/sha256sum -c -/)
    expect(dockerfile).toContain("COPY THIRD_PARTY_NOTICES.md ./THIRD_PARTY_NOTICES.md")
    expect(dockerfile).toContain("COPY third-party-licenses ./third-party-licenses")
  })

  it("defines an application healthcheck", () => {
    const dockerfile = readFileSync(resolve(process.cwd(), "Dockerfile"), "utf8")
    expect(dockerfile).toMatch(/HEALTHCHECK.*api\/health/)
  })
})
