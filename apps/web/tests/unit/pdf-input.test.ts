// @vitest-environment node
import { describe, expect, it } from "vitest"
import { execFileSync } from "node:child_process"

describe("PDF input boundaries", () => {
  it("extracts a valid PDF from a Buffer view without reading surrounding bytes", async () => {
    // A fresh process catches PDF.js initialization defects hidden by retries
    // and avoids pdf-parse's debug entrypoint under Vitest's module loader.
    const output = execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
    const { parsePdf } = require('./lib/pdf.ts');
    const { createTextPdf } = require('./tests/e2e/pdf-fixture.ts');
    (async () => {
    const pdf = createTextPdf(["MASTER SERVICES AGREEMENT", "O'Brien requires 45 days written notice."]);
    const backing = Buffer.concat([Buffer.from("unrelated prefix"), pdf, Buffer.from("unrelated suffix")])
    const view = backing.subarray(16, 16 + pdf.length)
    const original = Buffer.from(backing)
    const result = await parsePdf(view)
    console.log(JSON.stringify({ result, unchanged: backing.equals(original) }));
    })().catch(error => { console.error(error); process.exit(1); });
    `], { encoding: "utf8" })
    const { result, unchanged } = JSON.parse(output.trim().split("\n").at(-1)!)
    expect(result.numpages).toBe(1)
    expect(result.text).toContain("MASTER SERVICES AGREEMENT")
    expect(result.text).toContain("O'Brien requires 45 days written notice.")
    expect(result.text).not.toContain("unrelated")
    expect(unchanged).toBe(true)
  })

  it("uses only typed parser options and preserves a terminal page delimiter", async () => {
    const output = execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
    const { parsePdf } = require('./lib/pdf.ts');
    const { createTextPdf } = require('./tests/e2e/pdf-fixture.ts');
    (async () => {
    let callbackRan = false;
    const pdf = createTextPdf(["O'Brien page boundary"]);
    const result = await parsePdf(pdf, {
      pageBreaks: true,
      pagerender: () => { callbackRan = true; throw new Error("must not run"); },
    });
    console.log(JSON.stringify({ text: result.text, callbackRan }));
    })().catch(error => { console.error(error); process.exit(1); });
    `], { encoding: "utf8" })
    const { text, callbackRan } = JSON.parse(output.trim().split("\n").at(-1)!)
    expect(text).toContain("O'Brien page boundary")
    expect(text.endsWith("\f")).toBe(true)
    expect(callbackRan).toBe(false)
  })

  it("contains parser heap exhaustion without killing the constrained parent", () => {
    const output = execFileSync(process.execPath, ["--max-old-space-size=1024", "--require", "tsx/cjs", "-e", `
    const { parsePdf } = require('./lib/pdf.ts');
    function createOversizedStreamPdf(textBytes) {
      const chunks = [];
      const offsets = [0];
      let length = 0;
      const append = value => {
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value, 'ascii');
        chunks.push(chunk);
        length += chunk.byteLength;
      };
      append('%PDF-1.4\\n');
      for (const [index, object] of [
        '<< /Type /Catalog /Pages 2 0 R >>',
        '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
        '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
        '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
      ].entries()) {
        offsets.push(length);
        append(String(index + 1) + ' 0 obj\\n' + object + '\\nendobj\\n');
      }
      const contentPrefix = Buffer.from('BT\\n/F1 12 Tf\\n72 720 Td\\n(', 'ascii');
      const contentSuffix = Buffer.from(') Tj\\nET', 'ascii');
      offsets.push(length);
      append('5 0 obj\\n<< /Length ' + (contentPrefix.length + textBytes + contentSuffix.length) + ' >>\\nstream\\n');
      append(contentPrefix);
      append(Buffer.alloc(textBytes, 0x41));
      append(contentSuffix);
      append('\\nendstream\\nendobj\\n');
      const xrefOffset = length;
      append('xref\\n0 6\\n0000000000 65535 f \\n');
      for (const offset of offsets.slice(1)) append(String(offset).padStart(10, '0') + ' 00000 n \\n');
      append('trailer\\n<< /Size 6 /Root 1 0 R >>\\nstartxref\\n' + xrefOffset + '\\n%%EOF\\n');
      return Buffer.concat(chunks, length);
    }
    (async () => {
      const pdf = createOversizedStreamPdf(30 * 1024 * 1024);
      try {
        await parsePdf(pdf);
        console.log(JSON.stringify({ parentAlive: true, outcome: "parsed" }));
      } catch (error) {
        console.log(JSON.stringify({
          parentAlive: true,
          outcome: "rejected",
          message: error instanceof Error ? error.message : String(error),
        }));
      }
    })().catch(error => { console.error(error); process.exit(1); });
    `], { encoding: "utf8", timeout: 45_000, maxBuffer: 4 * 1024 * 1024 })
    const result = JSON.parse(output.trim().split("\n").at(-1)!)
    expect(result).toMatchObject({
      parentAlive: true,
      outcome: "rejected",
      message: "PDF parser exceeded its isolated resource limits",
    })
  }, 60_000)

  it("bounds concurrent parser processes and the pending queue", () => {
    const output = execFileSync(process.execPath, ["--require", "tsx/cjs", "-e", `
    const { parsePdf } = require('./lib/pdf.ts');
    const { createTextPdf } = require('./tests/e2e/pdf-fixture.ts');
    (async () => {
      const pdf = createTextPdf(["bounded parser queue"]);
      const results = await Promise.allSettled(Array.from({ length: 4 }, () => parsePdf(pdf)));
      console.log(JSON.stringify(results.map(result =>
        result.status === "fulfilled" ? "fulfilled" : result.reason.message
      )));
    })().catch(error => { console.error(error); process.exit(1); });
    `], { encoding: "utf8" })
    const results = JSON.parse(output.trim().split("\n").at(-1)!) as string[]
    expect(results.filter(result => result === "fulfilled")).toHaveLength(1)
    expect(results.filter(result => result === "PDF parser exceeded its isolated resource limits")).toHaveLength(3)
  })
})
