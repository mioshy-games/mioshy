/**
 * Assessment-funnel data layer (assessment-funnel-analytics-brief §1.1).
 *
 * One service-role function that, for a single assessment + date range +
 * day/week granularity, returns the full funnel (intro → started → completed →
 * registered → purchased → partner-invited → first-chapter), per-question
 * drop-off, a bucketed time series for the head stages, and the behavioural
 * layer (referrers, pages/session, exit targets, dwell).
 *
 * Reads analytics_events (the step-0 markers + page_view + dwell + the new
 * checkout_started anchor) and the existing product tables. All tables are
 * RLS-locked to service_role, so callers MUST pass the service-role client
 * (createServiceRoleClient) from an admin-gated server context. Metadata only —
 * no intimate content (privacy approach A).
 *
 * Conventions (brief §3.1, §1.1):
 *  • Counts are COUNT(DISTINCT identity) where identity = device_id ?? session_id
 *    ?? user_id, so an ad-blocked or anonymous visitor is still de-duped and the
 *    server-side `assessment_registered` marker (session_id null) lines up with
 *    the client markers by device_id.
 *  • Day/week buckets are computed in Asia/Jerusalem; a week starts on SUNDAY
 *    (Israel), not Postgres' Monday `date_trunc('week')`.
 *  • Purchase attribution is v1/event-based: a journey subscription is credited
 *    to the assessment when the buyer started checkout with
 *    source="assessment_<id>" (anon checkout bridged to the user via the
 *    markers' device/session → user map). Soft by design — see §6.
 *  • Conversion ratios are div-by-zero guarded (null when the denominator is 0).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const JERUSALEM_TZ = "Asia/Jerusalem";
const PAGE = 1000; // PostgREST default page size
const CHUNK = 150; // max ids per `.in(...)` to keep URLs sane
const TOP_N = 10; // referrers / exit targets shown

export type FunnelGranularity = "day" | "week";

export interface AssessmentFunnelParams {
  assessmentId: string;
  /** Inclusive Jerusalem calendar date, YYYY-MM-DD. */
  from: string;
  /** Inclusive Jerusalem calendar date, YYYY-MM-DD. */
  to: string;
  granularity: FunnelGranularity;
}

export interface FunnelCounts {
  introViews: number;
  started: number;
  completed: number;
  registered: number;
  purchased: number;
  /** Cohort owners who shared the pair code/link (partner_invite_shared event). */
  partnerInvited: number;
  /** Cohort owners whose couple now has a joined partner (couple_members). */
  partnerJoined: number;
  firstChapterViewed: number;
}

export interface FunnelBucket {
  /** Bucket start (YYYY-MM-DD): the day, or the Sunday of the week. */
  bucket: string;
  introViews: number;
  started: number;
  completed: number;
  registered: number;
}

export interface DropoffStep {
  /** current_step = number of answers saved; the question they're stuck on. */
  step: number;
  stuck: number;
}

export interface BehavioralSummary {
  topReferrers: { referrer: string; sessions: number }[];
  avgPagesPerSession: number | null;
  exitTargets: { path: string; count: number }[];
  avgDwellMs: number | null;
}

export interface AssessmentFunnel {
  params: AssessmentFunnelParams & { tz: string };
  totals: FunnelCounts;
  /** Cross-check of `completed` against assessment_sessions.status='complete'. */
  completedFromDb: number;
  /** Step-to-step conversion %, div-by-zero guarded (null when denom = 0). */
  conversions: {
    startedRate: number | null; // started / intro
    completedRate: number | null; // completed / started
    registeredRate: number | null; // registered / completed
    purchasedRate: number | null; // purchased / registered
    partnerJoinRate: number | null; // partnerJoined / partnerInvited
  };
  buckets: FunnelBucket[];
  dropoff: DropoffStep[];
  behavioral: BehavioralSummary;
  /**
   * Non-fatal degradations (e.g. an optional cross-product table absent in this
   * environment). The affected stage returns 0 rather than crashing the funnel;
   * the message says which. Empty in the happy path.
   */
  warnings: string[];
}

