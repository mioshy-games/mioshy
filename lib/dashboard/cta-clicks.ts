import "server-only";

/**
 * lib/dashboard/cta-clicks.ts
 *
 * Server data layer for /dashboard/cta-clicks — the admin CTA-click dashboard.
 *
 * Reads the generic `click` analytics event (lib/analytics → /api/analytics/event
 * → public.analytics_events) filtered to a small, EXPLICIT allow-list of CTA
 * targets. Instrumented click sites tag each event with
 *   properties = { target: "<id>", label: "<visible text>", path: "<page>" }
 * (path is auto-added by track()). We aggregate per target: total clicks, unique
 * clicks (distinct device_id), and a per-path breakdown (so a CTA that renders on
 * several pages — e.g. subscribe_cta — is split by page). We also bucket the
 * clicks over time (hourly for a single day, daily for a range) for a trend.
 *
 * To add a CTA later: instrument the click with track("click", { target, label })
 * and add one row to CTA_TARGETS below. Nothing else changes.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";

// ─── The allow-list (single source of truth) ────────────────────────────────
// `target` MUST match the string passed to track("click", { target }) at the
// click site. `labelHe`/`labelEn` are the friendly names shown in the dashboard
// (independent of the per-event `label`, which is the raw visible text).
export interface CtaTarget {
  target: string;
  labelHe: string;
  labelEn: string;
}

export const CTA_TARGETS: readonly CtaTarget[] = [
  { target: "survey_daily_cta", labelHe: "סקר — הרשמה לשאלה יומית", labelEn: "Survey — daily-question signup" },
  { target: "survey_assessment_link", labelHe: "סקר — קישור לאבחון המלא", labelEn: "Survey — full-assessment link" },
  { target: "subscribe_cta", labelHe: "תוצאות — כפתור מנוי/תשלום", labelEn: "Results — subscribe/checkout button" },
] as const;

const TARGET_IDS = CTA_TARGETS.map((t) => t.target);

// ─── Range resolution (today / yesterday / 7d / custom) ─────────────────────
export type CtaRangeKey = "today" | "yesterday" | "7d" | "custom";
export type CtaGranularity = "hour" | "day";

export interface ResolvedCtaRange {
  key: CtaRangeKey;
  start: Date;
  end: Date;
  granularity: CtaGranularity;
  fromInput: string | null; // YYYY-MM-DD (custom only)
  toInput: string | null;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const TZ = "Asia/Jerusalem";

/** Wall-clock parts of an instant in Asia/Jerusalem. */
function israelParts(at: Date): {
  y: number; m: number; d: number; hh: number; mm: number; ss: number;
} {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
  const p = dtf.formatToParts(at).reduce<Record<string, string>>((a, x) => {
    a[x.type] = x.value; return a;
  }, {});
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute, ss: +p.second };
}

/** Israel UTC offset (minutes) at a given instant — DST-correct. */
function israelOffsetMinutes(at: Date): number {
  const p = israelParts(at);
  const asUTC = Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss);
  return (asUTC - at.getTime()) / 60000;
}

/**
 * The UTC instant of 00:00 Asia/Jerusalem for the calendar date (y,m,d), offset
 * by `plusDays`. Offset is measured at local noon of that date so a night-time
 * DST transition can't skew it.
 */
function israelMidnight(y: number, m: number, d: number, plusDays = 0): Date {
  const noon = new Date(Date.UTC(y, m - 1, d + plusDays, 12, 0, 0));
  const off = israelOffsetMinutes(noon);
  return new Date(Date.UTC(y, m - 1, d + plusDays, 0, 0, 0) - off * 60000);
}

/** Parse a YYYY-MM-DD string → {y,m,d} or null. */
function parseYmd(s: string | undefined | null): { y: number; m: number; d: number } | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  return { y: +m[1], m: +m[2], d: +m[3] };
}

