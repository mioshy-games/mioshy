/**
 * coach_welcome scheduling — "next day at 10:00 Israel time", cutoff 20:00.
 *
 * The daily 10:00 (Asia/Jerusalem) cron sends to every journey-joiner whose join
 * moment falls in the window [ day-before-yesterday 20:00 , yesterday 20:00 ) in
 * Israel time. That single 24h window implements the rule exactly:
 *   • joined BEFORE 20:00 on day D  → sent D+1 at 10:00
 *   • joined at/after 20:00 on day D → sent D+2 at 10:00
 *
 * Everything here is DST-aware (Asia/Jerusalem), following the Intl pattern in
 * lib/whatsapp/templates.ts (israelDayOrdinal). Pure + deterministic (takes an
 * explicit `now`) so the cutoff/DST rules are unit-testable.
 *
 * DST note: Vercel cron fires in UTC only. 10:00 Israel = 07:00 UTC in summer
 * (IDT, UTC+3) / 08:00 UTC in winter (IST, UTC+2). vercel.json registers BOTH
 * (0 7 * * *, 0 8 * * *) and the handler gates on `israelHour(now) === 10`, so
 * the real run happens once per day at 10:00 local in either season.
 */

export const ISRAEL_TZ = "Asia/Jerusalem";

/** The wall-clock hour (0..23) in Israel at instant `now`. */
export function israelHour(now: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ISRAEL_TZ,
    hour: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")!.value);
  return h === 24 ? 0 : h; // some engines emit "24" for midnight
}

/** Israel-local calendar Y/M/D of an instant. */
function israelYmd(d: Date): { y: number; m: number; d: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ISRAEL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  return { y: g("year"), m: g("month"), d: g("day") };
}

/** Asia/Jerusalem UTC offset (ms) at `instant` (= local wall clock − UTC). */
function israelOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ISRAEL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(instant);
  const g = (t: string) => Number(parts.find((p) => p.type === t)!.value);
  let hr = g("hour");
  if (hr === 24) hr = 0;
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), hr, g("minute"), g("second"));
  return asUtc - instant.getTime();
}

/**
 * UTC epoch-ms for a specific Israel wall-clock time (Y-M-D at `hour`:00:00),
 * DST-aware. `hour` is 0..23. Not used near the 02:00–03:00 DST switch (we only
 * pass 20:00), so the single-offset resolution is exact.
 */
export function israelWallToUtcMs(y: number, m: number, d: number, hour: number): number {
  const guess = Date.UTC(y, m - 1, d, hour, 0, 0);
  const off = israelOffsetMs(new Date(guess));
  return guess - off;
}

/**
 * The join-moment window for the 10:00 run on the Israel-day of `now`:
 * [ (Israel today − 2 days) 20:00 , (Israel today − 1 day) 20:00 ) as UTC ms.
 * A journey subscription whose created_at is in [lowerMs, upperMs) is due now.
 */
export function coachWelcomeWindow(now: Date): { lowerMs: number; upperMs: number } {
  const { y, m, d } = israelYmd(now);
  const dayNum = Math.floor(Date.UTC(y, m - 1, d) / 86_400_000);
  const prev1 = new Date((dayNum - 1) * 86_400_000); // Israel today − 1 day
  const prev2 = new Date((dayNum - 2) * 86_400_000); // Israel today − 2 days
  const upperMs = israelWallToUtcMs(prev1.getUTCFullYear(), prev1.getUTCMonth() + 1, prev1.getUTCDate(), 20);
  const lowerMs = israelWallToUtcMs(prev2.getUTCFullYear(), prev2.getUTCMonth() + 1, prev2.getUTCDate(), 20);
  return { lowerMs, upperMs };
}

/** True when a join instant is due to be sent by the 10:00 run on `now`'s day. */
export function isDueForCoachWelcome(joinedAt: Date, now: Date): boolean {
  const { lowerMs, upperMs } = coachWelcomeWindow(now);
  const t = joinedAt.getTime();
  return t >= lowerMs && t < upperMs;
}
