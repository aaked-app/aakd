import { expect, test, type Page, type TestInfo } from "@playwright/test"

import en from "@/messages/en.json"
import ar from "@/messages/ar.json"
import { VISUAL_AUTH_STATE, VISUAL_FIXTURE_IDS, VISUAL_NO_ORG_AUTH_STATE } from "./visual-constants"

type AppLocale = "en" | "ar"
type Messages = Record<string, unknown>
type RouteCheck = {
  name: string
  path: string
  headingKey?: string
  heading?: Record<AppLocale, string>
  requiresPrimaryControl?: boolean
  readyText?: string
}

const messages = { en, ar } satisfies Record<AppLocale, Messages>
const seededContractId = VISUAL_FIXTURE_IDS.contracts[0]
const seededObligationId = VISUAL_FIXTURE_IDS.obligations[0]
const seededActionId = VISUAL_FIXTURE_IDS.actions[0]

const priorityZero: RouteCheck[] = [
  { name: "landing", path: "/" },
  { name: "login", path: "/login", headingKey: "auth.login" },
]

const priorityOne: RouteCheck[] = [
  { name: "dashboard", path: "/dashboard", readyText: "Woodgrove Customer Agreement" },
  { name: "contracts", path: "/contracts", headingKey: "contracts.title", readyText: "Northwind Services Agreement" },
  { name: "contract-detail", path: `/contracts/${seededContractId}`, heading: { en: "Northwind Services Agreement", ar: "Northwind Services Agreement" } },
  { name: "contract-new", path: "/contracts/new" },
  { name: "obligations", path: "/obligations", headingKey: "obligations.title", readyText: "Send non-renewal notice" },
  { name: "obligation-detail", path: `/contracts/${seededContractId}/obligations/${seededObligationId}`, heading: { en: "Send non-renewal notice", ar: "Send non-renewal notice" } },
  { name: "actions", path: "/actions", headingKey: "actionQueue.title", readyText: "Send non-renewal notice" },
  { name: "action-detail", path: `/actions/${seededActionId}`, heading: { en: "Send non-renewal notice", ar: "Send non-renewal notice" } },
  { name: "renewals", path: "/renewals", headingKey: "renewals.title", readyText: "Northwind Services Agreement" },
  { name: "analytics", path: "/analytics", headingKey: "analytics.title" },
  { name: "search", path: "/search?q=Northwind", readyText: "Northwind Services Agreement" },
  { name: "onboarding", path: "/onboarding", headingKey: "onboarding.title" },
]

const phaseOneActionJourney: RouteCheck[] = [
  { name: "action-dashboard", path: "/dashboard", readyText: "Send non-renewal notice" },
  { name: "action-queue", path: "/actions", headingKey: "actionQueue.title", readyText: "Send non-renewal notice" },
  { name: "action-detail", path: `/actions/${seededActionId}`, heading: { en: "Send non-renewal notice", ar: "Send non-renewal notice" } },
  { name: "action-confirmation", path: `/contracts/${seededContractId}`, heading: { en: "Northwind Services Agreement", ar: "Northwind Services Agreement" }, readyText: "Send non-renewal notice" },
]

const priorityTwoAuthenticated: RouteCheck[] = [
  { name: "settings-org", path: "/settings/org" },
  { name: "settings-members", path: "/settings/members", headingKey: "members.title", readyText: "E2E Visual Owner" },
  { name: "settings-integrations", path: "/settings/integrations" },
  { name: "settings-profile", path: "/settings/profile" },
  { name: "settings-api-keys", path: "/settings/api-keys", headingKey: "settings.apiKeys.title" },
  { name: "settings-audit-log", path: "/settings/audit-log" },
  { name: "settings-import", path: "/settings/import" },
  { name: "settings-notifications", path: "/settings/notifications" },
  { name: "settings-profile-notifications", path: "/settings/profile/notifications" },
  { name: "create-org", path: "/create-org", headingKey: "auth.createOrgTitle" },
]

const priorityTwoPublic: RouteCheck[] = [
  { name: "register", path: "/register", headingKey: "auth.register" },
  { name: "forgot-password", path: "/forgot-password", headingKey: "auth.forgotPasswordTitle" },
  { name: "reset-password", path: "/reset-password", headingKey: "auth.invalidLinkTitle" },
  { name: "accept-invitation", path: "/accept-invitation", requiresPrimaryControl: false },
]

function localeFor(testInfo: TestInfo): AppLocale {
  const locale = testInfo.project.metadata.appLocale
  if (locale !== "en" && locale !== "ar") throw new Error(`Unsupported visual locale: ${String(locale)}`)
  return locale
}

function messageAt(locale: AppLocale, key: string): string {
  let value: unknown = messages[locale]
  for (const segment of key.split(".")) {
    if (!value || typeof value !== "object") throw new Error(`Missing ${locale} message: ${key}`)
    value = (value as Messages)[segment]
  }
  if (typeof value !== "string") throw new Error(`Missing ${locale} message: ${key}`)
  return value
}

