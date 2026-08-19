import { defineConfig } from "@playwright/test"

import baseConfig from "./playwright.config"

const viewports = [
  { name: "mobile", viewport: { width: 320, height: 720 } },
  { name: "tablet", viewport: { width: 768, height: 1024 } },
  { name: "desktop", viewport: { width: 1440, height: 900 } },
] as const

const locales = [
  { name: "en", locale: "en-US" },
  { name: "ar", locale: "ar" },
] as const

export default defineConfig({
  ...baseConfig,
  testMatch: "visual-matrix.spec.ts",
  globalSetup: "./tests/e2e/visual-global.setup.ts",
  globalTeardown: "./tests/e2e/visual-global.teardown.ts",
  fullyParallel: false,
  workers: 1,
  outputDir: "test-results/visual-matrix",
  use: {
    ...baseConfig.use,
    screenshot: "only-on-failure",
  },
  projects: locales.flatMap((language) =>
    viewports.map((screen) => ({
      name: `${language.name}-${screen.name}`,
      metadata: { appLocale: language.name },
      use: {
        viewport: screen.viewport,
        locale: language.locale,
        colorScheme: "light" as const,
        reducedMotion: "reduce" as const,
        timezoneId: "UTC",
      },
    })),
  ),
})
