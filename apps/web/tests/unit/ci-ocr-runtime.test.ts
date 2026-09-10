// @vitest-environment node
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
const yaml = createRequire(require.resolve("eslint"))("js-yaml") as {
  load: (input: string) => { jobs: Record<string, { steps: Array<{ name?: string; run?: string }> }> }
}

describe("production OCR verification", () => {
  it("runs the scanned-PDF probe in the bounded worker image without network access", () => {
    const workflow = yaml.load(readFileSync(path.resolve("../../.github/workflows/ci.yml"), "utf8"))
    const script = workflow.jobs["container-images"].steps.find(
      step => step.name === "Verify worker image document and operator runtime",
    )?.run
    expect(script).toContain("--memory=768m --memory-swap=768m --pids-limit=256 --cpus=2 --network=none")
    expect(script).toMatch(/docker run --rm "\$\{runtime_limits\[@\]\}"\s*\\\s*-e AAKD_OCR_PDF_PROBE=1\s*\\\s*-v "\$\{fixture_mount\}"\s*\\\s*"\$\{worker_image\}"\s*\\\s*node --import tsx tests\/e2e\/ocr-pdf-probe\.mts/)
  })
})
