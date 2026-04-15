/**
 * lib/tokenCrypto.ts
 * AES-256-GCM encryption for stored Cardcom payment tokens.
 * Key source: CARDCOM_TOKEN_ENCRYPTION_KEY (base64 of 32 bytes, or any string → SHA-256).
 */

import crypto from "node:crypto"

type EncryptedTokenV1 = {
  v:       1
  alg:     "A256GCM"
  iv_b64:  string
  ct_b64:  string
  tag_b64: string
}

function getKey(): Buffer {
  const raw = (process.env.CARDCOM_TOKEN_ENCRYPTION_KEY ?? "").trim()
  if (!raw) throw new Error("Missing CARDCOM_TOKEN_ENCRYPTION_KEY")
  const buf = Buffer.from(raw, "base64")
  if (buf.length === 32) return buf
  // Fallback: derive 32 bytes via SHA-256 (for short/legacy keys)
  return crypto.createHash("sha256").update(raw, "utf8").digest()
}

function u8(b: ArrayLike<number>): Uint8Array { return Uint8Array.from(b) }

function concat(...chunks: Uint8Array[]): Buffer {
  let len = 0
  for (const c of chunks) len += c.byteLength
  const out = Buffer.allocUnsafe(len)
  let off = 0
  for (const c of chunks) { out.set(c, off); off += c.byteLength }
  return out
}

export function tokenHashSha256(token: string): string {
  return crypto.createHash("sha256").update(token.trim(), "utf8").digest("hex")
}

export function encryptToken(token: string): string {
  const key = u8(getKey())
  const iv  = crypto.randomBytes(12)
  const cip = crypto.createCipheriv("aes-256-gcm", key, u8(iv))
  const ct  = concat(u8(cip.update(token.trim(), "utf8")), u8(cip.final()))
  const tag = cip.getAuthTag()

  const payload: EncryptedTokenV1 = {
    v:       1,
    alg:     "A256GCM",
    iv_b64:  iv.toString("base64"),
    ct_b64:  ct.toString("base64"),
    tag_b64: tag.toString("base64"),
  }
  return JSON.stringify(payload)
}

export function decryptToken(tokenEnc: string): string {
  const key    = u8(getKey())
  const parsed = JSON.parse(tokenEnc) as Partial<EncryptedTokenV1>

  if (parsed?.v !== 1 || parsed?.alg !== "A256GCM") throw new Error("Invalid token format v1")
  if (!parsed.iv_b64 || !parsed.ct_b64 || !parsed.tag_b64) throw new Error("Incomplete token payload")

  const iv  = Buffer.from(parsed.iv_b64,  "base64")
  const ct  = Buffer.from(parsed.ct_b64,  "base64")
  const tag = Buffer.from(parsed.tag_b64, "base64")

  const dec = crypto.createDecipheriv("aes-256-gcm", key, u8(iv))
  dec.setAuthTag(u8(tag))
  return concat(u8(dec.update(u8(ct))), u8(dec.final())).toString("utf8")
}