// ── Row shapes (untyped client → we annotate what we select) ─────────────────
type MarkerRow = {
  event: string;
  device_id: string | null;
  session_id: string | null;
  user_id: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
};
type EventRow = {
  session_id: string | null;
  properties: Record<string, unknown> | null;
  created_at: string;
};
type CheckoutRow = Omit<MarkerRow, "event">;
type SessionRow = {
  id: string;
  user_id: string | null;
  status: string;
  current_step: number;
  created_at: string;
};
type SubRow = { user_id: string };
type OwnerRow = { couple_id: string; user_id: string };
type PartnerRow = { couple_id: string };
type InviteEventRow = { user_id: string | null };
type ActivityRow = { user_id: string };

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

// ── TZ + identity helpers ────────────────────────────────────────────────────
const jdateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: JERUSALEM_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Calendar date (YYYY-MM-DD) of an instant, in Asia/Jerusalem. */
function jerusalemDate(iso: string): string {
  return jdateFmt.format(new Date(iso));
}

/** The Sunday (YYYY-MM-DD) of the week containing a Jerusalem calendar date. */
function weekStartSunday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // getUTCDay: 0=Sun … 6=Sat
  return d.toISOString().slice(0, 10);
}

function bucketOf(iso: string, g: FunnelGranularity): string {
  const day = jerusalemDate(iso);
  return g === "week" ? weekStartSunday(day) : day;
}

/** Stable per-person key across client (device/session) + server (device) rows. */
function identity(r: {
  device_id: string | null;
  session_id: string | null;
  user_id: string | null;
}): string | null {
  return r.device_id ?? r.session_id ?? r.user_id ?? null;
}

function pstr(p: Record<string, unknown> | null, key: string): string | null {
  const v = p?.[key];
  return typeof v === "string" && v.length > 0 ? v : null;
}

function pnum(p: Record<string, unknown> | null, key: string): number | null {
  const v = p?.[key];
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : null;
}

function inRange(day: string, from: string, to: string): boolean {
  return day >= from && day <= to; // lexicographic works for YYYY-MM-DD
}

function rate(num: number, den: number): number | null {
  return den > 0 ? Math.round((num / den) * 100) : null;
}

function distinctCount(values: (string | null)[]): number {
  const s = new Set<string>();
  for (const v of values) if (v) s.add(v);
  return s.size;
}

