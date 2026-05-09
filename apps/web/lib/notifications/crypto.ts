import crypto from "node:crypto"

const ALGO = "aes-256-gcm"
const IV_LEN = 12
const TAG_LEN = 16
const KEY_HEX_LEN = 64

let cachedKey: Buffer | null = null

function getKey(): Buffer {
  if (cachedKey) return cachedKey
  const hex = process.env.NOTIFICATION_ENCRYPTION_KEY
  if (!hex) {
    throw new Error("NOTIFICATION_ENCRYPTION_KEY is required")
  }
  if (hex.length !== KEY_HEX_LEN || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error(
      "NOTIFICATION_ENCRYPTION_KEY must be a 64-char hex string (32 bytes)"
    )
  }
  cachedKey = Buffer.from(hex, "hex")
  return cachedKey
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LEN)
  const cipher = crypto.createCipheriv(ALGO, key, iv)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const authTag = cipher.getAuthTag()
  return Buffer.concat([iv, authTag, encrypted]).toString("base64url")
}

export function decrypt(ciphertext: string): string {
  const key = getKey()
  const buf = Buffer.from(ciphertext, "base64url")
  if (buf.length < IV_LEN + TAG_LEN) {
    throw new Error("ciphertext too short")
  }
  const iv = buf.subarray(0, IV_LEN)
  const authTag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN)
  const data = buf.subarray(IV_LEN + TAG_LEN)
  const decipher = crypto.createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString("utf8")
}

export function __resetKeyCacheForTests(): void {
  cachedKey = null
}
