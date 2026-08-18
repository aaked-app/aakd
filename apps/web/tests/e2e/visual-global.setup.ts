import { randomBytes } from "node:crypto"
import { mkdir } from "node:fs/promises"
import { createRequire } from "node:module"
import path from "node:path"
import { request, type FullConfig } from "@playwright/test"
import { hashPassword } from "better-auth/crypto"
import { loadEnvConfig } from "@next/env"

import { VISUAL_AUTH_STATE, VISUAL_FIXTURE_IDS, VISUAL_OWNER_EMAIL } from "./visual-constants"
import {
  assertVisualFixtureEnabled,
  seedVisualFixture,
} from "./visual-fixture"

export default async function visualGlobalSetup(_config: FullConfig) {
  loadEnvConfig(process.cwd())
  assertVisualFixtureEnabled(process.env)
  // Playwright transpiles required TypeScript modules, while native dynamic
  // import bypasses that transform. Keep this load after Next has populated env.
  const requireAfterEnv = createRequire(__filename)
  const { prisma } = requireAfterEnv("@/lib/db/client") as typeof import("@/lib/db/client")

  const password = randomBytes(32).toString("base64url")
  const passwordHash = await hashPassword(password)
  await seedVisualFixture(prisma, passwordHash)

  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000"
  const authRequest = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Origin: baseURL },
  })

  try {
    const signIn = await authRequest.post("/api/auth/sign-in/email", {
      data: { email: VISUAL_OWNER_EMAIL, password },
    })
    if (!signIn.ok()) {
      throw new Error(`Visual fixture sign-in failed (${signIn.status()}): ${await signIn.text()}`)
    }

    const setActive = await authRequest.post("/api/auth/organization/set-active", {
      data: { organizationId: VISUAL_FIXTURE_IDS.organization },
    })
    if (!setActive.ok()) {
      throw new Error(
        `Visual fixture organization activation failed (${setActive.status()}): ${await setActive.text()}`,
      )
    }

    await mkdir(path.dirname(VISUAL_AUTH_STATE), { recursive: true })
    await authRequest.storageState({ path: VISUAL_AUTH_STATE })
  } finally {
    await authRequest.dispose()
    await prisma.$disconnect()
  }
}
