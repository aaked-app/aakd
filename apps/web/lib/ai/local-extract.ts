export interface LocalExtractedField {
  field: string
  value: string | number | boolean
  confidence: number
  sourceText: string
  sourcePage: number | null
}

export interface LocalObligationSuggestion {
  title: string
  description: string
  clauseReference: null
  sourceText: string
  sourcePage: number | null
  priority: "HIGH" | "MEDIUM" | "LOW"
  suggestedDueDays: number | null
  confidence: number
}

function sourcePageForOffset(text: string, offset: number): number | null {
  // Plain DOCX and legacy PDF extraction text has no trustworthy page map.
  // Do not label every quote "page 1" in that case.
  if (!text.includes("\f")) return null
  return text.slice(0, offset).split("\f").length
}

export interface DeterministicRenewalTerms {
  autoRenewal?: LocalExtractedField
  noticePeriodDays?: LocalExtractedField
  /** The source discusses a possible renewal, but does not state a fact. */
  autoRenewalAmbiguous: boolean
}

/**
 * Extracts renewal facts only when a single clause states them unambiguously.
 * A notice period is intentionally associated with that same renewal clause:
 * a generic notice elsewhere in the agreement must not become a renewal term.
 */
export function extractDeterministicRenewalTerms(text: string): DeterministicRenewalTerms {
  const result: DeterministicRenewalTerms = { autoRenewalAmbiguous: false }
  // Preserve offsets (and therefore page attribution) while treating embedded
  // NULs as whitespace for matching.
  const searchable = text.replace(/\0/g, " ")
  // PDF extraction often wraps one legal sentence across physical lines. Keep
  // newlines in the parsing segment, then trim the citation to its clause.
  const sentencePattern = /[^\f.!?]+[.!?]?|\f/g

  for (const match of searchable.matchAll(sentencePattern)) {
    const clause = match[0].trim()
    if (!clause || clause === "\f") continue
    const offset = (match.index ?? 0) + match[0].indexOf(clause)
    const renewalPattern = /\b(?:automatically\s+renew(?:s|ed|ing)?|auto[- ]renew(?:s|ed|ing)?)\b/i
    const renewalMatch = clause.match(renewalPattern)
    if (!renewalMatch) continue
    // Avoid turning a document heading or unrelated preceding line into the
    // citation, while still allowing a wrapped notice to remain in scope.
    const citationStart = clause.lastIndexOf("\n", renewalMatch.index ?? 0) + 1
    const citationClause = clause.slice(citationStart).trim()
    const citationOffset = offset + citationStart + clause.slice(citationStart).indexOf(citationClause)
    const sourcePage = sourcePageForOffset(text, citationOffset)
    const sourceText = text.slice(citationOffset, citationOffset + citationClause.length).replace(/\0/g, " ").trim()

    const explicitNegative = /\b(?:does|do|will|shall|would|can|could|may|might)\s+(?:not\s+(?:be\s+)?|no\s+longer\s+)(?:automatically\s+renew|auto[- ]renew)|\b(?:not|never)\s+(?:automatically\s+renew|auto[- ]renew)|\b(?:under\s+no\s+circumstances|in\s+no\s+event)\s+(?:automatically\s+renew|auto[- ]renew)/i.test(clause)
    // An option or election is a discretionary right, not an automatic
    // renewal fact. Match the common legal formulations generically rather
    // than assuming a particular party is called "Customer".
    const conditional = /\b(?:may|might|can|could|would)\s+(?:automatically\s+renew|auto[- ]renew)|\b(?:if\s+(?:both\s+)?part(?:y|ies)\s+agree|(?:with|upon)\s+(?:mutual\s+)?(?:written\s+)?consent|subject\s+to\b[^.!?]{0,80}\b(?:opt(?:ing)?\s+in|consent|agreement)|if\s+[^.!?]{0,100}\b(?:elects?\s+to\s+renew|exercises?\s+(?:its\s+|the\s+)?option\s+to\s+renew)|when\s+[^.!?]{0,100}\belects?\s+(?:to\s+)?renew(?:al)?\b|(?:at|upon|subject\s+to|on)\s+(?:the\s+)?(?:sole\s+)?(?:option|election)\s+(?:of|by)\b|(?:at|upon|subject\s+to|on)\s+[^.!?]{0,100}(?:'s|’s)\s+(?:sole\s+)?(?:option|election)\b)\b/i.test(clause)
    if (conditional) {
      result.autoRenewalAmbiguous = true
      continue
    }

    result.autoRenewal = {
      field: "autoRenewal",
      value: !explicitNegative,
      confidence: 0.95,
      sourceText,
      sourcePage,
    }

    if (explicitNegative) return result

    const renewalOffset = renewalMatch.index ?? 0
    const renewalTail = clause.slice(renewalOffset)
    const negativeNotice = /-\s*\d+\s+days?\s+(?:prior\s+)?(?:written\s+)?notice/i.test(renewalTail)
    const noticeMatch = !negativeNotice
      ? [...renewalTail.matchAll(/\b(\d{1,4})\s+days?\s+(?:prior\s+)?(?:written\s+)?notice\b|\bnotice\s+of\s+(\d{1,4})\s+days?\b/gi)][0]
      : undefined
    const days = noticeMatch ? Number(noticeMatch[1] ?? noticeMatch[2]) : NaN
    if (Number.isSafeInteger(days) && days >= 0 && days <= 3650) {
      result.noticePeriodDays = {
        field: "noticePeriodDays",
        value: days,
        confidence: 0.95,
        sourceText,
        sourcePage,
      }
    }
    return result
  }

  return result
}

function matchSource(text: string, pattern: RegExp): { value: string; page: number | null } | null {
  const match = text.match(pattern)
  if (!match?.[0]) return null
  return { value: match[0], page: sourcePageForOffset(text, match.index ?? 0) }
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
    const lower = typeSource.value.toLowerCase()
    const value = lower.includes("non") ? "NDA" : lower.includes("master") ? "MSA" : lower.includes("statement") ? "SOW" : "EMPLOYMENT"
    fields.push({ field: "contractType", value, confidence: 0.98, sourceText: typeSource.value, sourcePage: typeSource.page })
  }

  const startSource = matchSource(text, /(?:effective|commencement|start)\s+date\s*:\s*[A-Za-z]+\s+\d{1,2},\s+\d{4}/i)
  if (startSource) {
    const date = startSource.value.match(/([A-Za-z]+\s+\d{1,2},\s+\d{4})/)?.[1]
    if (date) {
      const dateParts = date.match(/^([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})$/)
      const month = dateParts ? new Date(`${dateParts[1]} 1, 2000`).getMonth() + 1 : 0
      if (dateParts && month > 0) {
        fields.push({
          field: "startDate",
          value: `${dateParts[3]}-${String(month).padStart(2, "0")}-${String(Number(dateParts[2])).padStart(2, "0")}`,
          confidence: 0.96,
          sourceText: startSource.value,
          sourcePage: startSource.page,
        })
      }
    }
  }

  const renewalTerms = extractDeterministicRenewalTerms(text)
  if (renewalTerms.autoRenewal) fields.push(renewalTerms.autoRenewal)
  if (renewalTerms.noticePeriodDays) fields.push(renewalTerms.noticePeriodDays)

  const lawSource = matchSource(text, /govern(?:ing|ed)\s+law\s*:\s*[^.\n]+/i)
  if (lawSource) {
    const law = lawSource.value.split(":").slice(1).join(":").trim()
    if (law) fields.push({ field: "governingLaw", value: law, confidence: 0.92, sourceText: lawSource.value, sourcePage: lawSource.page })
  }

  return fields
}

/**
 * Finds only explicit commitment sentences for the provider-free first-run
 * path. These are suggestions, never canonical obligations: users review the
 * verbatim source and choose whether to accept them.
 */
export function extractLocalObligationSuggestions(text: string): LocalObligationSuggestion[] {
  const suggestions: LocalObligationSuggestion[] = []
  const seen = new Set<string>()
  // Split first rather than repeatedly scanning from every character to the
  // next punctuation mark. Apart from bounding runtime on long input, this
  // preserves form-feed page boundaries emitted by the PDF extractor.
  const sentencePattern = /[^\f.!?]+[.!?]?|\f/g
  for (const match of text.matchAll(sentencePattern)) {
    const sourceText = match[0].trim()
    const sentenceOffset = (match.index ?? 0) + match[0].indexOf(sourceText)
    if (!sourceText || seen.has(sourceText)) continue
    seen.add(sourceText)

    if (
      /\b(?:shall|must|will)\b[^.!?\f]{0,60}\b(?:not|never)\b|\bdoes\s+not\s+agree\s+to\b|\bnot\s+(?:be\s+)?required\s+to\b|\b(?:under\s+no\s+circumstances|in\s+no\s+event)\b/i.test(sourceText) ||
      !/\b(?:shall|must|will)\b|\bagrees?\s+to\b|\bis\s+required\s+to\b/i.test(sourceText)
    ) continue

    const action = sourceText
      .replace(/^.*?\b(?:shall|must|will|agrees?\s+to|is\s+required\s+to)\s+/i, "")
      .replace(/[.!?]+$/, "")
      .trim()
    if (!action) continue

    const title = `${action.charAt(0).toUpperCase()}${action.slice(1)}`.slice(0, 100)
    const explicitDueDays = sourceText.match(/\bwithin\s+(\d{1,4})\s+days?\b/i)?.[1]
    const dueDays = explicitDueDays ? Number(explicitDueDays) : null
    const sourcePage = sourcePageForOffset(text, sentenceOffset)
    const priority = /\b(?:pay(?:ment)?|invoice|fee|penalt(?:y|ies)|termination|terminate|notice)\b/i.test(sourceText)
      ? "HIGH"
      : "MEDIUM"

    suggestions.push({
      title,
      description: "Explicit contract commitment detected locally. Review the cited source before accepting.",
      clauseReference: null,
      sourceText,
      sourcePage,
      priority,
      // A recurring or conditional commitment does not have an inherent
      // one-time deadline. Leave the date for the reviewer rather than invent
      // one that could cause an incorrect reminder.
      suggestedDueDays: dueDays === null || !Number.isFinite(dueDays) ? null : Math.min(3650, Math.max(1, dueDays)),
      confidence: 0.75,
    })
  }

  return suggestions
}
