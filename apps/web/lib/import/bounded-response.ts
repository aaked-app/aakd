export const MAX_IMPORT_FILE_BYTES = 50 * 1024 * 1024

function cancelBody(response: Response): void {
  try {
    void response.body?.cancel("file_too_large").catch(() => {
      // The size rejection remains authoritative even if the remote stream
      // does not acknowledge cancellation.
    })
  } catch {
    // Some custom stream implementations can throw before returning a promise.
  }
}

export async function readBoundedResponseBody(
  response: Response,
  maxBytes = MAX_IMPORT_FILE_BYTES,
): Promise<Buffer> {
  const rawContentLength = response.headers.get("content-length")
  if (rawContentLength !== null) {
    const contentLength = Number(rawContentLength)
    if (Number.isFinite(contentLength) && contentLength > maxBytes) {
      cancelBody(response)
      throw new Error("file_too_large")
    }
  }

  if (!response.body) return Buffer.alloc(0)

  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (value.byteLength > maxBytes - totalBytes) {
        try {
          void reader.cancel("file_too_large").catch(() => {
            // Preserve the stable size error if cancellation later rejects.
          })
        } catch {
          // Preserve the stable size error if cancellation throws synchronously.
        }
        throw new Error("file_too_large")
      }
      chunks.push(value)
      totalBytes += value.byteLength
    }
  } finally {
    reader.releaseLock()
  }

  return Buffer.concat(chunks, totalBytes)
}
