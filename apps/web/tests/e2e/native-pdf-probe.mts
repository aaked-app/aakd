import { execFileSync } from "node:child_process"
import { mkdtemp, readFile, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { createRequire } from "node:module"
import { Document, Packer, Paragraph, TextRun, PageBreak } from "docx"
import mammoth from "mammoth"

if (process.env.AAKD_NATIVE_PDF_PROBE !== "1") throw new Error("Opt in with AAKD_NATIVE_PDF_PROBE=1; LibreOffice must be installed")
const directory = await mkdtemp(join(tmpdir(), "aakd-multilingual-pdf-"))
const document = new Document({ sections: [{ children: [
  new Paragraph({ children: [new TextRun({ text: "Contrat de services: échéance, confidentialité, O'Brien.", font: "Arial" })] }),
  new Paragraph({ children: [new PageBreak()] }),
  new Paragraph({ bidirectional: true, children: [new TextRun({ text: "الالتزامات التعاقدية", font: "Arial", rightToLeft: true })] }),
] }] })
await writeFile(join(directory, "synthetic-multilingual.docx"), await Packer.toBuffer(document))
execFileSync("soffice", [`-env:UserInstallation=${pathToFileURL(join(directory, "office-profile")).href}`, "--headless", "--convert-to", "pdf", "--outdir", directory, join(directory, "synthetic-multilingual.docx")], { timeout: 60_000, stdio: "pipe" })
const pdfPath = join(directory, "synthetic-multilingual.pdf")
const { parsePdf } = createRequire(import.meta.url)("../../lib/pdf.ts") as typeof import("../../lib/pdf")
const result = await parsePdf(await readFile(pdfPath), { pageBreaks: true })
const pages = result.text.normalize("NFKC").split("\f")
if (result.numpages !== 2 || !pages[0].includes("échéance") || !pages[0].includes("O'Brien") || !pages[1]?.includes("الالتزامات")) {
  throw new Error(`Multilingual source-page preservation failed: pages=${result.numpages}, text=${JSON.stringify(result.text)}`)
}
console.log(JSON.stringify({ status: "PASS", pages: result.numpages, frenchAccents: true, apostrophe: true, arabicSourcePage: 2, fixture: pdfPath }))

// Exercise the shipped PDF-to-Writer helper too, not merely LibreOffice's
// independent DOCX-to-PDF command above. CI runs this in the worker image.
const require = createRequire(import.meta.url)
const { pdfToDocxBuffer } = require("../../lib/import/pdf-to-docx.ts") as typeof import("../../lib/import/pdf-to-docx")
const { createTextPdf } = require("./pdf-fixture.ts") as typeof import("./pdf-fixture")
const marker = "Synthetic monthly report due on the fifth business day."
const original = createTextPdf([marker])
const originalCopy = Buffer.from(original)
const converted = await pdfToDocxBuffer(original)
if (!converted || converted.subarray(0, 4).toString("hex") !== "504b0304") {
  throw new Error("PDF-to-Writer did not produce an editable DOCX")
}
const html = (await mammoth.convertToHtml({ buffer: converted })).value
if (!html.includes(marker) || !original.equals(originalCopy)) {
  throw new Error("PDF-to-Writer changed the original or lost the synthetic text")
}
if (await pdfToDocxBuffer(Buffer.from("%PDF-1.7 invalid synthetic document")) !== null) {
  throw new Error("Malformed PDF did not take the safe conversion fallback")
}
console.log(JSON.stringify({ status: "PASS", pdfToWriter: true, sourceTextPreserved: true, originalUnchanged: true, malformedFallback: true }))
