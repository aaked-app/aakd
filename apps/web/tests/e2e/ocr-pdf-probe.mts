import { execFileSync } from "node:child_process"
import { createHash, randomBytes } from "node:crypto"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { tmpdir } from "node:os"
import { join } from "node:path"

const require = createRequire(import.meta.url)
const { extractLocalFields } = require("../../lib/ai/local-extract.ts") as typeof import("../../lib/ai/local-extract")
const { extractPdfWithOcr, OcrPdfError } = require("../../lib/import/ocr-pdf.ts") as typeof import("../../lib/import/ocr-pdf")
const { createTextPdf } = require("./pdf-fixture.ts") as typeof import("./pdf-fixture")
const { createImageOnlyPdf } = require("./image-only-pdf-fixture.ts") as typeof import("./image-only-pdf-fixture")

if (process.env.AAKD_OCR_PDF_PROBE !== "1") throw new Error("Opt in with AAKD_OCR_PDF_PROBE=1")

const source = createImageOnlyPdf([
  "MASTER SERVICES AGREEMENT FOR PROVIDER",
  "GOVERNING LAW: DELAWARE FOR CUSTOMER",
])
const original = Buffer.from(source)
const directory = await mkdtemp(join(tmpdir(), "aakd-ocr-native-probe-"))
const pdfPath = join(directory, "image-only.pdf")

function isStorageNotFound(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  const candidate = error as { name?: string; Code?: string; $metadata?: { httpStatusCode?: number } }
  return candidate.name === "NoSuchKey" || candidate.Code === "NoSuchKey" || candidate.$metadata?.httpStatusCode === 404
}

function metadataInjectedTwoPagePdf(): Buffer {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
    "<< /Title (Synthetic metadata\\nPages: 1) >>",
  ]
  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  }
  const xrefOffset = Buffer.byteLength(pdf)
  pdf += `xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("")}`
  pdf += `trailer\n<< /Root 1 0 R /Info 5 0 R /Size 6 >>\nstartxref\n${xrefOffset}\n%%EOF\n`
  return Buffer.from(pdf)
}

