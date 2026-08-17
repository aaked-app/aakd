import * as Sentry from "@sentry/nextjs"

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { assertProductionConfig } = await import("./lib/security/production-config")
    assertProductionConfig()
    await import("./sentry.server.config")
    const { initOtel } = await import("./lib/otel")
    initOtel("clauseflow-web")
  }
  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config")
  }
}

export const onRequestError = Sentry.captureRequestError
