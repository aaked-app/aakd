import { expect, test } from "@playwright/test"
import { createTextPdf } from "./pdf-fixture"
import { submitSignup, withSignupBudget } from "./signup-budget"

test("uploaded contract becomes a reviewed action and a recipient-acknowledged brief", async ({ page, browser }, testInfo) => {
  // Regression: renewal and obligation discovery was invisible after upload.
  // Verify upload, human review, action creation, and recipient acknowledgement together.
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

  await page.goto("/register")
  await page.getByLabel("Name").fill("E2E Operations Owner")
  await page.getByLabel("Email").fill(`operations-owner-${suffix}@example.com`)
  await page.getByLabel("Password").fill("E2E-Test-Password-2026!")
  await submitSignup(page)
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
    buffer: createTextPdf([
      "MASTER SERVICES AGREEMENT",
      "Effective Date: January 15, 2025",
      "This agreement automatically renews for successive twelve-month periods unless either party gives 45 days written notice.",
      "Provider shall deliver a monthly service report by the fifth business day of each month.",
      "Customer shall pay each invoice within 30 days.",
      "Governing Law: State of Delaware.",
    ]),
  })
  await page.getByRole("button", { name: /continue to review/i }).click()
  await page.getByLabel(/contract title/i).waitFor()
  await page.getByLabel(/contract title/i).fill("E2E Operations Agreement")
  const intakeResponse = page.waitForResponse(response => response.url().endsWith("/api/contracts/intake") && response.request().method() === "POST")
  await page.getByRole("button", { name: /create contract/i }).click()
  const created = await intakeResponse
  expect(created.status()).toBe(201)
  await expect(page).toHaveURL(
    (url) => /^\/contracts\/[a-z0-9-]+$/.test(url.pathname) && url.pathname !== "/contracts/new",
    { timeout: 30_000 },
  )

  await page.getByRole("tab", { name: /^Review\b/ }).click()
  await expect(page.getByText("autoRenewal", { exact: true })).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText("true", { exact: true })).toBeVisible()
  await expect(page.getByText("45", { exact: true })).toBeVisible()

  await page.getByRole("tab", { name: /^Actions\b/ }).click()
  await expect(page.getByText(/Found \d+ suggestion/)).toBeVisible({ timeout: 90_000 })
  await expect(page.getByText(/monthly service report/i).first()).toBeVisible()

  // Continue to a human-confirmed, owned action, not merely a visible AI result.
  const contractId = new URL(page.url()).pathname.split("/").at(-1)!
  await page.getByRole("button", { name: "Review", exact: true }).first().click()
  const sheet = page.getByRole("dialog")
  const dueDate = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)
  await sheet.locator("#obligation-title").fill("Send monthly service report")
  await sheet.locator("#obligation-due-date").fill(dueDate)
  await sheet.locator("#obligation-assignee").selectOption({ index: 1 })
  const ownerId = await sheet.locator("#obligation-assignee").inputValue()
  const saved = page.waitForResponse(response => response.url().endsWith(`/api/contracts/${contractId}/obligations`) && response.request().method() === "POST")
  await sheet.getByRole("button", { name: /create obligation/i }).click()
  expect((await saved).status()).toBe(201)
  await expect(sheet).not.toBeVisible()
  await page.reload()
  const response = await page.request.get(`/api/actions?contractId=${contractId}`)
  expect(response.status()).toBe(200)
  const { actions } = await response.json()
  const action = actions.find((item: { title: string }) => item.title === "Send monthly service report")
  expect(action).toMatchObject({ assigneeId: ownerId, reviewStatus: "reviewed", sourcePage: 1, dueDate: `${dueDate}T00:00:00.000Z` })
  const detail = await page.request.get(`/api/actions/${action.id}`)
  expect(detail.status()).toBe(200)
  expect((await detail.json()).sourceText).toContain("monthly service report")

  // A separate human account receives the published snapshot, not an owner
  // session masquerading as a recipient. No external email delivery is claimed.
  const baseURL = new URL(page.url()).origin
  const localAuthClientIp = testInfo.project.use.extraHTTPHeaders?.["X-Forwarded-For"]
  const recipientContext = await browser.newContext({
    baseURL,
    extraHTTPHeaders: {
      Origin: baseURL,
      ...(localAuthClientIp ? { "X-Forwarded-For": localAuthClientIp } : {}),
    },
  })
  try {
    const recipientEmail = `brief-recipient-${suffix}@example.com`
    const signup = await withSignupBudget(() => recipientContext.request.post("/api/auth/sign-up/email", { data: {
      name: "E2E Brief Recipient", email: recipientEmail, password: "E2E-Test-Password-2026!",
    } }))
    expect(signup.ok()).toBeTruthy()
    const recipientId = (await signup.json()).user.id
    const invitation = await page.request.post("/api/org/members/invite", { data: { email: recipientEmail, role: "member" } })
    expect(invitation.status()).toBe(201)
    const accepted = await recipientContext.request.post(`/api/org/invitations/${(await invitation.json()).id}/accept`)
    expect(accepted.status()).toBe(200)
    const active = await recipientContext.request.post("/api/auth/organization/set-active", { data: {
      organizationId: (await accepted.json()).organizationId,
    } })
    expect(active.ok()).toBeTruthy()

    await page.goto("/briefs")
    await page.getByLabel("Title", { exact: true }).fill("Monthly reporting handoff")
    await page.getByRole("combobox", { name: "Named recipient", exact: true }).selectOption(recipientId)
    await page.getByRole("checkbox", { name: /Send monthly service report/ }).check()
    const published = page.waitForResponse(response => response.url().endsWith("/api/briefs") && response.request().method() === "POST")
    await page.getByRole("button", { name: "Publish brief", exact: true }).click()
    const publication = await published
    expect(publication.status()).toBe(201)
    const publishedLink = page.getByRole("link", { name: "Monthly reporting handoff", exact: true })
    await expect(publishedLink).toBeVisible()
    const briefId = (await publishedLink.getAttribute("href"))!.split("/").at(-1)!
    const loadedBrief = page.waitForResponse(response => response.url().endsWith(`/api/briefs/${briefId}`) && response.request().method() === "GET")
    await publishedLink.click()
    expect((await loadedBrief).status()).toBe(200)
    await expect(page.getByRole("heading", { name: "Monthly reporting handoff", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "Acknowledge brief", exact: true })).toHaveCount(0)
    expect((await page.request.patch(`/api/briefs/${briefId}`)).status()).toBe(404)

    const recipientPage = await recipientContext.newPage()
    await recipientPage.goto(`/briefs/${briefId}`)
    const recipientTourSkip = recipientPage.getByRole("button", { name: "Skip", exact: true })
    await expect(recipientTourSkip).toBeVisible()
    await recipientTourSkip.click()
    await expect(recipientPage.getByRole("heading", { name: "Send monthly service report", exact: true })).toBeVisible()
    await expect(recipientPage.locator("blockquote")).toContainText("monthly service report")
    await recipientPage.getByRole("button", { name: "Acknowledge brief", exact: true }).click()
    await expect(recipientPage.getByRole("status").filter({ hasText: "Acknowledged" })).toBeVisible()
    await recipientPage.reload()
    await expect(recipientPage.getByRole("status").filter({ hasText: "Acknowledged" })).toBeVisible()
    const firstAck = await (await recipientContext.request.get(`/api/briefs/${briefId}`)).json()
    const repeated = await recipientContext.request.patch(`/api/briefs/${briefId}`)
    expect(repeated.status()).toBe(200)
    expect(await repeated.json()).toMatchObject({ alreadyAcknowledged: true, acknowledgedAt: firstAck.acknowledgedAt })
    await testInfo.attach("recipient-acknowledged-brief", { body: await recipientPage.screenshot({ fullPage: true }), contentType: "image/png" })
  } finally {
    await recipientContext.close()
  }
})
