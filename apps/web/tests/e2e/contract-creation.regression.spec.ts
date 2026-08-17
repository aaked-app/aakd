import { expect, test } from "@playwright/test"
import React from "react"
import { Document, Page, Text, renderToBuffer } from "@react-pdf/renderer"

async function createContractPdf() {
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
            "MASTER SERVICES AGREEMENT\nEffective Date: January 15, 2025\nThis agreement automatically renews unless either party gives 30 days prior written notice.\nGoverning Law: State of Delaware.",
          ),
        ),
      ),
    ),
  )
}

test("new users can create and open a contract", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await page.goto("/register")
  await page.getByLabel("Name").fill("E2E Contract Owner")
  await page.getByLabel("Email").fill(`contract-owner-${suffix}@example.com`)
  await page.getByLabel("Password").fill("E2E-Test-Password-2026!")
  await page.getByRole("button", { name: "Create account" }).click()
  await expect(page).toHaveURL(/\/create-org/, { timeout: 15_000 })

  await page.getByLabel("Organization name").fill(`E2E Contracts ${suffix}`)
  await page.getByRole("button", { name: "Create organization" }).click()
  await expect(page).toHaveURL(/\/onboarding/, { timeout: 15_000 })
  await page.getByRole("link", { name: "Skip for now" }).click()
  await expect(page).toHaveURL(/\/dashboard/)

  const tourSkip = page.getByRole("button", { name: "Skip", exact: true })
  if (await tourSkip.isVisible().catch(() => false)) await tourSkip.click()
  const acceptCookies = page.getByRole("button", { name: "Accept", exact: true })
  if (await acceptCookies.isVisible().catch(() => false)) await acceptCookies.click()

  // Navigation itself is covered by contracts.spec. Go directly here so this
  // regression remains focused on the new-account contract workflow rather
  // than the dashboard's still-loading quick action.
  await page.goto("/contracts/new")
  await expect(page).toHaveURL(/\/contracts\/new/)
  await page.locator('input[type="file"]').setInputFiles({
    name: "e2e-service-agreement.pdf",
    mimeType: "application/pdf",
    buffer: await createContractPdf(),
  })
  await page.getByRole("button", { name: /continue to review/i }).click()
  await page.getByLabel(/contract title/i).waitFor()
  await page.getByLabel(/contract title/i).fill("E2E Service Agreement")
  await page.getByRole("button", { name: "Create Contract", exact: true }).click()

  await expect(page).toHaveURL((url) =>
    /^\/contracts\/[a-z0-9]+$/.test(url.pathname) && url.pathname !== "/contracts/new",
  { timeout: 30_000 })

  await page.getByRole("tab", { name: /AI Extractions/i }).click()
  await expect(page.getByText("MASTER SERVICES AGREEMENT", { exact: true })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByText("Effective Date: January 15, 2025", { exact: true })).toBeVisible()
  await expect(page.getByText("Source page 1", { exact: true }).first()).toBeVisible()
})
