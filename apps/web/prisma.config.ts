import type { PrismaConfig } from "prisma"
import { loadEnvConfig } from "@next/env"
import { resolve } from "node:path"
import { readFileSync } from "node:fs"
import dotenv from "dotenv"

// prisma.config.ts is loaded by the standalone `prisma` CLI (db:migrate,
// db:studio, etc.), which does not go through Next.js's own env loading.
// Without this, DATABASE_URL is only ever picked up when running through
// `next dev`/`next build`, and bare `pnpm db:migrate` fails with
// "Connection url is empty" even though .env/.env.local are set correctly.
const explicitDatabaseUrl = process.env.DATABASE_URL
const workspaceEnv = loadEnvConfig(resolve(process.cwd(), "../.."), false).combinedEnv
const localEnv = loadEnvConfig(process.cwd(), false).combinedEnv
const workspaceRoot = resolve(process.cwd(), "../..")
const rootFileEnv = dotenv.parse(readFileSync(resolve(workspaceRoot, ".env")))
const env = explicitDatabaseUrl
  ? { ...workspaceEnv, ...localEnv, ...process.env, DATABASE_URL: explicitDatabaseUrl }
  : { ...workspaceEnv, ...localEnv, ...process.env, ...rootFileEnv }

export default {
  schema: "prisma/schema.prisma",
  datasource: {
    url: env.DATABASE_URL ?? "",
  },
} satisfies PrismaConfig
