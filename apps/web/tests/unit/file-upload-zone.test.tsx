import { useState } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { FileUploadZone } from "@/components/file-upload-zone"
import { NextIntlClientProvider } from "next-intl"
import messages from "@/messages/en.json"

afterEach(cleanup)

function UploadHarness() {
  const [file, setFile] = useState<File | null>(null)
  return <NextIntlClientProvider locale="en" messages={messages}><FileUploadZone onFileSelect={setFile} /><output aria-label="Selected source">{file?.name ?? "None"}</output></NextIntlClientProvider>
}

it("clearing a selected file also clears the parent's upload payload", () => {
  const { container } = render(<UploadHarness />)
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [new File(["%PDF-1.4"], "source.pdf", { type: "application/pdf" })] } })
  expect(screen.getByLabelText("Selected source")).toHaveTextContent("source.pdf")
  fireEvent.click(screen.getByRole("button", { name: "Clear selected file" }))
  expect(screen.getByLabelText("Selected source")).toHaveTextContent("None")
})

it("lets keyboard users open the file chooser", () => {
  const { container } = render(<UploadHarness />)
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  const choose = vi.spyOn(input, "click").mockImplementation(() => undefined)
  const zone = screen.getByRole("button", { name: "Upload file" })
  zone.focus()
  expect(zone).toHaveFocus()
  fireEvent.keyDown(zone, { key: "Enter" })
  fireEvent.keyDown(zone, { key: " " })
  expect(choose).toHaveBeenCalledTimes(2)
})
