import { readFileSync } from "node:fs"
import path from "node:path"
import dotenv from "dotenv"
import { loadEnvConfig } from "@next/env"

/** Load the repository's compose environment after Next's local overrides. */
export function loadRootComposeEnv() {
  // CI and disposable acceptance runtimes already provide a complete explicit
  // environment. Never redirect fixture writes into a developer's root .env.
  if (process.env.AAKD_E2E_USE_PROCESS_ENV === "1") {
    if (!process.env.DATABASE_URL) throw new Error("Explicit E2E environment requires DATABASE_URL")
    return
  }
  const root = path.resolve(process.cwd(), "../..")
  loadEnvConfig(root, false)
  Object.assign(process.env, dotenv.parse(readFileSync(path.join(root, ".env"))))
}
