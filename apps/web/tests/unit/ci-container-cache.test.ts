// @vitest-environment node
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import path from "node:path"
import { describe, expect, it } from "vitest"

const require = createRequire(import.meta.url)
type Step = { id?: string; name?: string; uses?: string; run?: string; env?: Record<string, string>; with?: Record<string, unknown> }
const yaml = createRequire(require.resolve("eslint"))("js-yaml") as {
  load: (input: string) => { jobs: Record<string, { steps: Step[] }> }
}

describe("container CI disk retention", () => {
  it("releases only the job-owned builder cache between image builds and before runtime checks", () => {
    const workflow = yaml.load(readFileSync(path.resolve("../../.github/workflows/ci.yml"), "utf8"))
    const steps = workflow.jobs["container-images"].steps
    const builder = steps.find(step => step.uses === "docker/setup-buildx-action@v3")
    expect(builder?.id).toBe("image-builder")
    expect(builder?.with?.driver).toBe("docker-container")
    for (const [name, previous, next, images] of [
      ["Release web build cache", "Build web image", "Build worker image", ["aakd-app:ci"]],
      ["Release worker build cache", "Build worker image", "Verify worker image document and operator runtime", ["aakd-app:ci", "aakd-worker:ci"]],
    ] as const) {
      const index = steps.findIndex(step => step.name === name)
      expect(steps.find(step => step.name === previous)?.with?.builder).toBe("${{ steps.image-builder.outputs.name }}")
      expect(index).toBeGreaterThan(steps.findIndex(step => step.name === previous))
      expect(index).toBeLessThan(steps.findIndex(step => step.name === next))
      const step = steps[index]
      expect(step.env?.CI_BUILDER_NAME).toBe("${{ steps.image-builder.outputs.name }}")
      expect(step.run).toContain('test -n "$CI_BUILDER_NAME"')
      expect(step.run).toContain('docker buildx prune --builder "$CI_BUILDER_NAME" --all --force')
      expect(step.run).not.toMatch(/docker (system|image|volume) prune|rm -/)
      for (const image of images) {
        const inspection = `docker image inspect ${image}`
        expect(step.run!.indexOf(inspection)).toBeLessThan(step.run!.indexOf("docker buildx prune"))
        expect(step.run!.lastIndexOf(inspection)).toBeGreaterThan(step.run!.indexOf("docker buildx prune"))
      }
    }
  })
})
