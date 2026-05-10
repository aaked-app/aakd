/**
 * Lightweight value parsers shared by CSV-style import handlers (CSV, ContractBook).
 *
 * These never throw — they return null for unparseable input. Handlers decide
 * whether a null is a hard validation failure (per-field error message) or
 * just a missing optional field.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/

export function parseImportDate(input: string | null | undefined): Date | null {
  if (input == null) return null
  const v = String(input).trim()
  if (!v) return null

  if (ISO_DATE_RE.test(v)) {
    const d = new Date(v)
    if (!isNaN(d.getTime())) return d
  }

  // MM/DD/YYYY → try first, then DD/MM/YYYY. The order matters: most US-formatted
  // dates are ambiguous from EU-formatted ones except when the first segment is
  // > 12. We try US first because PandaDoc/DocuSign exports default to it.
  const slash = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slash) {
    const a = Number(slash[1])
    const b = Number(slash[2])
    const y = Number(slash[3])
    if (a >= 1 && a <= 12 && b >= 1 && b <= 31) {
      const d = new Date(Date.UTC(y, a - 1, b))
      if (!isNaN(d.getTime())) return d
    }
    if (b >= 1 && b <= 12 && a >= 1 && a <= 31) {
      const d = new Date(Date.UTC(y, b - 1, a))
      if (!isNaN(d.getTime())) return d
    }
  }

  // Last-resort generic parse — handles formats like "Jan 15, 2024" that are
  // sometimes pasted into spreadsheets.
  const parsed = new Date(v)
  if (!isNaN(parsed.getTime())) return parsed
  return null
}

const TRUE_SET = new Set(["true", "yes", "1", "y", "t"])
const FALSE_SET = new Set(["false", "no", "0", "n", "f"])

export function parseBoolean(input: string | null | undefined): boolean | null {
  if (input == null) return null
  const v = String(input).trim().toLowerCase()
  if (!v) return null
  if (TRUE_SET.has(v)) return true
  if (FALSE_SET.has(v)) return false
  return null
}

export function parseNumber(input: string | null | undefined): number | null {
  if (input == null) return null
  const v = String(input).trim().replace(/[$€£¥,\s]/g, "")
  if (!v) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function parseInteger(input: string | null | undefined): number | null {
  const n = parseNumber(input)
  if (n == null) return null
  if (!Number.isInteger(n)) return null
  return n
}

const VALID_CURRENCY_RE = /^[A-Z]{3}$/

export function parseCurrency(input: string | null | undefined): string | null {
  if (input == null) return null
  const v = String(input).trim().toUpperCase()
  if (!v) return null
  return VALID_CURRENCY_RE.test(v) ? v : null
}