async function expectPrimaryControlInViewport(page: Page) {
  const controlSelectors = [
    "button:not([disabled]):not([aria-hidden='true']):not([tabindex='-1'])",
    "a[href]:not([aria-hidden='true']):not([tabindex='-1'])",
    "input:not([disabled]):not([type='hidden']):not([type='file']):not([aria-hidden='true']):not([tabindex='-1'])",
    "select:not([disabled]):not([aria-hidden='true']):not([tabindex='-1'])",
    "textarea:not([disabled]):not([aria-hidden='true']):not([tabindex='-1'])",
    "[role='button']:not([aria-disabled='true']):not([aria-hidden='true']):not([tabindex='-1'])",
    "[role='link']:not([aria-disabled='true']):not([aria-hidden='true']):not([tabindex='-1'])",
    "[role='checkbox']:not([aria-disabled='true']):not([aria-hidden='true']):not([tabindex='-1'])",
    "[role='radio']:not([aria-disabled='true']):not([aria-hidden='true']):not([tabindex='-1'])",
    "[role='combobox']:not([aria-disabled='true']):not([aria-hidden='true']):not([tabindex='-1'])",
  ]
  const scopedSelector = ["main", "form"]
    .flatMap((root) => controlSelectors.map((selector) => `${root} ${selector}`))
    .join(", ")
  const pageSelector = controlSelectors.join(", ")
  const scopedPrimary = page.locator(scopedSelector).filter({ visible: true }).first()
  const primary = await scopedPrimary.count()
    ? scopedPrimary
    : page.locator(pageSelector).filter({ visible: true }).first()
  await expect(primary).toBeVisible()
  const box = await primary.boundingBox()
  const viewport = page.viewportSize()
  expect(box).not.toBeNull()
  expect(viewport).not.toBeNull()
  expect(box!.x).toBeGreaterThanOrEqual(0)
  expect(box!.y).toBeGreaterThanOrEqual(0)
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width)
  expect(box!.y).toBeLessThan(viewport!.height)
  await primary.focus()
  await expect(primary).toBeFocused()
}

async function verifyRoute(page: Page, testInfo: TestInfo, route: RouteCheck) {
  const errors: string[] = []
  const serverErrors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text())
  })
  page.on("response", (response) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`)
  })

  const locale = localeFor(testInfo)
  const routeExpect = expect.configure({ timeout: testInfo.timeout })
  await page.addInitScript(() => {
    localStorage.setItem("cf_onboarding_done", "1")
  })
  await page.context().addCookies([
    {
      name: "NEXT_LOCALE",
      value: locale,
      url: testInfo.project.use.baseURL ?? "http://localhost:3000",
    },
  ])
  await page.goto(route.path, { waitUntil: "domcontentloaded" })

  await routeExpect(page.locator("html")).toHaveAttribute("lang", locale)
  await routeExpect(page.locator("html")).toHaveAttribute("dir", locale === "ar" ? "rtl" : "ltr")
  const heading = page.getByRole("heading", { level: 1 }).first()
  await routeExpect(heading).toBeVisible()
  if (route.headingKey) await routeExpect(heading).toContainText(messageAt(locale, route.headingKey))
  if (route.heading) await routeExpect(heading).toContainText(route.heading[locale])
  if (route.readyText) {
    await routeExpect(page.getByText(route.readyText).filter({ visible: true }).first()).toBeVisible()
  }

  const rootWidths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }))
  expect(rootWidths.document).toBeLessThanOrEqual(rootWidths.viewport)
  expect(rootWidths.body).toBeLessThanOrEqual(rootWidths.viewport)
  if (route.requiresPrimaryControl !== false) await expectPrimaryControlInViewport(page)
  expect(serverErrors).toEqual([])
  expect(errors).toEqual([])

  await page.screenshot({
    path: testInfo.outputPath(`${route.name}.png`),
    fullPage: true,
    animations: "disabled",
    caret: "hide",
    scale: "css",
  })
}

test.describe("Priority 0 public visual matrix", () => {
  for (const route of priorityZero) {
    test(route.name, async ({ page }, testInfo) => {
      await verifyRoute(page, testInfo, route)
      if (route.path === "/") {
        await expect(page.getByText(/cookies/i)).toBeVisible()
      }
    })
  }
})

test.describe("Priority 1 seeded visual matrix", () => {
  test.use({ storageState: VISUAL_AUTH_STATE })
  for (const route of priorityOne) {
    test(route.name, async ({ page }, testInfo) => verifyRoute(page, testInfo, route))
  }

  test("contract-detail operational tabs", async ({ page }, testInfo) => {
    const errors: string[] = []
    const serverErrors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text())
    })
    page.on("response", (response) => {
      if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`)
    })
    await verifyRoute(page, testInfo, {
      name: "contract-detail-tabs",
      path: `/contracts/${seededContractId}`,
      heading: { en: "Northwind Services Agreement", ar: "Northwind Services Agreement" },
    })

    const locale = localeFor(testInfo)
    const tabs: Array<{ tab: string; heading: string }> = [
      { tab: "files", heading: "filesTitle" },
      { tab: "review", heading: "reviewTitle" },
      { tab: "approvals", heading: "approvalsTitle" },
      { tab: "actionsTab", heading: "actionsTitle" },
      { tab: "risk", heading: "riskTitle" },
    ]

    for (const item of tabs) {
      const tabLabel = messageAt(locale, `contract.workspace.${item.tab}`)
      await page.getByRole("tab", { name: tabLabel }).click()
      await expect(page.getByRole("heading", {
        level: 2,
        name: messageAt(locale, `contract.workspace.${item.heading}`),
      })).toBeVisible()
      const widths = await page.evaluate(() => ({
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
      }))
      expect(widths.document).toBeLessThanOrEqual(widths.viewport)
    }

    expect(serverErrors).toEqual([])
    expect(errors).toEqual([])
  })
})