try {
  await writeFile(pdfPath, source)
  if (execFileSync("pdftotext", [pdfPath, "-"]).toString().trim() !== "") throw new Error("Fixture unexpectedly contains a text layer")
  const injectedPath = join(directory, "metadata-injected.pdf")
  const injectedSource = metadataInjectedTwoPagePdf()
  await writeFile(injectedPath, injectedSource)
  const injectedPageLines = execFileSync("pdfinfo", [injectedPath], { encoding: "utf8" })
    .split("\n")
    .filter((line) => /^Pages:\s+\d+\s*$/.test(line))
  if (injectedPageLines.length !== 2) throw new Error("Native PDF metadata fixture did not produce ambiguous page counts")
  const injectedFailure = await extractPdfWithOcr(injectedSource).catch((error: unknown) => error)
  if (!(injectedFailure instanceof OcrPdfError) || injectedFailure.code !== "page_count") {
    throw new Error("Ambiguous native PDF page metadata was not rejected before OCR")
  }
  const extractedText = await extractPdfWithOcr(source)
  if (!extractedText || !extractedText.endsWith("\f") || extractedText.split("\f").length !== 3) {
    throw new Error("OCR did not preserve two complete page boundaries")
  }
  const fields = extractLocalFields(extractedText)
  if (fields.find((field) => field.field === "contractType")?.sourcePage !== 1
    || fields.find((field) => field.field === "governingLaw")?.sourcePage !== 2) {
    throw new Error("OCR citations did not preserve source pages 1 and 2")
  }
  if (!source.equals(original)) throw new Error("OCR changed the original PDF bytes")
  const shortReplacementText = "A replacement agreement source."
  const shortReplacementOcr = await extractPdfWithOcr(createTextPdf([shortReplacementText]))
  if (!shortReplacementOcr?.includes(shortReplacementText) || !shortReplacementOcr.endsWith("\f")) {
    throw new Error("Complete short OCR text was not retained")
  }

  if (process.env.AAKD_OCR_HTTP_PROBE === "1") {
    const { request } = await import("@playwright/test")
    const pg = require("pg") as typeof import("pg")
    const { storage } = require("../../lib/storage/index.ts") as typeof import("../../lib/storage")
    const baseURL = process.env.PLAYWRIGHT_BASE_URL
    const databaseUrl = process.env.DATABASE_URL
    if (!baseURL || !databaseUrl) throw new Error("HTTP OCR probe requires local acceptance URL and database")
    const database = new URL(databaseUrl)
    if (!["localhost", "127.0.0.1"].includes(new URL(baseURL).hostname)
      || !["localhost", "127.0.0.1"].includes(database.hostname)
      || !/^aakd_acceptance_[a-z0-9_]+$/.test(database.pathname.slice(1))) {
      throw new Error("HTTP OCR probe is restricted to a named local acceptance stack")
    }
    const suffix = randomBytes(8).toString("hex")
    const email = `ocr-owner-${suffix}@example.test`
    const api = await request.newContext({ baseURL, extraHTTPHeaders: { Origin: baseURL } })
    const sql = new pg.Pool({ connectionString: databaseUrl })
    let organizationId: string | undefined
    let storageKey: string | undefined
    let sourceFileId: string | undefined
    let sourceFileVersion: number | undefined
    let primaryFailure: unknown
    try {
      const signup = await api.post("/api/auth/sign-up/email", { data: { name: "OCR Probe", email, password: randomBytes(32).toString("base64url") } })
      if (!signup.ok()) throw new Error(`Signup failed with ${signup.status()}`)
      const organization = await api.post("/api/auth/organization/create", { data: { name: `OCR Probe ${suffix}`, slug: `ocr-probe-${suffix}` } })
      if (!organization.ok()) throw new Error(`Organization creation failed with ${organization.status()}`)
      organizationId = (await organization.json() as { id: string }).id
      const active = await api.post("/api/auth/organization/set-active", { data: { organizationId } })
      if (!active.ok()) throw new Error(`Organization activation failed with ${active.status()}`)
      const contractResponse = await api.post("/api/contracts", { data: { title: `OCR agreement ${suffix}` } })
      if (contractResponse.status() !== 201) throw new Error(`Contract creation failed with ${contractResponse.status()}`)
      const contractId = (await contractResponse.json() as { id: string }).id
      const upload = await api.post(`/api/contracts/${contractId}/upload`, { multipart: {
        file: { name: "image-only-two-page.pdf", mimeType: "application/pdf", buffer: source },
      } })
      if (upload.status() !== 201) throw new Error(`OCR upload failed with ${upload.status()}`)
      const uploadedFile = (await sql.query<{ id: string; version: number; storageKey: string }>(
        `SELECT id, version, "storageKey" FROM "ContractFile" WHERE "contractId"=$1 AND "isLatest"=TRUE`,
        [contractId],
      )).rows[0]
      if (!uploadedFile) throw new Error("Uploaded OCR source file was not persisted")
      sourceFileId = uploadedFile.id
      sourceFileVersion = uploadedFile.version
      storageKey = uploadedFile.storageKey

      const deadline = Date.now() + 120_000
      let persisted = false
      while (Date.now() < deadline && !persisted) {
        const result = await sql.query<{ isOcrExtracted: boolean; extractedText: string | null; sourceFileId: string | null; sourceFileVersion: number | null; sourceHash: string | null; contractPage: number | null; lawPage: number | null }>(
          `SELECT c."isOcrExtracted", c."extractedText", c."extractedSourceHash" AS "sourceHash",
            c."extractedSourceFileId" AS "sourceFileId", c."extractedSourceFileVersion" AS "sourceFileVersion",
            MAX(e."sourcePage") FILTER (WHERE e.field='contractType') AS "contractPage",
            MAX(e."sourcePage") FILTER (WHERE e.field='governingLaw') AS "lawPage"
           FROM "Contract" c LEFT JOIN "AIExtraction" e ON e."contractId"=c.id
           WHERE c.id=$1 GROUP BY c.id`, [contractId],
        )
        const row = result.rows[0]
        persisted = row?.isOcrExtracted === true && row.contractPage === 1 && row.lawPage === 2
          && row.sourceFileId === sourceFileId && row.sourceFileVersion === sourceFileVersion
          && row.sourceHash === createHash("sha256").update(row.extractedText ?? "").digest("hex")
        if (!persisted) await new Promise((resolve) => setTimeout(resolve, 250))
      }
      if (!persisted) throw new Error("Worker did not persist OCR citations for both image-only pages")

      if (!storageKey) throw new Error("OCR source storage key was not persisted")
      const stored = await storage.getObject(storageKey)
      if (!Buffer.from(stored.body).equals(original)) throw new Error("Stored original PDF bytes changed")
    } catch (error) {
      primaryFailure = error
    } finally {
      const cleanupFailures: unknown[] = []
      if (storageKey) {
        try {
          await storage.delete(storageKey)
        } catch (error) {
          cleanupFailures.push(new Error("OCR probe object cleanup failed", { cause: error }))
        }
        try {
          await storage.getObject(storageKey, 1)
          cleanupFailures.push(new Error("OCR probe object still exists after cleanup"))
        } catch (error) {
          if (!isStorageNotFound(error)) cleanupFailures.push(new Error("OCR probe object cleanup could not be verified", { cause: error }))
        }
      }
      if (organizationId) {
        try {
          await sql.query(`DELETE FROM "Organization" WHERE id=$1`, [organizationId])
        } catch (error) {
          cleanupFailures.push(new Error("OCR probe organization cleanup failed", { cause: error }))
        }
      }
      try {
        await sql.query(`DELETE FROM "User" WHERE email=$1`, [email])
      } catch (error) {
        cleanupFailures.push(new Error("OCR probe user cleanup failed", { cause: error }))
      }
      try {
        const remaining = await sql.query<{ users: number; organizations: number }>(
          `SELECT
            (SELECT COUNT(*)::int FROM "User" WHERE email=$1) AS users,
            (SELECT COUNT(*)::int FROM "Organization" WHERE id=$2) AS organizations`,
          [email, organizationId ?? ""],
        )
        if (remaining.rows[0]?.users !== 0 || remaining.rows[0]?.organizations !== 0) {
          cleanupFailures.push(new Error("OCR probe database cleanup was incomplete"))
        }
      } catch (error) {
        cleanupFailures.push(new Error("OCR probe database cleanup could not be verified", { cause: error }))
      }
      try {
        await api.dispose()
      } catch (error) {
        cleanupFailures.push(new Error("OCR probe HTTP context cleanup failed", { cause: error }))
      }
      try {
        await sql.end()
      } catch (error) {
        cleanupFailures.push(new Error("OCR probe database connection cleanup failed", { cause: error }))
      }
      if (primaryFailure !== undefined && cleanupFailures.length > 0) {
        throw new AggregateError([primaryFailure, ...cleanupFailures], "OCR probe and cleanup failed")
      }
      if (primaryFailure !== undefined) throw primaryFailure
      if (cleanupFailures.length > 0) throw new AggregateError(cleanupFailures, "OCR probe cleanup failed")
    }
  }

  console.log(JSON.stringify({ status: "PASS", imageOnlyPages: 2, sourcePages: [1, 2], localEnglishModel: true,
    ambiguousPageMetadataRejected: true, shortCompleteOcr: true, originalBytesPreserved: true, exactSourceBinding: process.env.AAKD_OCR_HTTP_PROBE === "1",
    cleanupVerified: process.env.AAKD_OCR_HTTP_PROBE === "1", httpWorker: process.env.AAKD_OCR_HTTP_PROBE === "1" }))
} finally {
  await rm(directory, { recursive: true, force: true })
}
