/**
 * Timezone-correct scheduling for the post-assessment follow-up emails.
 *
 * Requirement (Itzik 2026-07-09): the follow-ups go out at 10:00 Asia/Jerusalem
 * — a real wall-clock time, NOT a fixed hour offset — and DST-aware (10:00 IL =
 * 07:00 UTC in summer / IDT, 08:00 UTC in winter / IST). Shabbat rule: nothing
 * goes out on Saturday (IL); a slot that lands on Saturday moves to Sunday 10:00.
 *
 * results_ready is exempt — it fires ~immediately (t0 + 30 min). Everything
 * scheduled by day-offset uses tenAmIlDaysAfter().
 *
 * Pure functions of Date → Date; no server-local time assumptions (the old
 * setHours/getDay helpers ran in UTC on Vercel, so "10:00" was really 10:00 UTC).
 */

const IL_TZ = "Asia/Jerusalem";
const DAY_MS = 24 * 60 * 60 * 1000;

type YMD = { y: number; m0: number; d: number }; // m0 = 0-based month

/** IL wall-clock calendar date of an instant. */
function ilYMD(date: Date): YMD {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: IL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  return { y: Number(p.year), m0: Number(p.month) - 1, d: Number(p.day) };
}

/** IL day of week for an instant: 0=Sun … 6=Sat. */
export function ilWeekday(date: Date): number {
  const wd = new Intl.DateTimeFormat("en-US", { timeZone: IL_TZ, weekday: "short" }).format(date);
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[wd] ?? 0;
}

/** IL UTC offset (minutes) at a given instant — 120 (IST) or 180 (IDT). */
function ilOffsetMinutes(date: Date): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: IL_TZ,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  // Treat the IL wall-clock parts as if they were UTC; the gap is the offset.
  const asUTC = Date.UTC(
    Number(p.year),
    Number(p.month) - 1,
    Number(p.day),
    Number(p.hour === "24" ? "0" : p.hour),
    Number(p.minute),
    Number(p.second),
  );
  return Math.round((asUTC - date.getTime()) / 60000);
}

/** The UTC instant for hour:00 IL wall-clock on the given IL calendar date. */
function utcForIlWallclock({ y, m0, d }: YMD, hour: number): Date {
  const naive = Date.UTC(y, m0, d, hour, 0, 0); // wall-clock treated as UTC
  // Refine twice so a naive guess that straddles a DST transition still resolves.
  let off = ilOffsetMinutes(new Date(naive));
  let utc = naive - off * 60000;
  off = ilOffsetMinutes(new Date(utc));
  utc = naive - off * 60000;
  return new Date(utc);
}

/** IL calendar date `offsetDays` after `from`'s IL date (noon-anchored so the
 *  day arithmetic never trips a DST edge). */
function ilDatePlusDays(from: Date, offsetDays: number): YMD {
  const { y, m0, d } = ilYMD(from);
  const anchor = new Date(Date.UTC(y, m0, d, 12, 0, 0) + offsetDays * DAY_MS);
  return ilYMD(anchor);
}

/**
 * 10:00 Asia/Jerusalem on the IL calendar date `offsetDays` after `t0`, with the
 * Shabbat rule applied: if that day is Saturday (IL), move to Sunday 10:00 IL.
 */
export function tenAmIlDaysAfter(t0: Date, offsetDays: number, hour = 10): Date {
  let target = ilDatePlusDays(t0, offsetDays);
  let due = utcForIlWallclock(target, hour);
  if (ilWeekday(due) === 6) {
    // Saturday → next day (Sunday).
    target = ilDatePlusDays(t0, offsetDays + 1);
    due = utcForIlWallclock(target, hour);
  }
  return due;
}
