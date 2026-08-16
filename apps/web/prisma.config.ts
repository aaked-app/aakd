import type { PrismaConfig } from "prisma"
import { loadEnvConfig } from "@next/env"

// prisma.config.ts is loaded by the standalone `prisma` CLI (db:migrate,
// db:studio, etc.), which does not go through Next.js's own env loading.
// Without this, DATABASE_URL is only ever picked up when running through
// `next dev`/`next build`, and bare `pnpm db:migrate` fails with
// "Connection url is empty" even though .env/.env.local are set correctly.
loadEnvConfig(process.cwd())

export default {
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env.DATABASE_URL ?? "",
  },
} satisfies PrismaConfig
