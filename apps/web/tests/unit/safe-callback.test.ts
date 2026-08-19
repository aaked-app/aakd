import { describe, expect, it } from "vitest"

import { safeCallbackPath } from "@/lib/auth/safe-callback"

describe("safeCallbackPath", () => {
  it.each([
    ["/dashboard", "/dashboard"],
    ["/accept-invitation?id=invite-1", "/accept-invitation?id=invite-1"],
    ["/accept-invitation?id=invite-1#review", "/accept-invitation?id=invite-1#review"],
    ["/", "/"],
  ])("preserves the internal callback %s", (input, expected) => {
    expect(safeCallbackPath(input)).toBe(expected)
  })

  it.each([
    null,
    "",
    "https://evil.example/steal",
    "http://evil.example/steal",
    "//evil.example/steal",
    "javascript:alert(1)",
    "\\evil.example\\steal",
    "/\\evil.example/steal",
    "/dashboard\n/evil",
    "/dashboard\t",
    "/dashboard ",
    "/%2f%2fevil.example/steal",
    "/%5cevil.example/steal",
    "/dashboard%0a/evil",
    "?next=/dashboard",
    "#dashboard",
  ])("rejects the unsafe callback %s", (input) => {
    expect(safeCallbackPath(input)).toBeNull()
  })
})
