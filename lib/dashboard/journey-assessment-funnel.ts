/**
 * Journey-assessment funnel data layer (journey-assessment-funnel-brief §B).
 *
 * Twin of lib/dashboard/assessment-funnel.ts, for the JOURNEY assessment
 * (/he/journey/assessment, the `journeys` / `journey_responses` tables). One
 * service-role function for a date range + day/week granularity. There is no
 * assessment selector — the journey assessment is a single product, so the
 * markers carry a constant assessment_id:"journey".
 *
 * Critical differences from the standalone (brief §4):
 *  1. Constant assessment_id "journey" for all four head markers.
 *  2. "Completed the SHORT assessment" — the journey_assessment_completed marker
 *     is the primary signal; the DB cross-check is journeys.status IN
 *     ('paywall','complete','completed') (NOT current_step >= total: the short
 *     phase writes status='paywall', the full/single phase writes 'complete').
 *  3. Explicit LONG (full) stages — fullStarted (answered ≥1 phase='full'
 *     question) and fullCompleted (journeys.status='complete') — surfaced as
 *     their own funnel stages.
 *  4. Drop-off is derived from journey_responses + journey_questions
 *     (position/phase), NOT current_step (which is phase-relative in journey),
 *     and split into dropoffShort / dropoffFull.
 *  5. dwell is filtered by pillar='journey' AND item_id='journey_assessment'
 *     so it never swallows content-chapter dwell.
 *
 * Purchase attribution: unlike the standalone, the journey checkout does NOT
 * emit a checkout_started analytics event (it only sends source in the checkout
 * body), so there is no event anchor. The cohort already scopes to people who
 * did the journey assessment, and the product IS journey, so purchased = cohort
 * ∩ active journey subscriptions. Documented + cohort-tight.
 *
 * All tables are RLS-locked to service_role — pass createServiceRoleClient from
 * an admin-gated context. Metadata only (privacy approach A).
 */

import type { SupabaseClient } from "@supabase/supabase-js";

const JERUSALEM_TZ = "Asia/Jerusalem";
const PAGE = 1000;
const CHUNK = 150;
const TOP_N = 10;
const ASSESSMENT_ID = "journey"; // constant — see §4.1

export type FunnelGranularity = "day" | "week";

export interface JourneyFunnelParams {
  /** Inclusive Jerusalem calendar date, YYYY-MM-DD. */
  from: string;
  /** Inclusive Jerusalem calendar date, YYYY-MM-DD. */
  to: string;
  granularity: FunnelGranularity;
}

export interface JourneyFunnelCounts {
  introViews: number;
  started: number;
  /** Reached the end of the SHORT assessment (journey_assessment_completed). */
  completedShort: number;
  registered: number;
  purchased: number;
  /** Answered ≥1 phase='full' question. */
  fullStarted: number;
  /** Finished the full questionnaire (journeys.status='complete'). */
  fullCompleted: number;
  partnerInvited: number;
  partnerJoined: number;
  firstChapterViewed: number;
}

export interface JourneyFunnelBucket {
  bucket: string;
  introViews: number;
  started: number;
  completedShort: number;
  registered: number;
}

export interface DropoffStep {
  /** 1-based rank of the drop-off question WITHIN its phase (short or full). */
  step: number;
  stuck: number;
}

export interface BehavioralSummary {
  topReferrers: { referrer: string; sessions: number }[];
  avgPagesPerSession: number | null;
  exitTargets: { path: string; count: number }[];
  avgDwellMs: number | null;
}

export interface JourneyAssessmentFunnel {
  params: JourneyFunnelParams & { tz: string };
  totals: JourneyFunnelCounts;
  /** Cross-check of completedShort vs journeys.status IN (paywall/complete). */
  completedShortFromDb: number;
  conversions: {
    startedRate: number | null; // started / intro
    completedShortRate: number | null; // completedShort / started
    registeredRate: number | null; // registered / completedShort
    purchasedRate: number | null; // purchased / registered
    fullStartedRate: number | null; // fullStarted / registered
    fullCompletedRate: number | null; // fullCompleted / fullStarted
    partnerJoinRate: number | null; // partnerJoined / partnerInvited
  };
  buckets: JourneyFunnelBucket[];
  /** Drop-off in the SHORT phase, keyed by journey_questions.position. */
  dropoffShort: DropoffStep[];
  /** Drop-off in the FULL phase, keyed by journey_questions.position. */
  dropoffFull: DropoffStep[];
  behavioral: BehavioralSummary;
  warnings: string[];
}

