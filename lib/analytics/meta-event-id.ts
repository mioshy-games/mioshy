/**
 * Deterministic Meta event ids — the SAME id is produced on the browser (Pixel)
 * and the server (CAPI) so Meta deduplicates the two layers. Derived purely from
 * an entity id (checkout session / user) so nothing needs to round-trip through
 * Cardcom. Shared (no side effects) so it's safe to import from both sides.
 */

/**
 * SHA-256 hex, via Web Crypto so the one implementation runs unchanged in the
 * browser and in Node (globalThis.crypto.subtle exists in both).
 */
async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Normalisation applied before hashing an email.
 *
 * Identical to `hash()` in lib/analytics/meta-capi.ts (trim + lowercase) — the
 * two must not drift, or the Pixel and CAPI ids stop matching and Meta counts
 * every lead twice.
 */
export function normalizeEmailForEventId(email: string): string {
  return email.trim().toLowerCase();
}

export const metaEventId = {
  purchase: (sessionId: string) => `purchase.${sessionId}`,
  checkout: (sessionId: string) => `checkout.${sessionId}`,
  registration: (userId: string) => `register.${userId}`,
};

/**
 * "Submit form" Lead id, keyed by the submitted email.
 *
 * Audit 2026-08-05, H7. This used to be `lead.${email}` — the raw address, in
 * plaintext, sent to Meta as the eventID from the browser. It is now the
 * SHA-256 of the normalised address, so the id still matches across Pixel and
 * CAPI but carries no readable PII.
 *
 * It also fixes a live dedup bug: the browser passed the address exactly as
 * typed while the server passed `trim().toLowerCase()`, so any capitalised or
 * space-padded input produced two different ids and Meta counted the lead
 * twice. Both sides now go through this one function.
 *
 * Async because Web Crypto is async; callers must await it.
 */
export async function metaLeadEventId(email: string): Promise<string> {
  return `lead.${await sha256Hex(normalizeEmailForEventId(email))}`;
}
