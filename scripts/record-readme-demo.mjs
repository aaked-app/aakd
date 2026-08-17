import { chromium } from "../apps/web/node_modules/@playwright/test/index.mjs"
import fs from "node:fs"
import path from "node:path"

const repo = process.cwd()
const outputDir = path.join(repo, "docs/media")
const baseUrl = process.env.AAKD_DEMO_BASE_URL ?? "http://localhost:3000"
fs.mkdirSync(outputDir, { recursive: true })

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
const email = `demo-${suffix}@example.com`
const authState = path.join(outputDir, `.aakd-demo-auth-${suffix}.json`)

const browser = await chromium.launch({ headless: true })
const setupContext = await browser.newContext({ viewport: { width: 1440, height: 900 } })
const setupPage = await setupContext.newPage()

try {
  await setupPage.goto(`${baseUrl}/register`, { waitUntil: "networkidle" })
  await setupPage.locator("#name").fill("Aakd Demo User")
  await setupPage.locator("#email").fill(email)
  await setupPage.locator("#password").fill("Demo-Password-2026!")
  await setupPage.getByRole("button", { name: "Create account" }).click()
  await setupPage.waitForURL(/\/create-org/, { timeout: 15_000 })

  await setupPage.locator("#name").fill(`Aakd Demo ${suffix}`)
  await setupPage.getByRole("button", { name: "Create organization" }).click()
  await setupPage.waitForURL(/\/onboarding/, { timeout: 15_000 })

  const skip = setupPage.getByText("Skip for now", { exact: true })
  await skip.waitFor({ state: "visible", timeout: 15_000 })
  await skip.click()
  await setupPage.waitForURL(/\/dashboard/, { timeout: 15_000 })
  await setupContext.storageState({ path: authState })
  await setupContext.close()

  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    storageState: authState,
    recordVideo: { dir: outputDir, size: { width: 1440, height: 900 } },
  })
  const page = await context.newPage()

  await page.goto(`${baseUrl}/contracts/new`, { waitUntil: "networkidle" })
  await page.waitForTimeout(800)
  await page.locator('input[type="file"]').setInputFiles(
    path.join(repo, "research/e2e-contract-corpus-2026-08-17/files/09-synthetic-saas-msa.pdf"),
  )
  await page.getByRole("button", { name: /continue to review/i }).click()
  await page.locator("#title").waitFor({ timeout: 15_000 })
  await page.locator("#title").fill("Synthetic SaaS Master Services Agreement")
  await page.waitForTimeout(1_200)
  await page.getByRole("button", { name: "Create Contract", exact: true }).click()
  await page.waitForURL(/\/contracts\/[a-z0-9]+$/, { timeout: 30_000 })
  await page.waitForTimeout(2_200)
  await page.screenshot({ path: path.join(outputDir, "aakd-demo-final.png") })
  console.log(`Recorded disposable demo account: ${email}`)
  const video = page.video()
  await context.close()
  if (video) {
    const recordedPath = await video.path()
    fs.copyFileSync(recordedPath, path.join(outputDir, "aakd-workflow.webm"))
  }
} finally {
  await setupContext.close().catch(() => {})
  await browser.close()
  fs.rmSync(authState, { force: true })
}
