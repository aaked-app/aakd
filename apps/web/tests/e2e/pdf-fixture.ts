function escapePdfText(value: string): string {
  return value.replace(/([\\()])/g, "\\$1")
}

/** Build a deterministic one-page ASCII PDF, not a Unicode/RTL fixture. */
export function createTextPdf(lines: string[]): Buffer {
  if (lines.some(line => /[^\x20-\x7E]/.test(line))) {
    throw new Error("createTextPdf only supports printable ASCII; use a font-embedded fixture for Unicode/RTL")
  }
  // Courier has a fixed 7.2-point advance at 12 pt. Keep every line inside
  // the 468-point printable width so Poppler cannot clip a clause's ending.
  const wrappedLines = lines.flatMap(line => {
    const result: string[] = []
    while (line.length > 65) {
      const space = line.lastIndexOf(" ", 65)
      const end = space > 0 ? space : 65
      result.push(line.slice(0, end))
      line = line.slice(end + (space > 0 ? 1 : 0))
    }
    result.push(line)
    return result
  })
  if (wrappedLines.length > 36) throw new Error("createTextPdf exceeds its one-page printable area")
  const content = [
    "BT",
    "/F1 12 Tf",
    "72 720 Td",
    ...wrappedLines.map((line, index) => `${index === 0 ? "" : "0 -18 Td "}(${escapePdfText(line)}) Tj`),
    "ET",
  ].join("\n")

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Courier /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(content, "ascii")} >>\nstream\n${content}\nendstream`,
  ]

  let pdf = "%PDF-1.4\n"
  const offsets = [0]
  for (const [index, object] of objects.entries()) {
    offsets.push(Buffer.byteLength(pdf, "ascii"))
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`
  }

  const xrefOffset = Buffer.byteLength(pdf, "ascii")
  pdf += `xref\n0 ${objects.length + 1}\n`
  pdf += "0000000000 65535 f \n"
  for (const offset of offsets.slice(1)) {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

  return Buffer.from(pdf, "ascii")
}
