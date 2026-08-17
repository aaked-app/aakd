import { expect, test } from "@playwright/test"
import React from "react"
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer"

async function createOperationsPdf() {
  return Buffer.from(
    await renderToBuffer(
      React.createElement(
        Document,
        null,
        React.createElement(
          Page,
          null,
          React.createElement(
            Text,
            null,
            "MASTER SERVICES AGREEMENT\nEffective Date: January 15, 2025\nThis agreement automatically renews for successive twelve-month periods unless either party gives 45 days written notice.\nProvider shall deliver a monthly service report by the fifth business day of each month.\nCustomer shall pay each invoice within 30 days.\nGoverning Law: State of Delaware.",
          ),
        ),
      ),
    ),
  )
}

test("uploaded contract exposes renewal facts and starts obligation review", async ({ page }) => {
  // Regression: renewal and obligation discovery was invisible after upload.
  // Found by /qa on 2026-08-17.
  // Report: .gstack/qa-reports/qa-report-localhost-2026-08-17.md
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await page.goto("/register")
  await page.getByLabel("Name").fill("E2E Operations Owner")
  await page.getByLabel("Email").fill(`operations-owner-${suffix}@example.com`)
  await page.getByLabel("Password").fill("E2E-Test-Password-2026!")
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL(/\/create-org/, { timeout: 30_000 })

  await page.getByLabel("Organization name").fill(`E2E Operations ${suffix}`)
  await page.getByRole("button", { name: "Create organization" }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 30_000 })
  await page.getByRole("link", { name: "Skip for now" }).click()
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 30_000 })

  const tourSkip = page.getByRole("button", { name: "Skip", exact: true })
  if (await tourSkip.isVisible().catch(() => false)) await tourSkip.click()
  const acceptCookies = page.getByRole("button", { name: "Accept", exact: true })
  if (await acceptCookies.isVisible().catch(() => false)) await acceptCookies.click()

  await page.goto("/contracts/new")
  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-operations-agreement.pdf",
    mimeType: "application/pdf",
    buffer: await createOperationsPdf(),
  })
  await page.getByRole("button", { name: /continue to review/i }).click()
  await page.getByLabel(/contract title/i).waitFor()
  await page.getByLabel(/contract title/i).fill("E2E Operations Agreement")
  await page.getByRole("button", { name: "Create Contract", exact: true }).click()
  await expect(page).toHaveURL(
    (url) => /^\/contracts\/[a-z0-9]+$/.test(url.pathname) && url.pathname !== "/contracts/new",
    { timeout: 30_000 },
  )

  await page.getByRole("tab", { name: /AI Extractions/i }).click()
  await expect(page.getByText("autoRenewal", { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText("true", { exact: true })).toBeVisible()
  await expect(page.getByText("45", { exact: true })).toBeVisible()

  await page.getByRole("tab", { name: "Obligations", exact: true }).click()
  await expect(page.getByText(/AI found \d+ suggestion/)).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/monthly service report/i).first()).toBeVisible()
})