// ── Row shapes ───────────────────────────────────────────────────────────────
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
type JourneyRow = {
  id: string;
  user_id: string | null;
  status: string;
  started_at: string;
};
type ResponseRow = { journey_id: string; question_id: string };
type QuestionRow = { slug: string; position: number; phase: string };
type SubRow = { user_id: string };
type OwnerRow = { couple_id: string; user_id: string };
type PartnerRow = { couple_id: string };
type InviteEventRow = { user_id: string | null };
type ActivityRow = { user_id: string };

type PageResult<T> = { data: T[] | null; error: { message: string } | null };

// ── Helpers (identical to the standalone template) ───────────────────────────
const jdateFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: JERUSALEM_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function jerusalemDate(iso: string): string {
  return jdateFmt.format(new Date(iso));
}

function weekStartSunday(dateStr: string): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

function bucketOf(iso: string, g: FunnelGranularity): string {
  const day = jerusalemDate(iso);
  return g === "week" ? weekStartSunday(day) : day;
}

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
  return day >= from && day <= to;
}

function rate(num: number, den: number): number | null {
  return den > 0 ? Math.round((num / den) * 100) : null;
}

function distinctCount(values: (string | null)[]): number {
  const s = new Set<string>();
  for (const v of values) if (v) s.add(v);
  return s.size;
}

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
  "journey_assessment_intro_viewed",
  "journey_assessment_started",
  "journey_assessment_completed",
  "journey_assessment_registered",
] as const;
const E_INTRO = MARKER_EVENTS[0];
const E_STARTED = MARKER_EVENTS[1];
const E_COMPLETED = MARKER_EVENTS[2];
const E_REGISTERED = MARKER_EVENTS[3];

const COMPLETED_SHORT_STATUSES = new Set(["paywall", "complete", "completed"]);
const FULL_COMPLETE_STATUSES = new Set(["complete", "completed"]);

/**
 * Load the journey-assessment funnel. `admin` MUST be a service-role client.
 */
