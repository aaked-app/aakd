import { describe, it, expect } from "vitest"

/**
 * Pure helper that mirrors the alert-generation logic in lib/alerts/generate.ts
 * without touching Prisma. Tests cover the date-math and filtering rules.
 */
function computeAlerts(
  endDate: Date | null,
  renewalDate: Date | null,
  noticePeriodDays: number | null,
  now = new Date()
): { alertType: string; triggerDate: Date }[] {
  const alerts: { alertType: string; triggerDate: Date }[] = []

  if (endDate && endDate > now) {
    const offsets = [
      { type: "EXPIRY_90", days: 90 },
      { type: "EXPIRY_30", days: 30 },
      { type: "EXPIRY_7",  days: 7 },
    ]
    for (const { type, days } of offsets) {
      const triggerDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)
      if (triggerDate > now) alerts.push({ alertType: type, triggerDate })
    }
  }

  if (renewalDate && renewalDate > now) {
    const triggerDate = new Date(renewalDate.getTime() - 14 * 24 * 60 * 60 * 1000)
    if (triggerDate > now) alerts.push({ alertType: "RENEWAL_DUE", triggerDate })
  }

  if (noticePeriodDays != null && endDate && endDate > now) {
    const triggerDate = new Date(endDate.getTime() - noticePeriodDays * 24 * 60 * 60 * 1000)
    if (triggerDate > now) alerts.push({ alertType: "NOTICE_PERIOD", triggerDate })
  }

  return alerts
}

/** Returns a Date that is `days` days from now */
function daysFromNow(days: number): Date {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000)
}

describe("computeAlerts — expiry alerts from endDate", () => {
  it("produces all three expiry alerts when endDate is >90 days away", () => {
    const endDate = daysFromNow(100)
    const alerts = computeAlerts(endDate, null, null)
    const types = alerts.map((a) => a.alertType)
    expect(types).toContain("EXPIRY_90")
    expect(types).toContain("EXPIRY_30")
    expect(types).toContain("EXPIRY_7")
  })

  it("skips EXPIRY_90 when endDate is 60 days away", () => {
    const endDate = daysFromNow(60)
    const alerts = computeAlerts(endDate, null, null)
    const types = alerts.map((a) => a.alertType)
    expect(types).not.toContain("EXPIRY_90")
    expect(types).toContain("EXPIRY_30")
    expect(types).toContain("EXPIRY_7")
  })

  it("produces no alerts when endDate is in the past", () => {
    const endDate = new Date(Date.now() - 1000)
    const alerts = computeAlerts(endDate, null, null)
    expect(alerts).toHaveLength(0)
  })

  it("produces no alerts when endDate is null", () => {
    const alerts = computeAlerts(null, null, null)
    expect(alerts).toHaveLength(0)
  })

  it("EXPIRY_90 triggerDate is exactly endDate minus 90 days", () => {
    const endDate = daysFromNow(100)
    const alerts = computeAlerts(endDate, null, null)
    const expiry90 = alerts.find((a) => a.alertType === "EXPIRY_90")!
    const expected = new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000)
    expect(expiry90.triggerDate.getTime()).toBe(expected.getTime())
  })
})

describe("computeAlerts — renewal due alert", () => {
  it("creates RENEWAL_DUE alert 14 days before renewalDate", () => {
    const renewalDate = daysFromNow(30)
    const alerts = computeAlerts(null, renewalDate, null)
    const renewal = alerts.find((a) => a.alertType === "RENEWAL_DUE")
    expect(renewal).toBeDefined()
    const expected = new Date(renewalDate.getTime() - 14 * 24 * 60 * 60 * 1000)
    expect(renewal!.triggerDate.getTime()).toBe(expected.getTime())
  })

  it("skips RENEWAL_DUE when triggerDate (renewalDate - 14 days) is in the past", () => {
    const renewalDate = daysFromNow(10) // 10 days from now — trigger would be -4 days
    const alerts = computeAlerts(null, renewalDate, null)
    const renewal = alerts.find((a) => a.alertType === "RENEWAL_DUE")
    expect(renewal).toBeUndefined()
  })

  it("skips RENEWAL_DUE when renewalDate is in the past", () => {
    const renewalDate = new Date(Date.now() - 1000)
    const alerts = computeAlerts(null, renewalDate, null)
    expect(alerts).toHaveLength(0)
  })
})

describe("computeAlerts — notice period alert", () => {
  it("creates NOTICE_PERIOD alert at endDate minus noticePeriodDays", () => {
    const endDate = daysFromNow(100)
    const alerts = computeAlerts(endDate, null, 45)
    const notice = alerts.find((a) => a.alertType === "NOTICE_PERIOD")
    expect(notice).toBeDefined()
    const expected = new Date(endDate.getTime() - 45 * 24 * 60 * 60 * 1000)
    expect(notice!.triggerDate.getTime()).toBe(expected.getTime())
  })

  it("skips NOTICE_PERIOD when endDate is null", () => {
    const alerts = computeAlerts(null, null, 30)
    expect(alerts.find((a) => a.alertType === "NOTICE_PERIOD")).toBeUndefined()
  })

  it("skips NOTICE_PERIOD when its triggerDate would be in the past", () => {
    // endDate is 10 days away, noticePeriodDays = 20 → trigger = -10 days
    const endDate = daysFromNow(10)
    const alerts = computeAlerts(endDate, null, 20)
    expect(alerts.find((a) => a.alertType === "NOTICE_PERIOD")).toBeUndefined()
  })
})

describe("computeAlerts — combined", () => {
  it("returns all applicable alert types when all fields are set", () => {
    const endDate = daysFromNow(100)
    const renewalDate = daysFromNow(60)
    const alerts = computeAlerts(endDate, renewalDate, 45)
    const types = alerts.map((a) => a.alertType)
    expect(types).toContain("EXPIRY_90")
    expect(types).toContain("EXPIRY_30")
    expect(types).toContain("EXPIRY_7")
    expect(types).toContain("RENEWAL_DUE")
    expect(types).toContain("NOTICE_PERIOD")
  })

  it("is idempotent with respect to time (same now → same output)", () => {
    const now = new Date()
    const endDate = daysFromNow(100)
    const a = computeAlerts(endDate, null, null, now)
    const b = computeAlerts(endDate, null, null, now)
    expect(a).toEqual(b)
  })
})