test.describe("No-organization activation shell visual proof", () => {
  test.use({ storageState: VISUAL_NO_ORG_AUTH_STATE })

  test("gives a new user a clear workspace setup path", async ({ page }, testInfo) => {
    await verifyRoute(page, testInfo, {
      name: "no-organization-shell",
      path: "/dashboard",
      headingKey: "nav.workspaceSetupTitle",
    })

    const locale = localeFor(testInfo)
    await expect(page.getByRole("list", {
      name: messageAt(locale, "nav.workspaceSetupSteps"),
    })).toBeVisible()
    await expect(page.getByRole("button", {
      name: messageAt(locale, "nav.createWorkspace"),
    })).toBeVisible()
  })
})

test.describe("Phase 1 Action Journey visual proof", () => {
  test.use({ storageState: VISUAL_AUTH_STATE })
  for (const route of phaseOneActionJourney) {
    test(route.name, async ({ page }, testInfo) => verifyRoute(page, testInfo, route))
  }
})

test.describe("Phase 1 Action Journey E2E", () => {
  test.use({ storageState: VISUAL_AUTH_STATE })
  test("review, assign, deliver a deep link, record evidence and complete", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "en-desktop", "One deterministic stateful journey is sufficient")
    await page.addInitScript(() => localStorage.setItem("cf_onboarding_done", "1"))
    await page.context().addCookies([{ name: "NEXT_LOCALE", value: "en", url: testInfo.project.use.baseURL ?? "http://localhost:3000" }])
    const actionPath = `/actions/${seededActionId}`
    await page.goto(actionPath)
    await expect(page.getByRole("heading", { level: 1, name: "Send non-renewal notice" })).toBeVisible()
    await expect(page.getByText("Either party may terminate by giving at least 30 days' written notice.")).toBeVisible()

    await page.getByRole("combobox", { name: "Owner" }).selectOption(VISUAL_FIXTURE_IDS.legal)
    await page.getByRole("button", { name: "Save owner" }).click()
    await expect(page.getByRole("status")).toContainText("Owner updated")

    const delivery = page.waitForResponse((response) => response.url().endsWith(`/api/actions/${seededActionId}/deliver`) && response.request().method() === "POST")
    await page.getByRole("button", { name: "Send cited email" }).click()
    expect((await delivery).status()).toBe(202)
    await expect(page.getByRole("status")).toContainText("queued")

    await page.goto(actionPath)
    await page.getByRole("textbox", { name: "Completion evidence" }).fill("Notice draft reviewed and retained")
    await page.getByRole("button", { name: "Add evidence" }).click()
    await expect(page.getByText("Notice draft reviewed and retained")).toBeVisible()
    await page.getByRole("button", { name: "Acknowledge" }).click()
    await page.getByRole("button", { name: "Start work" }).click()
    await page.getByRole("button", { name: "Complete" }).click()
    await expect(page.getByText("Completed", { exact: true }).first()).toBeVisible()
    await expect(page).toHaveURL(new RegExp(`${actionPath}$`))
  })
})

test.describe("Priority 2 authenticated visual matrix", () => {
  test.use({ storageState: VISUAL_AUTH_STATE })
  for (const route of priorityTwoAuthenticated) {
    test(route.name, async ({ page }, testInfo) => verifyRoute(page, testInfo, route))
  }
})

test.describe("Priority 2 public visual matrix", () => {
  for (const route of priorityTwoPublic) {
    test(route.name, async ({ page }, testInfo) => verifyRoute(page, testInfo, route))
  }
})

test.describe("paused template routes", () => {
  test.use({ storageState: VISUAL_AUTH_STATE })
  for (const path of ["/templates", "/templates/new", "/templates/e2e-visual/edit"]) {
    test(`${path} redirects without loading template APIs`, async ({ page }) => {
      const templateRequests: string[] = []
      page.on("request", (request) => {
        if (new URL(request.url()).pathname.startsWith("/api/templates")) templateRequests.push(request.url())
      })
      await page.goto(path, { waitUntil: "networkidle" })
      await expect(page).toHaveURL(/\/dashboard$/)
      expect(templateRequests).toEqual([])
    })
  }
})
