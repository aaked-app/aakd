import { readFileSync } from "node:fs"
import path from "node:path"
import dotenv from "dotenv"
import { loadEnvConfig } from "@next/env"

/** Load the repository's compose environment after Next's local overrides. */
export function loadRootComposeEnv() {
  const root = path.resolve(process.cwd(), "../..")
  loadEnvConfig(root, false)
  Object.assign(process.env, dotenv.parse(readFileSync(path.join(root, ".env"))))
}
