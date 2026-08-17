import { chromium } from "../apps/web/node_modules/@playwright/test/index.mjs"
import fs from "node:fs"
import path from "node:path"

const baseUrl = process.env.AAKD_DEMO_BASE_URL ?? "http://localhost:3000"
const repo = process.cwd()
const contracts = [
  ["01-master-services-agreement-native.pdf", "Synthetic Master Services Agreement"],
  ["09-synthetic-saas-msa.pdf", "Synthetic SaaS Agreement"],
  ["11-synthetic-scanned-mutual-nda.pdf", "Synthetic Mutual NDA"],
]

const browser = await chromium.launch({ headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const page = await context.newPage()
const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const results = []

try {
  await page.goto(`${baseUrl}/register`, { waitUntil: "networkidle" })
  await page.locator("#name").fill("Aakd Demo Verification")
  await page.locator("#email").fill(`ai-demo-${suffix}@example.com`)
  await page.locator("#password").fill("Demo-Password-2026!")
  await page.getByRole("button", { name: "Create account" }).click()
  await page.waitForURL(/\/create-org/, { timeout: 20_000 })
  await page.locator("#name").fill(`Aakd AI Demo ${suffix}`)
  await page.getByRole("button", { name: "Create organization" }).click()
  await page.waitForURL(/\/onboarding/, { timeout: 20_000 })
  const skip = page.getByText("Skip for now", { exact: true })
  await skip.waitFor({ state: "visible", timeout: 20_000 })
  await skip.click()
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 })

  for (const [filename, title] of contracts) {
    await page.goto(`${baseUrl}/contracts/new`, { waitUntil: "networkidle" })
    await page.locator('input[type="file"]').setInputFiles(
      path.join(repo, "research/e2e-contract-corpus-2026-08-17/files", filename),
    )
    await page.getByRole("button", { name: /continue to review/i }).click()
    await page.locator("#title").waitFor({ timeout: 20_000 })
    await page.locator("#title").fill(title)
    await page.getByRole("button", { name: "Create Contract", exact: true }).click()
    await page.waitForURL(/\/contracts\/(?!new$)[a-z0-9]+$/, { timeout: 40_000 })

    const contractUrl = page.url()
    await page.getByRole("tab", { name: /AI Extractions/i }).click()
    const source = page.getByText(/Source page/i).first()
    const sourceFound = await source.waitFor({ state: "visible", timeout: 90_000 }).then(() => true).catch(() => false)
    const body = await page.locator("body").innerText()
    results.push({
      filename,
      title,
      contractUrl,
      sourceFound,
      hasExtractionError: /extraction failed|not yet extracted|failed to extract/i.test(body),
      hasCitation: /Source page/i.test(body),
      excerpt: body.slice(0, 500),
    })
  }
} finally {
  fs.writeFileSync("/tmp/aakd-ai-demo-results.json", JSON.stringify(results, null, 2))
  await context.close()
  await browser.close()
}

console.log(JSON.stringify(results, null, 2))
if (results.length !== contracts.length || results.some((result) => !result.sourceFound || result.hasExtractionError)) {
  process.exitCode = 1
}