export function resolveCtaRange(
  sp: { range?: string; from?: string; to?: string } | undefined,
): ResolvedCtaRange {
  const now = new Date();
  const today = israelParts(now); // Israel "today" calendar date

  const wantsCustom =
    sp?.range === "custom" || (!sp?.range && (!!sp?.from || !!sp?.to));

  if (wantsCustom) {
    const fromYmd = parseYmd(sp?.from);
    const toYmd = parseYmd(sp?.to);
    // Defaults: missing from → today; missing to → same as from (single day).
    const f = fromYmd ?? { y: today.y, m: today.m, d: today.d };
    const t = toYmd ?? f;
    const start = israelMidnight(f.y, f.m, f.d);
    let end = israelMidnight(t.y, t.m, t.d, 1); // inclusive of the whole `to` day
    if (end <= start) end = new Date(start.getTime() + DAY_MS); // guard reversed input
    // Cap the visible end at "now" for the current day, so buckets don't run
    // into the future; keep full end for past-only ranges.
    if (end > now) end = now;
    const spanDays = Math.round((israelMidnight(t.y, t.m, t.d, 1).getTime() - start.getTime()) / DAY_MS);
    return {
      key: "custom",
      start,
      end,
      granularity: spanDays <= 1 ? "hour" : "day",
      fromInput: sp?.from ?? null,
      toInput: sp?.to ?? null,
    };
  }

  if (sp?.range === "yesterday") {
    const start = israelMidnight(today.y, today.m, today.d, -1);
    const end = israelMidnight(today.y, today.m, today.d, 0);
    return { key: "yesterday", start, end, granularity: "hour", fromInput: null, toInput: null };
  }

  if (sp?.range === "7d") {
    // Last 7 calendar days including today (6 full days back → now).
    const start = israelMidnight(today.y, today.m, today.d, -6);
    return { key: "7d", start, end: now, granularity: "day", fromInput: null, toInput: null };
  }

  // Default: today (Israel calendar day → now), hourly.
  const start = israelMidnight(today.y, today.m, today.d, 0);
  return { key: "today", start, end: now, granularity: "hour", fromInput: null, toInput: null };
}

// ─── Aggregated result shapes ────────────────────────────────────────────────
export interface CtaPathRow {
  path: string;
  total: number;
  unique: number;
}

export interface CtaRow {
  target: string;
  labelHe: string;
  labelEn: string;
  total: number;
  unique: number;
  /** Per-page split, most-clicked first (relevant when a CTA renders on
   *  multiple pages, e.g. subscribe_cta). */
  paths: CtaPathRow[];
}

export interface CtaBucket {
  /** ISO start of the bucket. */
  startIso: string;
  /** Short label for display (e.g. "14:00" hourly, "07-16" daily). */
  label: string;
  /** Per-target totals for this bucket + the row total. */
  perTarget: Record<string, number>;
  total: number;
}

export interface CtaClicksData {
  generatedAt: string;
  granularity: CtaGranularity;
  rows: CtaRow[]; // one per CTA_TARGETS entry (order preserved)
  buckets: CtaBucket[];
  totalClicks: number;
  totalUnique: number;
  /** true when the row cap was hit (aggregates may undercount — very high volume). */
  capped: boolean;
  degraded: boolean; // service role unavailable
}

const ROW_CAP = 50000;

interface RawRow {
  device_id: string | null;
  created_at: string;
  properties: { target?: string; path?: string } | null;
}

/** Bucket key + label for a click at `at`, given granularity. */
function bucketFor(at: Date, gran: CtaGranularity): { key: string; label: string; startIso: string } {
  const p = israelParts(at);
  if (gran === "hour") {
    const key = `${p.y}-${p.m}-${p.d}-${p.hh}`;
    const startIso = israelMidnight(p.y, p.m, p.d).toISOString(); // day base; hour added below
    return {
      key,
      label: `${String(p.hh).padStart(2, "0")}:00`,
      startIso: new Date(new Date(startIso).getTime() + p.hh * 60 * 60 * 1000).toISOString(),
    };
  }
  const key = `${p.y}-${p.m}-${p.d}`;
  return {
    key,
    label: `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}`,
    startIso: israelMidnight(p.y, p.m, p.d).toISOString(),
  };
}

