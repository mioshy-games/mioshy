import "server-only";

/**
 * Israel-local scheduling for the 7-day marathon.
 *
 * Vercel crons run in UTC and don't observe DST, so we never hardcode a UTC
 * hour. Instead the cron runs hourly and we compute the CURRENT Israel-local
 * date + hour here (via the IANA "Asia/Jerusalem" zone, which handles DST), and
 * decide who is due. Send slots depend on the weekday of the day's calendar
 * date: Sun–Thu 10:00, Fri 14:00, Sat 21:00 (Israel time).
 */

const TZ = "Asia/Jerusalem";

const dateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const hourFmt = new Intl.DateTimeFormat("en-GB", {
  timeZone: TZ,
  hour: "2-digit",
  hour12: false,
});

/** Current Israel-local calendar date as "YYYY-MM-DD". */
export function israelDate(at: Date = new Date()): string {
  return dateFmt.format(at); // en-CA → YYYY-MM-DD
}

/** Current Israel-local hour (0–23). */
export function israelHour(at: Date = new Date()): number {
  const h = parseInt(hourFmt.format(at), 10);
  // "24" can appear at midnight in some environments → normalise to 0.
  return Number.isFinite(h) ? h % 24 : 0;
}

/** Day-of-week (0=Sun … 6=Sat) of a "YYYY-MM-DD" calendar date. */
export function weekdayOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00Z`).getUTCDay();
}

/** Add N whole days to a "YYYY-MM-DD" date, returning "YYYY-MM-DD". */
export function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole-day difference (b - a) between two "YYYY-MM-DD" dates. */
export function daysBetween(a: string, b: string): number {
  const ms =
    new Date(`${b}T00:00:00Z`).getTime() - new Date(`${a}T00:00:00Z`).getTime();
  return Math.round(ms / 86_400_000);
}

/** The marathon day number (1-based) for a given calendar date. <1 = not started, >7 = finished. */
export function marathonDayFor(startedOn: string, dateStr: string): number {
  return daysBetween(startedOn, dateStr) + 1;
}

/** Send-slot hour (Israel local) for a weekday: Fri 14:00, Sat 21:00, else 10:00. */
export function slotHourForWeekday(weekday: number): number {
  if (weekday === 5) return 14; // Friday
  if (weekday === 6) return 21; // Saturday
  return 10; // Sun–Thu
}
