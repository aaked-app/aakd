export interface LocalExtractedField {
  field: string
  value: string | number | boolean
  confidence: number
  sourceText: string
  sourcePage: number
}

function matchSource(text: string, pattern: RegExp): string | null {
  const match = text.match(pattern)
  return match?.[0] ?? null
}

/**
 * Small, deterministic fallback for installations without an AI provider.
 * It deliberately extracts only unambiguous facts and keeps the exact source
 * phrase so the first-run workflow remains reviewable and cited offline.
 */
export function extractLocalFields(text: string): LocalExtractedField[] {
  const fields: LocalExtractedField[] = []

  const typeSource = matchSource(
    text,
    /(?:mutual\s+)?non[- ]disclosure\s+agreement|master\s+services\s+agreement|statement\s+of\s+work|employment\s+agreement/i,
  )
  if (typeSource) {
    const lower = typeSource.toLowerCase()
    const value = lower.includes("non") ? "NDA" : lower.includes("master") ? "MSA" : lower.includes("statement") ? "SOW" : "EMPLOYMENT"
    fields.push({ field: "contractType", value, confidence: 0.98, sourceText: typeSource, sourcePage: 1 })
  }

  const startSource = matchSource(text, /(?:effective|commencement|start)\s+date\s*:\s*[A-Za-z]+\s+\d{1,2},\s+\d{4}/i)
  if (startSource) {
    const date = startSource.match(/([A-Za-z]+\s+\d{1,2},\s+\d{4})/)?.[1]
    if (date) {
      const dateParts = date.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/)
      const month = dateParts ? new Date(`${dateParts[1]} 1, 2000`).getMonth() + 1 : 0
      if (dateParts && month > 0) {
        fields.push({
          field: "startDate",
          value: `${dateParts[3]}-${String(month).padStart(2, "0")}-${String(Number(dateParts[2])).padStart(2, "0")}`,
          confidence: 0.96,
          sourceText: startSource,
          sourcePage: 1,
        })
      }
    }
  }

  const noticeSource = matchSource(text, /\b\d{1,3}\s+days?\s+(?:prior\s+)?(?:written\s+)?notice\b/i)
  if (noticeSource) {
    const days = Number(noticeSource.match(/\d+/)?.[0])
    if (Number.isFinite(days)) fields.push({ field: "noticePeriodDays", value: days, confidence: 0.94, sourceText: noticeSource, sourcePage: 1 })
  }

  const renewalSource = matchSource(text, /(?:automatically\s+renews?|auto[- ]renews?)/i)
  if (renewalSource) fields.push({ field: "autoRenewal", value: true, confidence: 0.93, sourceText: renewalSource, sourcePage: 1 })

  const lawSource = matchSource(text, /govern(?:ing|ed)\s+law\s*:\s*[^.\n]+/i)
  if (lawSource) {
    const law = lawSource.split(":").slice(1).join(":").trim()
    if (law) fields.push({ field: "governingLaw", value: law, confidence: 0.92, sourceText: lawSource, sourcePage: 1 })
  }

  return fields
}
