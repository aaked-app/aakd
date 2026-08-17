import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const source = (relativePath: string) =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), "utf8")

describe("worker database isolation", () => {
  it("does not import the request-scoped Prisma client through worker alert helpers", () => {
    for (const relativePath of [
      "lib/alerts/check.ts",
      "lib/email/index.ts",
      "lib/db/activity.ts",
    ]) {
      expect(source(relativePath)).not.toContain('from "@/lib/db/client"')
    }
  })
})
