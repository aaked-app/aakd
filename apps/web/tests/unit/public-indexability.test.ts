import { describe, expect, it } from "vitest"

import { metadata as invitationMetadata } from "@/app/accept-invitation/layout"
import { metadata as authMetadata } from "@/app/(auth)/layout"

describe("non-public page metadata", () => {
  it("keeps authentication and invitation surfaces out of search indexes", () => {
    expect(authMetadata.robots).toMatchObject({ index: false, follow: true })
    expect(invitationMetadata.robots).toMatchObject({ index: false, follow: true })
  })
})
