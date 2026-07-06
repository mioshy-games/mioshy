export function pickLocalized({
  locale,
  he,
  en,
}: {
  locale: string;
  he: string | null | undefined;
  en: string | null | undefined;
}) {
  const preferHe = locale === "he";
  const primary = preferHe ? he : en;
  const fallback = preferHe ? en : he;
  const usedLocale = primary ? locale : preferHe ? "en" : "he";
  return {
    value: (primary ?? fallback ?? "") as string,
    usedLocale,
    isFallback: Boolean(!primary && fallback),
  };
}

export function estimateReadingTimeMinutes(markdown: string) {
  const text = markdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*]\([^)]*\)/g, " ")
    .replace(/[#>*_~|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return 1;
  const words = text.split(" ").filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export function slugifyTitleEn(title: string) {
  return title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/**
 * PostgREST `.or(...)` clause for the public article visibility gate:
 * an article is live only when its publish schedule is empty or already past.
 * Chain it AFTER `.eq("is_published", true)`:
 *
 *   supabase.from("articles").eq("is_published", true).or(publicArticleOrClause())
 *
 * Admin / preview surfaces must NOT apply this — they see scheduled drafts.
 * `now` is injectable for tests; defaults to the real current instant so the
 * server-side time check drives auto-publish.
 */
export function publicArticleOrClause(now: Date = new Date()): string {
  return `scheduled_publish_at.is.null,scheduled_publish_at.lte.${now.toISOString()}`;
}

// The admin schedules articles in Israel wall-clock time, but the server runs
// in UTC and the DB stores UTC. These two helpers convert between an
// `<input type="datetime-local">` value ("YYYY-MM-DDTHH:mm", Israel time) and a
// UTC ISO string, DST-aware via the Asia/Jerusalem zone.
const SCHEDULE_TZ = "Asia/Jerusalem";

/** Israel wall-clock "YYYY-MM-DDTHH:mm" → UTC ISO. Timezone-independent (does
 *  not rely on the server's local zone): treat the wall time as if UTC, read
 *  back what that instant IS in Israel, and correct by the resulting offset. */
export function israelWallToUtcIso(local: string): string {
  const m = local.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return new Date(local).toISOString();
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const asIfUtc = Date.UTC(y, mo - 1, d, h, mi);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SCHEDULE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(new Date(asIfUtc));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? "0");
  const israelHour = g("hour") === 24 ? 0 : g("hour");
  const israelAsUtc = Date.UTC(
    g("year"),
    g("month") - 1,
    g("day"),
    israelHour,
    g("minute"),
    g("second"),
  );
  const offset = israelAsUtc - asIfUtc; // Israel is ahead of UTC → positive
  return new Date(asIfUtc - offset).toISOString();
}

/** UTC ISO → Israel wall-clock "YYYY-MM-DDTHH:mm" for a datetime-local input. */
export function utcIsoToIsraelWall(iso: string | null | undefined): string {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHEDULE_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const pick = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = pick("hour") === "24" ? "00" : pick("hour");
  return `${pick("year")}-${pick("month")}-${pick("day")}T${hour}:${pick("minute")}`;
}

