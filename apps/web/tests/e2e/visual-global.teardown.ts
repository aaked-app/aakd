import { createRequire } from "node:module"
import { loadEnvConfig } from "@next/env"

import { assertVisualFixtureEnabled, cleanupVisualFixture } from "./visual-fixture"

export default async function visualGlobalTeardown() {
  loadEnvConfig(process.cwd())
  assertVisualFixtureEnabled(process.env)
  const requireAfterEnv = createRequire(__filename)
  const { prisma } = requireAfterEnv("@/lib/db/client") as typeof import("@/lib/db/client")
  await cleanupVisualFixture(prisma)
  await prisma.$disconnect()
}
