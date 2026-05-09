import { describe, it, expect, beforeAll, afterEach } from "vitest"
import crypto from "node:crypto"
import {
  encrypt,
  decrypt,
  __resetKeyCacheForTests,
} from "@/lib/notifications/crypto"

const KEY = crypto.randomBytes(32).toString("hex")

describe("notifications/crypto — AES-256-GCM", () => {
  beforeAll(() => {
    process.env.NOTIFICATION_ENCRYPTION_KEY = KEY
    __resetKeyCacheForTests()
  })

  afterEach(() => {
    __resetKeyCacheForTests()
  })

  it("round-trips a plaintext string", () => {
    const plain = "https://hooks.slack.com/services/T0/B0/abc"
    expect(decrypt(encrypt(plain))).toBe(plain)
  })

  it("produces different ciphertexts for the same plaintext (random IV)", () => {
    const a = encrypt("hello")
    const b = encrypt("hello")
    expect(a).not.toBe(b)
  })

  it("rejects tampered ciphertext", () => {
    const ct = encrypt("secret")
    const buf = Buffer.from(ct, "base64url")
    buf[buf.length - 1] ^= 0xff
    const tampered = buf.toString("base64url")
    expect(() => decrypt(tampered)).toThrow()
  })

  it("rejects too-short ciphertext", () => {
    expect(() => decrypt("abc")).toThrow()
  })

  it("throws when NOTIFICATION_ENCRYPTION_KEY is missing", () => {
    const original = process.env.NOTIFICATION_ENCRYPTION_KEY
    delete process.env.NOTIFICATION_ENCRYPTION_KEY
    __resetKeyCacheForTests()
    try {
      expect(() => encrypt("x")).toThrow(/NOTIFICATION_ENCRYPTION_KEY/)
    } finally {
      process.env.NOTIFICATION_ENCRYPTION_KEY = original
    }
  })

  it("throws when key is not 64-char hex", () => {
    const original = process.env.NOTIFICATION_ENCRYPTION_KEY
    process.env.NOTIFICATION_ENCRYPTION_KEY = "short"
    __resetKeyCacheForTests()
    try {
      expect(() => encrypt("x")).toThrow(/64-char hex/)
    } finally {
      process.env.NOTIFICATION_ENCRYPTION_KEY = original
    }
  })

  it("ciphertext format = base64url(iv[12] + tag[16] + ciphertext)", () => {
    const ct = encrypt("X")
    const buf = Buffer.from(ct, "base64url")
    // 12 (IV) + 16 (auth tag) + at least 1 byte ciphertext
    expect(buf.length).toBeGreaterThanOrEqual(12 + 16 + 1)
  })
})
