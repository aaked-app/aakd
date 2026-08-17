export type ExtractionSeedField = {
  field: string
  rawValue: string
}

export type ExtractionSeed = ExtractionSeedField & {
  confidence: number
  extractedBy: "ai" | "manual"
}

/**
 * Preserve the user's provenance when Pass-1 values are copied into the
 * contract workspace. A touched field is a manual fact, even when its first
 * value came from extraction; untouched extracted fields remain reviewable AI
 * facts. Empty fields are never persisted as extraction rows.
 */
export function buildExtractionSeedPayload(
  fields: ExtractionSeedField[],
  touchedFields: ReadonlySet<string>,
  aiFields: ReadonlySet<string>,
  confidence: Record<string, number>,
): ExtractionSeed[] {
  return fields
    .filter(({ field, rawValue }) =>
      rawValue !== "" && rawValue != null &&
      (touchedFields.has(field) || aiFields.has(field)),
    )
    .map(({ field, rawValue }) => {
      const manual = touchedFields.has(field)
      return {
        field,
        rawValue,
        extractedBy: manual ? "manual" : "ai",
        // Manual rows deliberately use zero because confidence is not a
        // nullable legacy column. The UI renders them as Manual, never as 0%.
        confidence: manual ? 0 : (confidence[field] ?? 0),
      }
    })
}
