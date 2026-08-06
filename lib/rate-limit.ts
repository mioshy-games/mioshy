/**
 * Tiny in-memory sliding-window rate limiter.
 *
 * Good enough to block casual brute force / script kiddies on a single
 * Node process.
 *
 * ⚠️ LIMITATION (audit 2026-08-05, H3): this Map is per-instance and per-cold-
 * start. On Vercel the effective limit is therefore (configured limit × number
 * of live instances), and it resets whenever an instance is recycled. Moving
 * the buckets to a shared store is an infrastructure decision that has not been
 * made — see FOLLOWUPS.md. The IP-derivation bug below WAS fixed, which is what
 * made the limits bypassable outright rather than merely loose.
 *
 * Usage:
 *   const { ok, retryAfterSec } = checkRateLimit(`leads:${ip}`, 10, 600);
 *   if (!ok) return NextResponse.json({ success: false, message: "Slow down" }, { status: 429 });
 */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

// Opportunistic cleanup so the Map doesn't grow unbounded. Called on each
// check; amortized O(1) per call with O(n) sweep every ~1000 calls.
let opsSinceCleanup = 0;
function maybeCleanup(nowMs: number) {
  opsSinceCleanup += 1;
  if (opsSinceCleanup < 1000) return;
  opsSinceCleanup = 0;
  // Drop buckets whose newest entry is older than 1 hour.
  const cutoff = nowMs - 60 * 60 * 1000;
  const staleKeys: string[] = [];
  buckets.forEach((b, k) => {
    const newest = b.timestamps[b.timestamps.length - 1] ?? 0;
    if (newest < cutoff) staleKeys.push(k);
  });
  staleKeys.forEach((k) => buckets.delete(k));
}

/**
 * Returns `ok: true` when the caller is under the limit, else `ok: false`
 * with the number of seconds to wait before trying again.
 *
 * @param key     - unique bucket key (e.g. `leads:${ip}:${deviceId}`)
 * @param limit   - max number of requests within `windowSec`
 * @param windowSec - sliding window length in seconds
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowSec: number,
): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  maybeCleanup(now);

  const windowMs = windowSec * 1000;
  const bucket = buckets.get(key) ?? { timestamps: [] };

  // Drop timestamps that fell out of the window.
  const cutoff = now - windowMs;
  const fresh = bucket.timestamps.filter((t) => t >= cutoff);

  if (fresh.length >= limit) {
    const oldest = fresh[0] ?? now;
    const retry  = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    buckets.set(key, { timestamps: fresh });
    return { ok: false, retryAfterSec: retry };
  }

  fresh.push(now);
  buckets.set(key, { timestamps: fresh });
  return { ok: true, retryAfterSec: 0 };
}

/**
 * Client IP for rate-limiting purposes.
 *
 * Audit 2026-08-05, H3.
 *
 * This used to return the LEFTMOST value of `X-Forwarded-For`. That entry is
 * whatever the client sent — every proxy appends, so the left of the chain is
 * unverified attacker input. A single request with
 * `X-Forwarded-For: 1.2.3.4` got its own fresh bucket, and varying that header
 * gave unlimited attempts against every rate-limited route, including the
 * Cardcom callback and the auth endpoints.
 *
 * Order of trust:
 *   1. `cf-connecting-ip` — set by Cloudflare, stripped from client input.
 *   2. `x-real-ip`        — set by the edge/proxy, likewise not client-settable.
 *   3. the RIGHTMOST `x-forwarded-for` entry — the hop appended by our own
 *      infrastructure, i.e. the only entry the client could not forge.
 *
 * The rightmost entry is the correct choice for a single trusted proxy, which
 * is what Vercel is. With a chain of N trusted proxies you would take the
 * (N+1)-th from the right; we have one.
 */
export function getClientIp(req: Request): string {
  const h = req.headers;

  const cf = h.get("cf-connecting-ip")?.trim();
  if (cf) return cf;

  const real = h.get("x-real-ip")?.trim();
  if (real) return real;

  const xff = h.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    const rightmost = parts[parts.length - 1];
    if (rightmost) return rightmost;
  }

  return "unknown";
}
