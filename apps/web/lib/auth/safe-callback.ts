const UNSAFE_CALLBACK_CHARACTERS = /[\\\s\u0000-\u001f\u007f]/

/**
 * Keep post-auth navigation on this application origin.
 *
 * Callers pass the already-decoded value returned by URLSearchParams. The
 * original string is returned so valid query strings and fragments survive.
 */
export function safeCallbackPath(value: string | null): string | null {
  if (!value?.startsWith("/") || value.startsWith("//")) return null
  if (UNSAFE_CALLBACK_CHARACTERS.test(value)) return null

  try {
    const decodedValue = decodeURIComponent(value)
    if (!decodedValue.startsWith("/") || decodedValue.startsWith("//")) return null
    if (UNSAFE_CALLBACK_CHARACTERS.test(decodedValue)) return null
  } catch {
    return null
  }

  return value
}
