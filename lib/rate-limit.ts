/**
 * Tiny in-memory sliding-window rate limiter.
 *
 * Good enough to block casual brute force / script kiddies on a single
 * Node process. For multi-instance deployments swap the Map for Redis.
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

/** Best-effort IP extraction honouring common proxy headers. */
export function getClientIp(req: Request): string {
  const h = req.headers;
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? h.get("cf-connecting-ip") ?? "unknown";
}
