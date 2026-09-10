import path from "path"
import { createRequire } from "node:module"
import { fileURLToPath } from "url"
import createNextIntlPlugin from "next-intl/plugin"
import { withSentryConfig } from "@sentry/nextjs"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
const nextPackageDirectory = path.dirname(require.resolve("next/package.json"))
const swcHelpersDirectory = path.dirname(
  require.resolve("@swc/helpers/package.json", {
    paths: [nextPackageDirectory],
  }),
)
const swcHelpersTraceGlob = `${path.relative(__dirname, swcHelpersDirectory).replaceAll(path.sep, "/")}/**/*`

const withNextIntl = createNextIntlPlugin("./i18n.ts")

/** @type {import('next').NextConfig} */
const nextConfig = {
  // The functional E2E harness uses 127.0.0.1 while the dev server binds
  // localhost. Allow that loopback origin for Next's development assets.
  allowedDevOrigins: ["127.0.0.1"],
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  // Expose signing feature flag to the client — derived from DOCUSEAL_API_KEY
  // so users never need to set a separate toggle. No key = signing hidden.
  env: {
    NEXT_PUBLIC_SIGNING_ENABLED: process.env.DOCUSEAL_API_KEY ? "true" : "false",
  },
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../../"),
  // Next 16's standalone trace can omit @swc/helpers ESM modules under pnpm.
  // Keep the runtime helper package in every server trace without pinning a
  // pnpm-store version in Dockerfile code.
  outputFileTracingIncludes: {
    "/*": [
      swcHelpersTraceGlob,
      "./lib/pdf-parser-child.cjs",
      "./node_modules/node-ensure/**/*",
      "./node_modules/pdf-parse/**/*",
    ],
  },
  // Webpack's post-include trace filtering can exclude old workspace builds.
  // Turbopack 16.3.1 does not apply this exclusion to custom includes; the
  // production build script therefore uses Webpack until that behavior is fixed.
  outputFileTracingExcludes: {
    "/*": ["../../node_modules/.pnpm/node_modules/web/.next*/**/*"],
  },
  serverExternalPackages: ["pdf-parse"],
  // In a pnpm monorepo the root node_modules lives two levels up.
  // Setting this tells Next.js to trace dependencies from the monorepo
  // root so the standalone bundle includes packages like 'next' itself.
  experimental: {
    // pdf-parse v1 runs a test file on import — keep it out of the Next.js
    // bundle so it loads at runtime via Node.js require, not at build time.
    // Never serve a stale RSC payload for dynamic pages (those that use
    // cookies/headers or cache:'no-store').  Without this, the client-side
    // Router Cache re-uses the last render for ~30 s, so the dashboard shows
    // outdated contract counts even though the server always fetches fresh data.
    // Static pages keep the default 5-minute cache (300 s).
    staleTimes: {
      dynamic: 0,
      static: 300,
    },
  },
}

export default withSentryConfig(
  withNextIntl(nextConfig),
  {
    org: "aaked",
    project: "aaked-web",
    silent: true,
    widenClientFileUpload: true,
    tunnelRoute: "/monitoring",
    hideSourceMaps: true,
    disableLogger: true,
    automaticVercelMonitors: true,
  },
)
