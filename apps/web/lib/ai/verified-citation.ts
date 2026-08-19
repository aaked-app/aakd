export interface VerifiedCitation {
  sourceText: string
  sourcePage: number | null
}

/**
 * Treat a model's citation as a claim, not evidence. A citation is usable
 * only when its exact quote occurs in the analyzed text; page numbers always
 * come from the document offsets rather than a provider response.
 */
export function verifyCitation(extractedText: string, proposedSource: unknown): VerifiedCitation | null {
  // A substring made only of whitespace or control characters can occur in
  // every document but is not reviewable source evidence (including NUL,
  // which String.trim does not remove).
  if (typeof proposedSource !== "string" || !/[\p{L}\p{N}]/u.test(proposedSource)) return null
  const offset = extractedText.indexOf(proposedSource)
  if (offset < 0) return null
  return {
    sourceText: proposedSource,
    sourcePage: extractedText.includes("\f") ? extractedText.slice(0, offset).split("\f").length : null,
  }
}