export async function loadJourneyAssessmentFunnel(
  admin: SupabaseClient,
  params: JourneyFunnelParams,
): Promise<JourneyAssessmentFunnel> {
  const { from, to, granularity } = params;
  const warnings: string[] = [];

  async function safeFetch<T>(label: string, run: () => Promise<T[]>): Promise<T[]> {
    try {
      return await run();
    } catch (e) {
      warnings.push(`${label}: ${e instanceof Error ? e.message : String(e)}`);
      return [];
    }
  }

  const loD = new Date(`${from}T00:00:00Z`);
  loD.setUTCDate(loD.getUTCDate() - 1);
  const hiD = new Date(`${to}T00:00:00Z`);
  hiD.setUTCDate(hiD.getUTCDate() + 2);
  const loIso = loD.toISOString();
  const hiIso = hiD.toISOString();

  // ── 1. Funnel-head markers (constant assessment_id="journey") ─────────────
  const markersRaw = await fetchAll<MarkerRow>((f, t) =>
    admin
      .from("analytics_events")
      .select("event, device_id, session_id, user_id, properties, created_at")
      .in("event", MARKER_EVENTS as unknown as string[])
      .eq("properties->>assessment_id", ASSESSMENT_ID)
      .gte("created_at", loIso)
      .lte("created_at", hiIso)
      .order("created_at", { ascending: true })
      .range(f, t)
      .returns<MarkerRow[]>(),
  );
  const markers = markersRaw.filter((m) =>
    inRange(jerusalemDate(m.created_at), from, to),
  );

  const totalSets: Record<string, Set<string>> = {
    [E_INTRO]: new Set(),
    [E_STARTED]: new Set(),
    [E_COMPLETED]: new Set(),
    [E_REGISTERED]: new Set(),
  };
  const bucketSets = new Map<string, Record<string, Set<string>>>();
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
          [E_INTRO]: new Set(),
          [E_STARTED]: new Set(),
          [E_COMPLETED]: new Set(),
          [E_REGISTERED]: new Set(),
        };
        bucketSets.set(b, rec);
      }
      rec[m.event]?.add(id);
    }
    if (m.session_id) engagedSessions.add(m.session_id);
    if (m.user_id) markerUserIds.add(m.user_id);
  }

  // ── 2. Journeys: short cross-check, cohort, full stages, drop-off ─────────
  const journeysRaw = await fetchAll<JourneyRow>((f, t) =>
    admin
      .from("journeys")
      .select("id, user_id, status, started_at")
      .gte("started_at", loIso)
      .lte("started_at", hiIso)
      .order("started_at", { ascending: true })
      .range(f, t)
      .returns<JourneyRow[]>(),
  );
  const journeys = journeysRaw.filter((j) =>
    inRange(jerusalemDate(j.started_at), from, to),
  );

  const registeredUserIds = new Set<string>(markerUserIds);
  let completedShortFromDb = 0;
  const incompleteJourneys: JourneyRow[] = [];
  const fullCompletedUserIds = new Set<string>();
  for (const j of journeys) {
    if (j.user_id) registeredUserIds.add(j.user_id);
    if (COMPLETED_SHORT_STATUSES.has(j.status)) completedShortFromDb += 1;
    if (FULL_COMPLETE_STATUSES.has(j.status)) {
      if (j.user_id) fullCompletedUserIds.add(j.user_id);
    } else {
      incompleteJourneys.push(j);
    }
  }

  // Question map: slug → { position, phase } (small table).
  const questionRows = await fetchAll<QuestionRow>((f, t) =>
    admin
      .from("journey_questions")
      .select("slug, position, phase")
      .range(f, t)
      .returns<QuestionRow[]>(),
  );
  const qmap = new Map<string, { position: number; phase: string }>();
  for (const q of questionRows) qmap.set(q.slug, { position: q.position, phase: q.phase });
  // `position` is a GLOBAL sort key that INTERLEAVES the phases (short and full
  // positions are not contiguous blocks), so drop-off must be derived per
  // phase: order each phase's questions by position independently. `step` is
  // the 1-based rank within the phase (short Q1..Qn / full Q1..Qm).
  const shortOrdered = questionRows
    .filter((q) => q.phase === "short")
    .sort((a, b) => a.position - b.position);
  const fullOrdered = questionRows
    .filter((q) => q.phase === "full")
    .sort((a, b) => a.position - b.position);

  // Responses for the in-range journeys (drives full-started + drop-off).
  const journeyIds = journeys.map((j) => j.id);
  const responses = journeyIds.length
    ? await fetchByIds<ResponseRow>(journeyIds, (chunk, f, t) =>
        admin
          .from("journey_responses")
          .select("journey_id, question_id")
          .in("journey_id", chunk)
          .range(f, t)
          .returns<ResponseRow[]>(),
      )
    : [];
  const answeredByJourney = new Map<string, ResponseRow[]>();
  for (const r of responses) {
    const arr = answeredByJourney.get(r.journey_id) ?? [];
    arr.push(r);
    answeredByJourney.set(r.journey_id, arr);
  }

  // fullStarted: cohort users whose journey answered ≥1 phase='full' question.
  const fullStartedUserIds = new Set<string>();
  for (const j of journeys) {
    if (!j.user_id) continue;
    const ans = answeredByJourney.get(j.id) ?? [];
    if (ans.some((r) => qmap.get(r.question_id)?.phase === "full")) {
      fullStartedUserIds.add(j.user_id);
    }
  }

  // Drop-off: place each incomplete journey in its current phase (any full
  // answer ⇒ full phase, else short), then the next unanswered question IN THAT
  // PHASE (by position) is the drop point. A journey that finished a phase has
  // no next-in-phase and is skipped (it's between phases, not mid-question).
  const shortStuck = new Map<number, number>();
  const fullStuck = new Map<number, number>();
  for (const j of incompleteJourneys) {
    const ans = answeredByJourney.get(j.id) ?? [];
    const answeredFull = ans
      .map((r) => qmap.get(r.question_id))
      .filter((q): q is { position: number; phase: string } => q?.phase === "full");
    if (answeredFull.length > 0) {
      const maxPos = Math.max(...answeredFull.map((q) => q.position));
      const idx = fullOrdered.findIndex((q) => q.position > maxPos);
      if (idx >= 0) fullStuck.set(idx + 1, (fullStuck.get(idx + 1) ?? 0) + 1);
    } else {
      const answeredShort = ans
        .map((r) => qmap.get(r.question_id))
        .filter((q): q is { position: number; phase: string } => q?.phase === "short");
      const maxPos = answeredShort.length
        ? Math.max(...answeredShort.map((q) => q.position))
        : -1;
      const idx = shortOrdered.findIndex((q) => q.position > maxPos);
      if (idx >= 0) shortStuck.set(idx + 1, (shortStuck.get(idx + 1) ?? 0) + 1);
    }
  }
  const toDropoff = (m: Map<number, number>): DropoffStep[] =>
    [...m.entries()].map(([step, stuck]) => ({ step, stuck })).sort((a, b) => a.step - b.step);
  const dropoffShort = toDropoff(shortStuck);
  const dropoffFull = toDropoff(fullStuck);

  // ── 3. Purchase attribution (no journey checkout event → cohort ∩ subs) ───
  const cohort = [...registeredUserIds];
  const subs = cohort.length
    ? await safeFetch("subscriptions", () =>
        fetchByIds<SubRow>(cohort, (chunk, f, t) =>
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
  const purchased = distinctCount(subs.map((s) => s.user_id));

  // ── 4. Partner (invited + joined) + first chapter (cohort conversions) ────
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

  // ── 5. Behavioural layer (dwell filtered to the journey assessment) ───────
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
        .eq("properties->>pillar", "journey")
        .eq("properties->>item_id", "journey_assessment")
        .gte("created_at", loIso)
        .lte("created_at", hiIso)
        .range(f, t)
        .returns<EventRow[]>(),
    ),
  ]);

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
  const assessPath = "/journey/assessment";
  for (const arr of bySession.values()) {
    arr.sort((a, b) => a.created_at.localeCompare(b.created_at));
    pagesPer.push(arr.length);
    const ref = pstr(arr[0]?.properties ?? null, "referrer");
    if (ref) referrerCount.set(ref, (referrerCount.get(ref) ?? 0) + 1);
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
  const totals: JourneyFunnelCounts = {
    introViews: totalSets[E_INTRO].size,
    started: totalSets[E_STARTED].size,
    completedShort: totalSets[E_COMPLETED].size,
    registered: totalSets[E_REGISTERED].size,
    purchased,
    fullStarted: fullStartedUserIds.size,
    fullCompleted: fullCompletedUserIds.size,
    partnerInvited,
    partnerJoined,
    firstChapterViewed,
  };

  const buckets: JourneyFunnelBucket[] = [...bucketSets.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([bucket, rec]) => ({
      bucket,
      introViews: rec[E_INTRO].size,
      started: rec[E_STARTED].size,
      completedShort: rec[E_COMPLETED].size,
      registered: rec[E_REGISTERED].size,
    }));

  return {
    params: { ...params, tz: JERUSALEM_TZ },
    totals,
    completedShortFromDb,
    conversions: {
      startedRate: rate(totals.started, totals.introViews),
      completedShortRate: rate(totals.completedShort, totals.started),
      registeredRate: rate(totals.registered, totals.completedShort),
      purchasedRate: rate(totals.purchased, totals.registered),
      fullStartedRate: rate(totals.fullStarted, totals.registered),
      fullCompletedRate: rate(totals.fullCompleted, totals.fullStarted),
      partnerJoinRate: rate(totals.partnerJoined, totals.partnerInvited),
    },
    buckets,
    dropoffShort,
    dropoffFull,
    behavioral: { topReferrers, avgPagesPerSession, exitTargets, avgDwellMs },
    warnings,
  };
}