export async function getCtaClicks(r: ResolvedCtaRange): Promise<CtaClicksData> {
  const admin = createServiceRoleClient();
  const base: CtaClicksData = {
    generatedAt: new Date().toISOString(),
    granularity: r.granularity,
    rows: CTA_TARGETS.map((t) => ({
      target: t.target, labelHe: t.labelHe, labelEn: t.labelEn,
      total: 0, unique: 0, paths: [],
    })),
    buckets: [],
    totalClicks: 0,
    totalUnique: 0,
    capped: false,
    degraded: false,
  };
  if (!admin) return { ...base, degraded: true };

  const { data, error } = await admin
    .from("analytics_events")
    .select("device_id, created_at, properties")
    .eq("event", "click")
    // jsonb arrow filter — raw PostgREST `in.(...)` over properties->>target.
    .filter("properties->>target", "in", `(${TARGET_IDS.join(",")})`)
    .gte("created_at", r.start.toISOString())
    .lt("created_at", r.end.toISOString())
    .order("created_at", { ascending: true })
    .limit(ROW_CAP);

  if (error || !data) return { ...base, degraded: !!error };

  const rows = data as RawRow[];
  const capped = rows.length >= ROW_CAP;

  // Per-target aggregation (with per-path + unique-device sets).
  type Agg = { total: number; devices: Set<string>; paths: Map<string, { total: number; devices: Set<string> }> };
  const byTarget = new Map<string, Agg>();
  for (const t of TARGET_IDS) byTarget.set(t, { total: 0, devices: new Set(), paths: new Map() });

  // Time buckets (dense — pre-seed every bucket in range so gaps render as 0).
  const bucketMap = new Map<string, CtaBucket>();
  const seedBuckets = () => {
    const stepMs = r.granularity === "hour" ? 60 * 60 * 1000 : DAY_MS;
    // Align the first bucket to its natural boundary.
    let cursor = new Date(bucketFor(r.start, r.granularity).startIso);
    let guard = 0;
    while (cursor < r.end && guard < 1000) {
      const b = bucketFor(cursor, r.granularity);
      if (!bucketMap.has(b.key)) {
        const perTarget: Record<string, number> = {};
        for (const t of TARGET_IDS) perTarget[t] = 0;
        bucketMap.set(b.key, { startIso: b.startIso, label: b.label, perTarget, total: 0 });
      }
      cursor = new Date(cursor.getTime() + stepMs);
      guard++;
    }
  };
  seedBuckets();

  const allDevices = new Set<string>();
  for (const row of rows) {
    const target = row.properties?.target;
    if (!target || !byTarget.has(target)) continue;
    const path = row.properties?.path || "(unknown)";
    const dev = row.device_id || `anon:${row.created_at}`; // fall back so unique never over-merges nulls

    const agg = byTarget.get(target)!;
    agg.total += 1;
    agg.devices.add(dev);
    let pathAgg = agg.paths.get(path);
    if (!pathAgg) { pathAgg = { total: 0, devices: new Set() }; agg.paths.set(path, pathAgg); }
    pathAgg.total += 1;
    pathAgg.devices.add(dev);
    allDevices.add(dev);

    const b = bucketFor(new Date(row.created_at), r.granularity);
    let bucket = bucketMap.get(b.key);
    if (!bucket) {
      const perTarget: Record<string, number> = {};
      for (const t of TARGET_IDS) perTarget[t] = 0;
      bucket = { startIso: b.startIso, label: b.label, perTarget, total: 0 };
      bucketMap.set(b.key, bucket);
    }
    bucket.perTarget[target] = (bucket.perTarget[target] ?? 0) + 1;
    bucket.total += 1;
  }

  const outRows: CtaRow[] = CTA_TARGETS.map((t) => {
    const agg = byTarget.get(t.target)!;
    const paths: CtaPathRow[] = [...agg.paths.entries()]
      .map(([path, pa]) => ({ path, total: pa.total, unique: pa.devices.size }))
      .sort((a, b) => b.total - a.total);
    return {
      target: t.target, labelHe: t.labelHe, labelEn: t.labelEn,
      total: agg.total, unique: agg.devices.size, paths,
    };
  });

  const buckets = [...bucketMap.values()].sort((a, b) => a.startIso.localeCompare(b.startIso));

  return {
    generatedAt: base.generatedAt,
    granularity: r.granularity,
    rows: outRows,
    buckets,
    totalClicks: rows.length,
    totalUnique: allDevices.size,
    capped,
    degraded: false,
  };
}
