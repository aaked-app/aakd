import { createRequire } from "node:module"
import { assertVisualFixtureEnabled, cleanupVisualFixture } from "./visual-fixture"
import { loadRootComposeEnv } from "./root-env"

export default async function visualGlobalTeardown() {
  loadRootComposeEnv()
  assertVisualFixtureEnabled(process.env)
  const requireAfterEnv = createRequire(__filename)
  const { prisma } = requireAfterEnv("@/lib/db/client") as typeof import("@/lib/db/client")
  await cleanupVisualFixture(prisma)
  await prisma.$disconnect()
}
