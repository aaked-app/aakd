import { describe, expect, it } from "vitest"
import { renderPreview } from "@/components/templates/fill-variables-dialog"

describe("template preview output", () => {
  it("escapes template text and variable placeholders", () => {
    const html = renderPreview(
      {
        type: "doc",
        content: [
          { type: "paragraph", content: [{ type: "text", text: "<img src=x onerror=alert(1)>" }] },
          { type: "templateVariable", attrs: { variable: "x\"><script>alert(1)</script>" } },
        ],
      },
      {},
    )

    expect(html).not.toContain("<img")
    expect(html).not.toContain("<script")
    expect(html).toContain("&lt;img")
  })

  it("does not allow a template to choose an arbitrary heading tag", () => {
    const html = renderPreview({ type: "heading", attrs: { level: "\"><script>" } }, {})
    expect(html).toMatch(/^<h1 /)
    expect(html).not.toContain("script")
  })
})
