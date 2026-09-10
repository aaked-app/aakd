import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { spawnSync } from "node:child_process"
import { afterEach, describe, expect, it } from "vitest"

import { generatedRouteConfig } from "../../scripts/check-generated-route-types.mjs"

const require = createRequire(import.meta.url)
const fixtures: string[] = []

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map((fixture) => rm(fixture, { recursive: true })))
})

describe("generated Next route type verification", () => {
  it("checks named-output validators even when the base configuration excludes them", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "aakd-route-types-test-"))
    fixtures.push(root)
    const types = path.join(root, ".next-release", "types")
    await mkdir(types, { recursive: true })
    await writeFile(path.join(root, "tsconfig.json"), JSON.stringify({
      compilerOptions: { strict: true, noEmit: true, types: [], lib: ["es2020"], skipLibCheck: true },
      include: ["source.ts"], exclude: [".next-*"],
    }))
    await writeFile(path.join(root, "source.ts"), "export {}\n")
    const validator = path.join(types, "route.ts")
    await writeFile(validator, "type Check<T extends Promise<unknown>> = T; type Route = Check<Promise<string> | string>;\n")
    const config = await generatedRouteConfig(root, ".next-release")
    expect(config.files).toContain(validator)
    const configPath = path.join(root, "validation.json")
    await writeFile(configPath, JSON.stringify(config))
    const run = () => spawnSync(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", configPath], { encoding: "utf8" })
    const invalid = run()
    expect(invalid.status).toBe(2)
    expect(invalid.stdout).toContain("TS2344")
    await writeFile(validator, "type Check<T extends Promise<unknown>> = T; type Route = Check<Promise<string>>;\n")
    expect(run().status).toBe(0)
  })

  it("fails closed when the selected build has no generated validators", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "aakd-route-types-test-"))
    fixtures.push(root)
    await mkdir(path.join(root, ".next", "types"), { recursive: true })
    await expect(generatedRouteConfig(root, ".next")).rejects.toThrow("No generated route types")
  })
})
