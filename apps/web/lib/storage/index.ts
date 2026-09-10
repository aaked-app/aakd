import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"

let _s3: S3Client | null = null

function getS3(): S3Client {
  if (!_s3) {
    _s3 = new S3Client({
      region: process.env.STORAGE_REGION ?? "us-east-1",
      endpoint: process.env.STORAGE_ENDPOINT || undefined,
      forcePathStyle: !!process.env.STORAGE_ENDPOINT, // required for MinIO
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY ?? "",
        secretAccessKey: process.env.STORAGE_SECRET_KEY ?? "",
      },
    })
  }
  return _s3
}

function getBucket(): string {
  return process.env.STORAGE_BUCKET ?? "aakd"
}

export const storage = {
  async upload(key: string, body: Buffer | Uint8Array, contentType: string, options?: { abortSignal?: AbortSignal }): Promise<string> {
    await getS3().send(
      new PutObjectCommand({ Bucket: getBucket(), Key: key, Body: body, ContentType: contentType }),
      options?.abortSignal ? { abortSignal: options.abortSignal } : undefined,
    )
    return key
  },

  async getSignedDownloadUrl(key: string, expiresIn = 3600): Promise<string> {
    return getSignedUrl(getS3(), new GetObjectCommand({ Bucket: getBucket(), Key: key }), { expiresIn })
  },

  async getObject(key: string, maxBytes?: number): Promise<{ body: Uint8Array; contentType?: string }> {
    if (maxBytes !== undefined && (!Number.isSafeInteger(maxBytes) || maxBytes < 1)) {
      throw new Error("Invalid stored object size limit")
    }
    const result = await getS3().send(new GetObjectCommand({ Bucket: getBucket(), Key: key }))
    if (!result.Body) throw new Error("Stored object has no body")
    if (maxBytes !== undefined) {
      const reader = result.Body.transformToWebStream().getReader()
      const chunks: Uint8Array[] = []
      let length = 0
      try {
        if (result.ContentLength !== undefined && result.ContentLength > maxBytes) {
          throw new Error("Stored object exceeds size limit")
        }
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          length += value.byteLength
          if (length > maxBytes) throw new Error("Stored object exceeds size limit")
          chunks.push(value)
        }
        return { body: Buffer.concat(chunks, length), contentType: result.ContentType }
      } catch (error) {
        await reader.cancel().catch(() => undefined)
        throw error
      } finally {
        reader.releaseLock()
      }
    }
    return {
      body: await result.Body.transformToByteArray(),
      contentType: result.ContentType,
    }
  },

  async delete(key: string): Promise<void> {
    await getS3().send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }))
  },

  storageKey(organizationId: string, contractId: string, filename: string): string {
    const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
    return `orgs/${organizationId}/contracts/${contractId}/${Date.now()}_${sanitized}`
  },
}
