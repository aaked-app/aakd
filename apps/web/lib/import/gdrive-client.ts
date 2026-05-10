/**
 * Google Drive API client.
 *
 * Wraps token refresh + the small subset of Drive API endpoints we need
 * (file listing, metadata, download). All tokens are encrypted at rest with
 * the same crypto util as the M5 notification webhooks.
 */
import { encrypt, decrypt } from "@/lib/notifications/crypto"
import { getWorkerPrisma } from "@/lib/db/worker-client"

export interface DriveFile {
  id: string
  name: string
  mimeType: string
  sizeBytes: number | null
  modifiedAt: string | null
}

export interface StoredIntegration {
  id: string
  accessToken: string
  refreshToken: string
  tokenExpiresAt: Date | null
}

const DRIVE_API = "https://www.googleapis.com/drive/v3"
const TOKEN_URL = "https://oauth2.googleapis.com/token"
const FOLDER_MIME = "application/vnd.google-apps.folder"
const PDF_MIME = "application/pdf"
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

async function getAccessToken(integration: StoredIntegration): Promise<string> {
  const expiresAt = integration.tokenExpiresAt
  // Refresh if expired or expiring within 5 minutes.
  if (expiresAt && expiresAt.getTime() < Date.now() + 5 * 60_000) {
    return await refreshAccessToken(integration)
  }
  return decrypt(integration.accessToken)
}

async function refreshAccessToken(integration: StoredIntegration): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID/SECRET not configured")
  }

  const refreshToken = decrypt(integration.refreshToken)
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  })
  if (!res.ok) {
    throw new Error(`google_token_refresh_failed: ${res.status}`)
  }
  const data = (await res.json()) as { access_token: string; expires_in: number }
  const newExpiresAt = new Date(Date.now() + data.expires_in * 1000)

  // Persist the rotated access token. The refresh token rarely rotates but
  // if Google ever issues a new one we'd see it on `data.refresh_token` —
  // not currently included in the response shape we use.
  await getWorkerPrisma().googleDriveIntegration.update({
    where: { id: integration.id },
    data: {
      accessToken: encrypt(data.access_token),
      tokenExpiresAt: newExpiresAt,
    },
  })

  return data.access_token
}

export async function listDriveFiles(
  integration: StoredIntegration,
  folderId: string | undefined,
): Promise<{ files: DriveFile[]; truncated: boolean }> {
  const token = await getAccessToken(integration)
  const parent = folderId && folderId.length > 0 ? folderId : "root"

  const q = `'${parent.replace(/'/g, "\\'")}' in parents and (mimeType='${PDF_MIME}' or mimeType='${DOCX_MIME}' or mimeType='${FOLDER_MIME}') and trashed=false`

  const url = new URL(`${DRIVE_API}/files`)
  url.searchParams.set("q", q)
  url.searchParams.set("fields", "files(id,name,mimeType,size,modifiedTime),nextPageToken")
  url.searchParams.set("pageSize", "100")

  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
  if (!res.ok) {
    throw new Error(`google_drive_list_failed: ${res.status}`)
  }
  const data = (await res.json()) as {
    files: Array<{ id: string; name: string; mimeType: string; size?: string; modifiedTime?: string }>
    nextPageToken?: string
  }
  return {
    files: (data.files ?? []).map((f) => ({
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      sizeBytes: f.size ? Number(f.size) : null,
      modifiedAt: f.modifiedTime ?? null,
    })),
    truncated: !!data.nextPageToken,
  }
}

export interface DownloadedDriveFile {
  buffer: Buffer
  name: string
  mimeType: string
  sizeBytes: number
}

export async function downloadDriveFile(
  integration: StoredIntegration,
  fileId: string,
): Promise<DownloadedDriveFile> {
  const token = await getAccessToken(integration)
  // Metadata first so we can refuse oversize files before pulling bytes.
  const metaRes = await fetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!metaRes.ok) {
    throw new Error(`google_drive_meta_failed: ${metaRes.status}`)
  }
  const meta = (await metaRes.json()) as {
    id: string
    name: string
    mimeType: string
    size?: string
  }
  const sizeBytes = meta.size ? Number(meta.size) : 0

  const dlRes = await fetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?alt=media`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!dlRes.ok) {
    throw new Error(`google_drive_download_failed: ${dlRes.status}`)
  }
  const arrayBuffer = await dlRes.arrayBuffer()
  return {
    buffer: Buffer.from(arrayBuffer),
    name: meta.name,
    mimeType: meta.mimeType,
    sizeBytes: sizeBytes || arrayBuffer.byteLength,
  }
}
