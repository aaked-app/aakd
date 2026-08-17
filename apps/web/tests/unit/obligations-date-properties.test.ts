import fc from "fast-check"
import { afterEach, describe, expect, it } from "vitest"

import {
  formatDate,
  isOverdue,
  isThisQuarter,
  isWithinDays,
} from "@/app/(app)/obligations/portfolio-helpers"
import type { ObligationStatus } from "@/components/obligations/types"

const originalTimeZone = process.env.TZ
const HOST_TIME_ZONES = ["UTC", "America/Los_Angeles", "Pacific/Kiritimati"]
const DAY_MS = 86_400_000
const STATUS_CASES = {
  PENDING: true,
  IN_PROGRESS: true,
  COMPLETED: true,
  OVERDUE: true,
} satisfies Record<ObligationStatus, true>
const STATUSES = Object.keys(STATUS_CASES) as ObligationStatus[]

afterEach(() => {
  if (originalTimeZone === undefined) delete process.env.TZ
  else process.env.TZ = originalTimeZone
})

describe("obligation UTC date helpers", () => {
  it("never throws or classifies generated invalid date strings", () => {
    fc.assert(fc.property(fc.stringOf(fc.constantFrom("x", "y", "z", "!")), (suffix) => {
      const invalid = `not-a-date-${suffix}`
      const now = new Date("2026-08-17T12:00:00.000Z")

      expect(() => formatDate(invalid, "en-US")).not.toThrow()
      expect(formatDate(invalid, "en-US")).toBe("—")
      expect(isWithinDays(invalid, 7, now)).toBe(false)
      expect(isThisQuarter(invalid, now)).toBe(false)
    }))
  })

  it("preserves a generated UTC calendar date across host time zones", () => {
    fc.assert(fc.property(
      fc.date({
        min: new Date("2000-01-01T00:00:00.000Z"),
        max: new Date("2099-12-31T23:59:59.999Z"),
        noInvalidDate: true,
      }),
      (generated) => {
        const value = new Date(Date.UTC(
          generated.getUTCFullYear(),
          generated.getUTCMonth(),
          generated.getUTCDate(),
        )).toISOString()
        const outputs = HOST_TIME_ZONES.map((timeZone) => {
          process.env.TZ = timeZone
          return formatDate(value, "en-US")
        })

        expect(new Set(outputs).size).toBe(1)
      },
    ))
  })

  it("keeps generated due-window and UTC-quarter classifications deterministic", () => {
    fc.assert(fc.property(
      fc.date({
        min: new Date("2000-01-01T00:00:00.000Z"),
        max: new Date("2099-12-31T23:59:59.999Z"),
        noInvalidDate: true,
      }),
      fc.integer({ min: -120 * DAY_MS, max: 120 * DAY_MS }),
      fc.integer({ min: 0, max: 120 }),
      (generatedNow, offsetMs, days) => {
        const nowValue = generatedNow.toISOString()
        const dueValue = new Date(generatedNow.getTime() + offsetMs).toISOString()
        const expectedWindow = offsetMs > 0 && offsetMs <= days * DAY_MS

        const classifications = HOST_TIME_ZONES.map((timeZone) => {
          process.env.TZ = timeZone
          const now = new Date(nowValue)
          return {
            withinDays: isWithinDays(dueValue, days, now),
            thisQuarter: isThisQuarter(dueValue, now),
          }
        })

        expect(classifications.every(({ withinDays }) => withinDays === expectedWindow)).toBe(true)
        expect(classifications.every(({ thisQuarter }) => thisQuarter === classifications[0].thisQuarter)).toBe(true)
      },
    ))
  })

  it("classifies generated overdue boundaries for every status and rejects invalid actionable dates", () => {
    fc.assert(fc.property(
      fc.date({
        min: new Date("2000-01-01T00:00:00.000Z"),
        max: new Date("2099-12-31T23:59:59.999Z"),
        noInvalidDate: true,
      }),
      fc.nat().map((value) => value + 1),
      fc.integer({ min: 13, max: 99 }),
      fc.integer({ min: 32, max: 99 }),
      (generatedNow, deltaMs, invalidMonth, invalidDay) => {
        const now = new Date(generatedNow.toISOString())
        const exactNow = now.toISOString()
        const beforeNow = new Date(now.getTime() - deltaMs).toISOString()
        const afterNow = new Date(now.getTime() + deltaMs).toISOString()
        const invalidDate = `2026-${invalidMonth}-${invalidDay}T00:00:00.000Z`

        for (const status of STATUSES) {
          const statusForcesOverdue = status === "OVERDUE"
          const canBecomeOverdue = status === "PENDING" || status === "IN_PROGRESS"

          expect(isOverdue({ status, dueDate: invalidDate }, now)).toBe(statusForcesOverdue)
          expect(isOverdue({ status, dueDate: exactNow }, now)).toBe(statusForcesOverdue)
          expect(isOverdue({ status, dueDate: beforeNow }, now)).toBe(
            statusForcesOverdue || canBecomeOverdue,
          )
          expect(isOverdue({ status, dueDate: afterNow }, now)).toBe(statusForcesOverdue)
        }
      },
    ))
  })
})
