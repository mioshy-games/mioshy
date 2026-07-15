import "server-only";
import { createHmac, timingSafeEqual } from "crypto";

// ============================================================
// Unsubscribe token — HMAC-signed, no DB column, no login (Itzik 2026-07-16).
//
// A marketing email carries a per-recipient token in its unsubscribe link. The
// token binds the recipient's user id with an HMAC over UNSUBSCRIBE_TOKEN_SECRET,
// so the link is not guessable and needs no session. We sign the OPAQUE user id
// (a UUID) — never the email — so no personal data ever appears in the URL.
//
// If UNSUBSCRIBE_TOKEN_SECRET is unset, signing returns null (the email simply
// omits the custom link) and verification returns null (the page shows an
// "invalid link" state) — nothing crashes.
// ============================================================

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function b64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function secret(): string | null {
  const s = process.env.UNSUBSCRIBE_TOKEN_SECRET;
  return typeof s === "string" && s.trim().length >= 16 ? s.trim() : null;
}

function sign(userId: string, key: string): string {
  return b64url(
    createHmac("sha256", key).update(`unsub:v1:${userId}`).digest(),
  );
}

/** Sign a one-click unsubscribe token for a recipient. null if no secret. */
export function signUnsubscribeToken(userId: string): string | null {
  const key = secret();
  if (!key || !userId || !UUID_RE.test(userId)) return null;
  return `${b64url(Buffer.from(userId, "utf8"))}.${sign(userId, key)}`;
}

/** Verify a token and return the user id, or null if invalid/expired/unsigned. */
export function verifyUnsubscribeToken(
  token: string | null | undefined,
): string | null {
  const key = secret();
  if (!key || typeof token !== "string" || token.length < 8) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  let userId: string;
  try {
    userId = fromB64url(token.slice(0, dot)).toString("utf8");
  } catch {
    return null;
  }
  if (!UUID_RE.test(userId)) return null;
  const provided = Buffer.from(token.slice(dot + 1), "utf8");
  const expected = Buffer.from(sign(userId, key), "utf8");
  if (provided.length !== expected.length) return null;
  if (!timingSafeEqual(provided, expected)) return null;
  return userId;
}
