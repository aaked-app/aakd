// @vitest-environment node
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

const worker = readFileSync(resolve(process.cwd(), "worker.ts"), "utf8")
const extractWorker = worker.slice(
  worker.indexOf("const extractWorker ="),
  worker.indexOf("// ─── Provider abstraction"),
)

describe("contract extraction source authority", () => {
  it("loads only the bounded object key stored on the exact latest contract file", () => {
    expect(extractWorker).toContain("storage.getObject(contractFile.storageKey, MAX_CONTRACT_FILE_BYTES)")
    expect(extractWorker).not.toContain("storage.getSignedDownloadUrl(storageKey)")
    expect(extractWorker).toMatch(/where:\s*\{ id: fileId, contractId, isLatest: true \}/)
    expect(extractWorker).toMatch(/storageKey !== contractFile\.storageKey/)
  })

  it("derives tenant identity from the contract and rechecks the immutable source before persistence", () => {
    expect(extractWorker).toMatch(/organizationId !== existingContract\.organizationId/)
    expect(extractWorker).toMatch(/storageKey: true/)
    expect(extractWorker).toMatch(/latestFile\.storageKey !== contractFile\.storageKey/)
    expect(extractWorker).toMatch(/latestFile\.version !== contractFile\.version/)
    expect(extractWorker).toMatch(/previousBinding\.organizationId !== existingContract\.organizationId/)
    expect(extractWorker).toContain("organizationId: existingContract.organizationId")
  })

  it("binds a failed-extraction audit to the same authoritative current source", () => {
    const failureBranch = extractWorker.slice(extractWorker.indexOf("const failureRecorded ="))
    expect(failureBranch).toContain("FOR UPDATE")
    expect(failureBranch).toMatch(/organizationId !== existingContract\.organizationId/)
    expect(failureBranch).toMatch(/where: \{ id: fileId, contractId, isLatest: true \}/)
    expect(failureBranch).toMatch(/latestFile\.storageKey !== contractFile\.storageKey/)
    expect(failureBranch).toMatch(/latestFile\.version !== contractFile\.version/)
  })

  it("reconciles exact extraction retries and fences embed providers with the current file version", () => {
    expect(extractWorker).toContain("ensureContractEmbedQueued(contractEmbedQueue")
    expect(extractWorker).toContain("existingContract.extractedSourceHash!")
    const embedWorker = worker.slice(worker.indexOf("const embedWorker ="), worker.indexOf("// ─── Worker: alerts.check"))
    expect(embedWorker).toMatch(/files: \{ where: \{ isLatest: true \}, select: \{ id: true, version: true \}/)
    expect(embedWorker).toContain("latestFile.version === sourceFileVersion")
    expect(embedWorker).toContain("source.extractedSourceFileVersion === latestFile.version")
    expect(embedWorker.indexOf("jobBindingMatches")).toBeLessThan(embedWorker.indexOf("generateEmbeddingForJob"))
  })
})
