import { describe, expect, it } from "vitest"
import { createRequire } from "node:module"
import path from "node:path"

import nextConfig from "../../next.config.mjs"

const require = createRequire(import.meta.url)
const picomatch = require("next/dist/compiled/picomatch") as (
  patterns: string[],
  options: { contains: boolean; dot: boolean },
) => (candidate: string) => boolean

describe("Next.js standalone output tracing", () => {
  it("uses the supported Webpack build to avoid recursive Turbopack trace includes", () => {
    const manifest = require("../../package.json") as { scripts: { build: string } }
    expect(manifest.scripts.build).toBe("next build --webpack && node scripts/check-generated-route-types.mjs")
  })

  it("keeps required runtime assets while excluding recursively reachable build outputs", () => {
    const includes = nextConfig.outputFileTracingIncludes?.["/*"] ?? []
    expect(includes).toEqual(
      expect.arrayContaining([
        "./lib/pdf-parser-child.cjs",
        "./node_modules/node-ensure/**/*",
        "./node_modules/pdf-parse/**/*",
      ]),
    )
    const swcHelpersInclude = includes.find((pattern) =>
      pattern.endsWith("/node_modules/@swc/helpers/**/*"),
    )
    expect(swcHelpersInclude).toBeDefined()
    expect(swcHelpersInclude).not.toContain("@swc+helpers@*/")
    expect(swcHelpersInclude).not.toContain("/node_modules/web/")

    const excludes = nextConfig.outputFileTracingExcludes?.["/*"] ?? []
    expect(excludes).toContain(
      "../../node_modules/.pnpm/node_modules/web/.next*/**/*",
    )

    const appRoot = path.resolve(import.meta.dirname, "../..")
    const isExcluded = picomatch(
      excludes.map((pattern) => path.join(appRoot, pattern)),
      { contains: true, dot: true },
    )
    expect(
      isExcluded(
        path.resolve(
          appRoot,
          "../../node_modules/.pnpm/node_modules/web/.next-release/standalone/node_modules/.pnpm/@swc+helpers@0.5.23/node_modules/@swc/helpers/LICENSE",
        ),
      ),
    ).toBe(true)
    expect(
      isExcluded(
        path.resolve(
          appRoot,
          "../../node_modules/.pnpm/@swc+helpers@0.5.23/node_modules/@swc/helpers/LICENSE",
        ),
      ),
    ).toBe(false)
  })
})
