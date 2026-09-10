import { expect, test } from "@playwright/test"
import { createTextPdf } from "./pdf-fixture"
import { submitSignup } from "./signup-budget"

test("new users can create and open a contract", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await page.goto("/register")
  await page.getByLabel("Name").fill("E2E Contract Owner")
  await page.getByLabel("Email").fill(`contract-owner-${suffix}@example.com`)
  await page.getByLabel("Password").fill("E2E-Test-Password-2026!")
  await submitSignup(page)
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
    buffer: createTextPdf([
      "MASTER SERVICES AGREEMENT",
      "Effective Date: January 15, 2025",
      "This agreement automatically renews unless either party gives 30 days prior written notice.",
      "Governing Law: State of Delaware.",
    ]),
  })
  await page.getByRole("button", { name: /continue to review/i }).click()
  await page.getByLabel(/contract title/i).waitFor()
  await page.getByLabel(/contract title/i).fill("E2E Service Agreement")
  const intakeResponse = page.waitForResponse(response => response.url().endsWith("/api/contracts/intake") && response.request().method() === "POST")
  await page.getByRole("button", { name: /create contract/i }).click()
  const created = await intakeResponse
  expect(created.status()).toBe(201)
  // Intake uses UUIDs; legacy contract creation used alphanumeric CUIDs.
  // Do not read a discarded response body after full-page navigation.
  await expect(page).toHaveURL(url => /^\/contracts\/[a-z0-9-]+$/.test(url.pathname) && url.pathname !== "/contracts/new", { timeout: 30_000 })

  await page.getByRole("tab", { name: /^Review\b/ }).click()
  await expect(page.getByText("MASTER SERVICES AGREEMENT", { exact: true })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByText("Effective Date: January 15, 2025", { exact: true })).toBeVisible()
  await expect(page.getByText("Source page 1", { exact: true }).first()).toBeVisible()
})