// ── Paginated fetch helpers (correctness over the 1000-row page cap) ─────────
async function fetchAll<T>(
  make: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const out: T[] = [];
  for (let off = 0; ; off += PAGE) {
    const { data, error } = await make(off, off + PAGE - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

async function fetchByIds<T>(
  ids: string[],
  make: (chunk: string[], from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    for (let off = 0; ; off += PAGE) {
      const { data, error } = await make(chunk, off, off + PAGE - 1);
      if (error) throw new Error(error.message);
      const rows = data ?? [];
      out.push(...rows);
      if (rows.length < PAGE) break;
    }
  }
  return out;
}

const MARKER_EVENTS = [
  "assessment_intro_viewed",
  "assessment_started",
  "assessment_completed",
  "assessment_registered",
] as const;

/**
 * Load the assessment funnel. `admin` MUST be a service-role client.
 */
export async function loadAssessmentFunnel(
  admin: SupabaseClient,
  params: AssessmentFunnelParams,
): Promise<AssessmentFunnel> {
  const { assessmentId, from, to, granularity } = params;
  const warnings: string[] = [];

  // A downstream cross-product table can be absent/renamed in a given
  // environment (e.g. couple_invitations). Degrade that one stage to 0 with a
  // warning instead of failing the whole funnel.
  async function safeFetch<T>(label: string, run: () => Promise<T[]>): Promise<T[]> {
    try {
      return await run();
    } catch (e) {
      warnings.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  }

  // Widen the SQL window by ±1 day around the Jerusalem range, then filter
  // precisely by Jerusalem calendar date in JS — DST-safe without hardcoding
  // an offset.
  const loD = new Date(`${from}T00:00:00Z`);
  loD.setUTCDate(loD.getUTCDate() - 1);
  const hiD = new Date(`${to}T00:00:00Z`);
  hiD.setUTCDate(hiD.getUTCDate() + 2);
  const loIso = loD.toISOString();
  const hiIso = hiD.toISOString();

  // ── 1. Funnel-head markers ────────────────────────────────────────────────
  const markersRaw = await fetchAll<MarkerRow>((f, t) =>
    admin
      .from("analytics_events")
      .select("event, device_id, session_id, user_id, properties, created_at")
      .in("event", MARKER_EVENTS as unknown as string[])
      .eq("properties->>assessment_id", assessmentId)
      .gte("created_at", loIso)
      .lte("created_at", hiIso)
      .order("created_at", { ascending: true })
      .range(f, t)
      .returns<MarkerRow[]>(),
  );
  const markers = markersRaw.filter((m) =>
    inRange(jerusalemDate(m.created_at), from, to),
  );

  // Per-stage distinct identities (totals) + per-bucket distinct identities.
  const totalSets: Record<string, Set<string>> = {
    assessment_intro_viewed: new Set(),
    assessment_started: new Set(),
    assessment_completed: new Set(),
    assessment_registered: new Set(),
  };
  const bucketSets = new Map<string, Record<string, Set<string>>>();
  // device/session → user maps (for anon → user bridging in attribution).
  const deviceToUser = new Map<string, string>();
  const sessionToUser = new Map<string, string>();
  const markerUserIds = new Set<string>();
  const engagedSessions = new Set<string>();

  for (const m of markers) {
    const id = identity(m);
    if (id) {
      totalSets[m.event]?.add(id);
      const b = bucketOf(m.created_at, granularity);
      let rec = bucketSets.get(b);
      if (!rec) {
        rec = {
          assessment_intro_viewed: new Set(),
          assessment_started: new Set(),
          assessment_completed: new Set(),
          assessment_registered: new Set(),
        };
        bucketSets.set(b, rec);
      }
      rec[m.event]?.add(id);
    }
    if (m.session_id) engagedSessions.add(m.session_id);
    if (m.user_id) {
      markerUserIds.add(m.user_id);
      if (m.device_id) deviceToUser.set(m.device_id, m.user_id);
      if (m.session_id) sessionToUser.set(m.session_id, m.user_id);
    }
  }

  // ── 2. Sessions (drop-off + completed cross-check + registered cohort) ─────
  const sessionsRaw = await fetchAll<SessionRow>((f, t) =>
    admin
      .from("assessment_sessions")
      .select("id, user_id, status, current_step, created_at")
      .eq("assessment_id", assessmentId)
      .gte("created_at", loIso)
      .lte("created_at", hiIso)
      .order("created_at", { ascending: true })
      .range(f, t)
      .returns<SessionRow[]>(),
  );
  const sessions = sessionsRaw.filter((s) =>
    inRange(jerusalemDate(s.created_at), from, to),
  );

  // Drop-off: high-water-mark step of still-in-progress sessions.
  const stepStuck = new Map<number, number>();
  let completedFromDb = 0;
  const registeredUserIds = new Set<string>(markerUserIds);
  for (const s of sessions) {
    if (s.status === "in_progress") {
      stepStuck.set(s.current_step, (stepStuck.get(s.current_step) ?? 0) + 1);
    } else if (s.status === "complete") {
      completedFromDb += 1;
    }
    if (s.user_id) registeredUserIds.add(s.user_id);
  }
  const dropoff: DropoffStep[] = Array.from(stepStuck.entries())
    .map(([step, stuck]) => ({ step, stuck }))
    .sort((a, b) => a.step - b.step);

  // ── 3. Purchase attribution (v1, event-anchored) ──────────────────────────
  const checkoutsRaw = await fetchAll<CheckoutRow>((f, t) =>
    admin
      .from("analytics_events")
      .select("device_id, session_id, user_id, properties, created_at")
      .eq("event", "checkout_started")
      .eq("properties->>source", `assessment_${assessmentId}`)
      .gte("created_at", loIso)
      .lte("created_at", hiIso)
      .range(f, t)
      .returns<CheckoutRow[]>(),
  );
  const checkouts = checkoutsRaw.filter((c) =>
    inRange(jerusalemDate(c.created_at), from, to),
  );
  // Resolve every checkout identity to a user (direct user_id, else bridge the
  // anonymous device/session to a user via the markers), then keep only those
  // who actually belong to this assessment's registered cohort.
  const attributedUserIds = new Set<string>();
  for (const c of checkouts) {
    const uid =
      c.user_id ??
      (c.device_id ? deviceToUser.get(c.device_id) : undefined) ??
      (c.session_id ? sessionToUser.get(c.session_id) : undefined) ??
      null;
    if (uid && registeredUserIds.has(uid)) attributedUserIds.add(uid);
  }

  const attributedIds = [...attributedUserIds];
  const subs = attributedIds.length
    ? await safeFetch("subscriptions", () =>
        fetchByIds<SubRow>(attributedIds, (chunk, f, t) =>
          admin
            .from("subscriptions")
            .select("user_id")
            .eq("product", "journey")
            .eq("status", "active")
            .in("user_id", chunk)
            .range(f, t)
            .returns<SubRow[]>(),
        ),
      )
    : [];
  const purchasedUserIds = new Set(subs.map((s) => s.user_id));
  const purchased = purchasedUserIds.size;

  // ── 4. Partner (invited + joined) + first chapter (cohort conversions) ────
  // couple_invitations does not exist in this DB (it was abandoned). The live
  // pairing is couple_members (mig 029): an 'owner' row is created with the
  // couple; a 'partner' row is added when a partner joins (both share-code and
  // email paths). So:
  //   • invited = cohort owners who fired partner_invite_shared (logged-in →
  //     attribute by user_id).
  //   • joined  = cohort owners whose couple also has a 'partner' row.
  const cohort = [...registeredUserIds];
  const [inviteEvents, owners, activity] = await Promise.all([
    cohort.length
      ? safeFetch("partner_invite_shared", () =>
          fetchByIds<InviteEventRow>(cohort, (chunk, f, t) =>
            admin
              .from("analytics_events")
              .select("user_id")
              .eq("event", "partner_invite_shared")
              .in("user_id", chunk)
              .range(f, t)
              .returns<InviteEventRow[]>(),
          ),
        )
      : Promise.resolve([] as InviteEventRow[]),
    cohort.length
      ? safeFetch("couple_members(owner)", () =>
          fetchByIds<OwnerRow>(cohort, (chunk, f, t) =>
            admin
              .from("couple_members")
              .select("couple_id, user_id")
              .eq("role", "owner")
              .in("user_id", chunk)
              .range(f, t)
              .returns<OwnerRow[]>(),
          ),
        )
      : Promise.resolve([] as OwnerRow[]),
    cohort.length
      ? safeFetch("journey_user_activity", () =>
          fetchByIds<ActivityRow>(cohort, (chunk, f, t) =>
            admin
              .from("journey_user_activity")
              .select("user_id")
              .eq("verb", "item_opened")
              .in("user_id", chunk)
              .range(f, t)
              .returns<ActivityRow[]>(),
          ),
        )
      : Promise.resolve([] as ActivityRow[]),
  ]);
  const partnerInvited = distinctCount(inviteEvents.map((e) => e.user_id));

  // Which of those owners' couples have a joined partner?
  const ownerCoupleIds = [...new Set(owners.map((o) => o.couple_id))];
  const partners = ownerCoupleIds.length
    ? await safeFetch("couple_members(partner)", () =>
        fetchByIds<PartnerRow>(ownerCoupleIds, (chunk, f, t) =>
          admin
            .from("couple_members")
            .select("couple_id")
            .eq("role", "partner")
            .in("couple_id", chunk)
            .range(f, t)
            .returns<PartnerRow[]>(),
        ),
      )
    : [];
  const coupleHasPartner = new Set(partners.map((p) => p.couple_id));
  const partnerJoined = distinctCount(
    owners.filter((o) => coupleHasPartner.has(o.couple_id)).map((o) => o.user_id),
  );

  const firstChapterViewed = distinctCount(activity.map((a) => a.user_id));

  // ── 5. Behavioural layer (referrers / pages / exit / dwell) ───────────────
  const sessionIds = [...engagedSessions];
  const [pageViews, dwellRows] = await Promise.all([
    sessionIds.length
      ? fetchByIds<EventRow>(sessionIds, (chunk, f, t) =>
          admin
            .from("analytics_events")
            .select("session_id, properties, created_at")
            .eq("event", "page_view")
            .in("session_id", chunk)
            .order("created_at", { ascending: true })
            .range(f, t)
            .returns<EventRow[]>(),
        )
      : Promise.resolve([] as EventRow[]),
    fetchAll<EventRow>((f, t) =>
      admin
        .from("analytics_events")
        .select("session_id, properties, created_at")
        .eq("event", "dwell")
        .eq("properties->>pillar", "assessment")
        .eq("properties->>item_id", assessmentId)
        .gte("created_at", loIso)
        .lte("created_at", hiIso)
        .range(f, t)
        .returns<EventRow[]>(),
    ),
  ]);

  // Group page_views by session (already time-ordered per chunk; re-sort to be
  // safe across chunk boundaries).
  const bySession = new Map<string, EventRow[]>();
  for (const pv of pageViews) {
    if (!pv.session_id) continue;
    const arr = bySession.get(pv.session_id) ?? [];
    arr.push(pv);
    bySession.set(pv.session_id, arr);
  }
  const referrerCount = new Map<string, number>();
  const exitCount = new Map<string, number>();
  const pagesPer: number[] = [];
  const assessPath = `/assessments/${assessmentId}`;
  for (const arr of bySession.values()) {
    arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    pagesPer.push(arr.length);
    // entry referrer = first page_view's referrer
    const ref = pstr(arr[0]?.properties ?? null, "referrer");
    if (ref) referrerCount.set(ref, (referrerCount.get(ref) ?? 0) + 1);
    // exit target = the page_view right after the LAST one on this assessment
    let lastAssessIdx = -1;
    for (let i = 0; i < arr.length; i++) {
      if (pstr(arr[i].properties, "path")?.includes(assessPath)) lastAssessIdx = i;
    }
    if (lastAssessIdx >= 0 && lastAssessIdx < arr.length - 1) {
      const next = pstr(arr[lastAssessIdx + 1].properties, "path");
      if (next) exitCount.set(next, (exitCount.get(next) ?? 0) + 1);
    }
  }
  const avgPagesPerSession = pagesPer.length
    ? Math.round((pagesPer.reduce((a, b) => a + b, 0) / pagesPer.length) * 10) / 10
    : null;

  // Dwell: sum ms per session, average across sessions.
  const dwellPerSession = new Map<string, number>();
  for (const d of dwellRows) {
    if (!inRange(jerusalemDate(d.created_at), from, to)) continue;
    const key = d.session_id ?? "—";
    const ms = pnum(d.properties, "ms") ?? 0;
    dwellPerSession.set(key, (dwellPerSession.get(key) ?? 0) + ms);
  }
  const dwellTotals = [...dwellPerSession.values()];
  const avgDwellMs = dwellTotals.length
    ? Math.round(dwellTotals.reduce((a, b) => a + b, 0) / dwellTotals.length)
    : null;

  const topReferrers = [...referrerCount.entries()]
    .map(([referrer, sessions]) => ({ referrer, sessions }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, TOP_N);
  const exitTargets = [...exitCount.entries()]
    .map(([path, count]) => ({ path, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, TOP_N);

  // ── 6. Assemble ───────────────────────────────────────────────────────────
  const totals: FunnelCounts = {
    introViews: totalSets.assessment_intro_viewed.size,
    started: totalSets.assessment_started.size,
    completed: totalSets.assessment_completed.size,
    registered: totalSets.assessment_registered.size,
    purchased,
    partnerInvited,
    partnerJoined,
    firstChapterViewed,
  };

  const buckets: FunnelBucket[] = [...bucketSets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([bucket, rec]) => ({
      bucket,
      introViews: rec.assessment_intro_viewed.size,
      started: rec.assessment_started.size,
      completed: rec.assessment_completed.size,
      registered: rec.assessment_registered.size,
    }));

  return {
    params: { ...params, tz: JERUSALEM_TZ },
    totals,
    completedFromDb,
    conversions: {
      startedRate: rate(totals.started, totals.introViews),
      completedRate: rate(totals.completed, totals.started),
      registeredRate: rate(totals.registered, totals.completed),
      purchasedRate: rate(totals.purchased, totals.registered),
      partnerJoinRate: rate(totals.partnerJoined, totals.partnerInvited),
    },
    buckets,
    dropoff,
    behavioral: { topReferrers, avgPagesPerSession, exitTargets, avgDwellMs },
    warnings,
  };
}
