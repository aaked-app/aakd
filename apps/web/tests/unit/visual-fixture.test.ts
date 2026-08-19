import { describe, expect, it } from "vitest"

import {
  assertVisualFixtureEnabled,
  buildVisualFixtureData,
  VISUAL_FIXTURE_IDS,
} from "../e2e/visual-fixture"

describe("visual fixture safety", () => {
  it("refuses to run in production even when explicitly enabled", () => {
    expect(() =>
      assertVisualFixtureEnabled({
        NODE_ENV: "production",
        AAKD_VISUAL_FIXTURE: "1",
      }),
    ).toThrow("Visual fixtures are forbidden in production")
  })

  it("refuses to run without the explicit visual-fixture flag", () => {
    expect(() => assertVisualFixtureEnabled({ NODE_ENV: "test" })).toThrow(
      "AAKD_VISUAL_FIXTURE=1",
    )
  })
})

describe("visual fixture records", () => {
  it("builds the exact deterministic portfolio without persisting a plaintext password", () => {
    const fixture = buildVisualFixtureData("better-auth-password-hash")

    expect(fixture.organization.id).toBe("e2e-visual-org")
    expect(fixture.users.map((user) => user.id)).toEqual([
      "e2e-visual-user-owner",
      "e2e-visual-user-legal",
      "e2e-visual-user-viewer",
      "e2e-visual-user-no-organization",
    ])
    expect(fixture.members.map((member) => member.role)).toEqual([
      "owner",
      "legal",
      "viewer",
    ])
    expect(fixture.contracts).toHaveLength(6)
    expect(fixture.obligations).toHaveLength(5)
    expect(fixture.actions).toHaveLength(2)
    expect(fixture.actions[0]).toEqual(expect.objectContaining({
      id: VISUAL_FIXTURE_IDS.actions[0],
      sourceText: "Either party may terminate by giving at least 30 days' written notice.",
      reviewStatus: "reviewed",
      evidenceRequired: "completion_note",
    }))
    expect(fixture.activities).toHaveLength(6)
    expect(fixture.accounts).toEqual([
      expect.objectContaining({
        id: VISUAL_FIXTURE_IDS.ownerAccount,
        userId: VISUAL_FIXTURE_IDS.owner,
        providerId: "credential",
        password: "better-auth-password-hash",
      }),
      expect.objectContaining({
        id: VISUAL_FIXTURE_IDS.noOrganizationAccount,
        userId: VISUAL_FIXTURE_IDS.noOrganization,
        providerId: "credential",
        password: "better-auth-password-hash",
      }),
    ])
    expect(JSON.stringify(fixture)).not.toContain("Visual-Test-Password")

    const dates = JSON.stringify(fixture).match(/20\d\d-\d\d-\d\dT[^\"]+/g) ?? []
    expect(new Set(dates).size).toBeGreaterThan(1)
    expect(dates.every((value) => value.endsWith("Z"))).toBe(true)
  })
})
