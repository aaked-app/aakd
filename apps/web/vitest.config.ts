import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    globals: true,
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    testTimeout: 10_000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // Worker handlers live at the repository root, outside this package.
      // Resolve their runtime dependency from the web workspace in tests too.
      bullmq: path.resolve(__dirname, "node_modules/bullmq"),
    },
  },
})
