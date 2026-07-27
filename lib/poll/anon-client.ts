/**
 * lib/poll/anon-client.ts
 *
 * Client half of the anonymous poll identity. The server owns the
 * `poll_anon_id` cookie; this keeps a mirror in localStorage so the identity
 * survives a cookie that was cleared, expired or dropped by the browser.
 *
 * Order: cookie (authoritative) → localStorage → mint a new UUID. Whatever we
 * end up with is mirrored back into localStorage and sent on every poll request
 * (`x-poll-anon`), where the server adopts it and re-sets the cookie.
 */

const KEY = "poll_anon_id";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readCookie(): string | null {
  const m = document.cookie.match(/(?:^|;\s*)poll_anon_id=([^;]*)/);
  const v = m ? decodeURIComponent(m[1]).trim() : "";
  return v && UUID_RE.test(v) ? v : null;
}

function readStore(): string | null {
  try {
    const v = window.localStorage.getItem(KEY)?.trim() ?? "";
    return v && UUID_RE.test(v) ? v : null;
  } catch {
    return null; // private mode / storage blocked — cookie-only from here
  }
}

function writeStore(id: string): void {
  try { window.localStorage.setItem(KEY, id); } catch { /* storage blocked */ }
}

function mint(): string {
  const c = window.crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Non-secure context (crypto.randomUUID unavailable) — same v4 shape.
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

/** This device's stable anon id. Safe to call on every request. */
export function getClientPollAnonId(): string | null {
  if (typeof window === "undefined") return null;
  const id = readCookie() ?? readStore() ?? mint();
  writeStore(id);
  return id;
}

/** Headers to attach to a poll fetch so the server can recover the identity. */
export function pollAnonHeaders(extra?: Record<string, string>): Record<string, string> {
  const id = getClientPollAnonId();
  return id ? { ...extra, "x-poll-anon": id } : { ...extra };
}
