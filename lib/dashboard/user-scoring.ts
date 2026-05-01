import "server-only";

/**
 * lib/dashboard/user-scoring.ts
 *
 * Phase 5 — deterministic per-user scoring + edge-case detection.
 *
 * What this is (and isn't):
 *   - This is an OPERATIONAL signal layer for the clinician CRM —
 *     "here's how this user is engaging with the program in the
 *     last 30 days". It tells the clinician where to look first.
 *   - It is NOT a clinical assessment. It does not diagnose anything,
 *     does not predict outcomes, and does not change content for the
 *     user. All outputs feed the dashboard recommendations layer; the
 *     clinician decides what to act on.
 *   - There is NO LLM, no embedding, no opaque ML. Everything is
 *     transparent rules computed in this file. Anyone can read the
 *     code and explain why a user got a flag.
 *
 * How a user gets scored:
 *   - We pull responses, scheduled items, completions from the last
 *     30 days. Counts roll into the row, ratios get normalised to
 *     0..1, flags get derived from thresholds.
 *
 * Output gets persisted into journey_user_scores (migration 053).
 * Truncating that table is always safe — running this again
 * reconstructs it from operational data.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";

export interface JourneyUserScore {
  userId: string;
  coupleId: string | null;

  /** 0..1, null when no items yet. Mix of completion rate and response substance. */
  engagementDepth: number | null;
  /** 0..1, null when no responses. 1 = same-day, 0 = 14+ days. */
  responseVelocity: number | null;
  /** 0..1, null when no responses. Crisis signals + concerning statuses. */
  conflictSignal: number | null;
  /** 0..1, null when window too short. active_days / 30. */
  consistency: number | null;

  // Raw aggregates (kept for the rationale strings)
  totalItems: number;
  totalCompletedItems: number;
  totalResponses: number;
  totalRepliesReceived: number;
  avgResponseChars: number;
  avgDaysToRespond: number;
  activeDaysLast30: number;
  crisisKeywordCount: number;
  concerningStatusCount: number;

  /** Open-ended flag set. See computeFlags below. */
  flags: UserFlag[];

  computedAt: string; // ISO
}

export type UserFlag =
  | "stuck"           // ≥1 available item with no response, >7 days unlocked
  | "disengaging"     // engagement_depth dropped >30% vs prior 14 days
  | "overreactive"    // long responses + conflict signals
  | "non_responsive"  // ≥3 items, zero responses
  | "crisis"          // crisis_keyword_count ≥ 2 OR conflict_signal ≥ 0.7
  | "highly_engaged"; // engagement_depth ≥ 0.8 + responses ≥ 5 — positive signal too

const WINDOW_DAYS = 30;
const STUCK_DAYS = 7;
const VELOCITY_CEIL_DAYS = 14; // beyond this, response velocity = 0
const CHAR_NORM_CAP = 200; // beyond ~200 avg chars considered "deep"

/**
 * Compute and persist scores for a single user.
 * Returns the computed score row (or null if input is unusable).
 */
export async function recomputeUserScore(args: {
  userId: string;
  coupleId?: string | null;
  now?: Date;
}): Promise<JourneyUserScore | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const reference = (args.now ?? new Date()).getTime();
  const sinceMs = reference - WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const sinceIso = new Date(sinceMs).toISOString();

  // ── 1. Resolve assignments + scheduled items relevant to the user ──
  // A user reaches scheduled items either via couple membership OR via
  // a solo (user_id) assignment. Pull both and union.
  let assignmentIds: string[] = [];
  let coupleId = args.coupleId ?? null;

  // Solo assignments
  {
    const { data } = await admin
      .from("journey_assignments")
      .select("id, user_id, couple_id")
      .eq("user_id", args.userId);
    for (const a of (data ?? []) as Array<{ id: string; couple_id: string | null }>) {
      assignmentIds.push(a.id);
      if (!coupleId && a.couple_id) coupleId = a.couple_id;
    }
  }
  // Couple assignments — resolve coupleId via couple_members if not provided
  if (!coupleId) {
    const { data } = await admin
      .from("couple_members")
      .select("couple_id")
      .eq("user_id", args.userId)
      .maybeSingle();
    coupleId = data?.couple_id ?? null;
  }
  if (coupleId) {
    const { data } = await admin
      .from("journey_assignments")
      .select("id")
      .eq("couple_id", coupleId);
    for (const a of (data ?? []) as Array<{ id: string }>) {
      assignmentIds.push(a.id);
    }
  }
  assignmentIds = Array.from(new Set(assignmentIds));

  // ── 2. Scheduled items + completions in window ─────────────────────
  type SchedRow = { id: string; unlock_at: string; created_at: string };
  let schedRows: SchedRow[] = [];
  if (assignmentIds.length > 0) {
    const { data } = await admin
      .from("journey_scheduled_items")
      .select("id, unlock_at, created_at")
      .in("assignment_id", assignmentIds);
    schedRows = (data ?? []) as SchedRow[];
  }
  const schedIds = schedRows.map((s) => s.id);

  const completionMap = new Map<string, string>(); // sched_id → completed_at
  if (schedIds.length > 0) {
    const { data } = await admin
      .from("journey_item_completions")
      .select("scheduled_item_id, completed_at")
      .in("scheduled_item_id", schedIds);
    for (const d of (data ?? []) as Array<{
      scheduled_item_id: string;
      completed_at: string;
    }>) {
      completionMap.set(d.scheduled_item_id, d.completed_at);
    }
  }

  const totalItems = schedRows.length;
  const totalCompletedItems = Array.from(completionMap.keys()).filter((id) =>
    schedIds.includes(id),
  ).length;

  // ── 3. Responses authored by this user ─────────────────────────────
  type RespRow = {
    id: string;
    scheduled_item_id: string;
    response_text: string | null;
    is_private: boolean;
    clinician_status: "open" | "resolved" | "concerning" | null;
    clinician_reply_text: string | null;
    tags: string[] | null;
    created_at: string;
  };
  let respRows: RespRow[] = [];
  if (schedIds.length > 0) {
    const { data } = await admin
      .from("journey_item_responses")
      .select(
        "id, scheduled_item_id, response_text, is_private, clinician_status, clinician_reply_text, tags, created_at",
      )
      .in("scheduled_item_id", schedIds)
      .eq("user_id", args.userId)
      .gte("created_at", sinceIso);
    respRows = (data ?? []) as RespRow[];
  }

  const totalResponses = respRows.length;
  const totalRepliesReceived = respRows.filter(
    (r) => !!r.clinician_reply_text,
  ).length;
  const crisisKeywordCount = respRows.filter((r) =>
    (r.tags ?? []).includes("crisis_keyword"),
  ).length;
  const concerningStatusCount = respRows.filter(
    (r) => r.clinician_status === "concerning",
  ).length;

  // Char + days-to-respond averages
  let charSum = 0;
  let charCount = 0;
  let dayDiffSum = 0;
  let dayDiffCount = 0;
  const schedById = new Map<string, SchedRow>();
  for (const s of schedRows) schedById.set(s.id, s);
  for (const r of respRows) {
    const text = (r.response_text ?? "").trim();
    if (text.length > 0) {
      charSum += text.length;
      charCount += 1;
    }
    const sched = schedById.get(r.scheduled_item_id);
    if (sched?.unlock_at) {
      const unlock = Date.parse(sched.unlock_at);
      const responded = Date.parse(r.created_at);
      if (Number.isFinite(unlock) && Number.isFinite(responded) && responded >= unlock) {
        dayDiffSum += (responded - unlock) / (24 * 60 * 60 * 1000);
        dayDiffCount += 1;
      }
    }
  }
  const avgResponseChars = charCount > 0 ? Math.round(charSum / charCount) : 0;
  const avgDaysToRespond =
    dayDiffCount > 0 ? Math.round((dayDiffSum / dayDiffCount) * 100) / 100 : 0;

  // Active days in window — distinct dates with any response
  const activeDaysSet = new Set<string>();
  for (const r of respRows) {
    activeDaysSet.add(r.created_at.slice(0, 10));
  }
  const activeDaysLast30 = activeDaysSet.size;

  // ── 4. Compute normalised scores ───────────────────────────────────
  // engagement_depth: half completion rate, half response substance.
  // Substance = avg chars normalised (capped at CHAR_NORM_CAP).
  // Either ratio is null if there's no underlying data.
  const completionRate =
    totalItems > 0 ? totalCompletedItems / totalItems : null;
  const charsNormalised =
    charCount > 0 ? Math.min(avgResponseChars / CHAR_NORM_CAP, 1) : null;
  let engagementDepth: number | null = null;
  if (completionRate !== null && charsNormalised !== null) {
    engagementDepth = round3((completionRate + charsNormalised) / 2);
  } else if (completionRate !== null) {
    engagementDepth = round3(completionRate);
  } else if (charsNormalised !== null) {
    engagementDepth = round3(charsNormalised);
  }

  // response_velocity: 0 at 14 days, 1 at 0 days. Linear.
  const responseVelocity =
    dayDiffCount > 0
      ? round3(clamp(1 - avgDaysToRespond / VELOCITY_CEIL_DAYS, 0, 1))
      : null;

  // conflict_signal: weighted sum of crisis_keyword + concerning, normalised
  // by total responses. crisis_keyword counts double.
  const conflictRaw =
    totalResponses > 0
      ? (crisisKeywordCount * 2 + concerningStatusCount) / totalResponses
      : null;
  const conflictSignal = conflictRaw === null ? null : round3(clamp(conflictRaw, 0, 1));

  // consistency: active days / 30. Only meaningful once user has been
  // active for >= 7 days (otherwise denominator dominates).
  const earliestRespMs =
    respRows.length > 0
      ? Math.min(...respRows.map((r) => Date.parse(r.created_at)))
      : null;
  const observedDays =
    earliestRespMs !== null
      ? Math.max(1, Math.round((reference - earliestRespMs) / (24 * 60 * 60 * 1000)))
      : 0;
  const consistency =
    observedDays >= 7
      ? round3(clamp(activeDaysLast30 / Math.min(observedDays, WINDOW_DAYS), 0, 1))
      : null;

  // ── 5. Edge-case flags ─────────────────────────────────────────────
  const flags = computeFlags({
    reference,
    schedRows,
    completionMap,
    respRows,
    engagementDepth,
    conflictSignal,
    avgResponseChars,
    crisisKeywordCount,
    totalResponses,
  });

  // ── 6. Build score row + persist ───────────────────────────────────
  const computedAt = new Date(reference).toISOString();
  const score: JourneyUserScore = {
    userId: args.userId,
    coupleId,
    engagementDepth,
    responseVelocity,
    conflictSignal,
    consistency,
    totalItems,
    totalCompletedItems,
    totalResponses,
    totalRepliesReceived,
    avgResponseChars,
    avgDaysToRespond,
    activeDaysLast30,
    crisisKeywordCount,
    concerningStatusCount,
    flags,
    computedAt,
  };

  await admin.from("journey_user_scores").upsert(
    {
      user_id: score.userId,
      couple_id: score.coupleId,
      engagement_depth: score.engagementDepth,
      response_velocity: score.responseVelocity,
      conflict_signal: score.conflictSignal,
      consistency: score.consistency,
      total_items: score.totalItems,
      total_completed_items: score.totalCompletedItems,
      total_responses: score.totalResponses,
      total_replies_received: score.totalRepliesReceived,
      avg_response_chars: score.avgResponseChars,
      avg_days_to_respond: score.avgDaysToRespond,
      active_days_last_30: score.activeDaysLast30,
      crisis_keyword_count: score.crisisKeywordCount,
      concerning_status_count: score.concerningStatusCount,
      flags: score.flags,
      computed_at: score.computedAt,
    },
    { onConflict: "user_id" },
  );

  return score;
}

/**
 * Recompute scores for all users with at least one response or
 * scheduled item in the past 30 days. Returns stats.
 */
export async function recomputeAllUserScores(args?: {
  now?: Date;
}): Promise<{
  totalProcessed: number;
  totalFailed: number;
  durationMs: number;
}> {
  const admin = createServiceRoleClient();
  if (!admin) {
    return { totalProcessed: 0, totalFailed: 0, durationMs: 0 };
  }
  const startedAt = Date.now();
  const sinceIso = new Date(
    Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();

  // Build a candidate user_id set: anyone with a response, or anyone
  // who is part of a couple with active assignments.
  const userIds = new Set<string>();

  // Recently-active responders
  {
    const { data } = await admin
      .from("journey_item_responses")
      .select("user_id")
      .gte("created_at", sinceIso)
      .limit(10000);
    for (const r of (data ?? []) as Array<{ user_id: string }>) {
      if (r.user_id) userIds.add(r.user_id);
    }
  }
  // Members of couples with active journey assignments
  {
    const { data: assigns } = await admin
      .from("journey_assignments")
      .select("couple_id, user_id")
      .eq("is_active", true)
      .limit(10000);
    const coupleIds = Array.from(
      new Set(
        ((assigns ?? []) as Array<{ couple_id: string | null }>)
          .map((a) => a.couple_id)
          .filter((x): x is string => !!x),
      ),
    );
    for (const a of (assigns ?? []) as Array<{ user_id: string | null }>) {
      if (a.user_id) userIds.add(a.user_id);
    }
    if (coupleIds.length > 0) {
      const { data: members } = await admin
        .from("couple_members")
        .select("user_id")
        .in("couple_id", coupleIds);
      for (const m of (members ?? []) as Array<{ user_id: string }>) {
        if (m.user_id) userIds.add(m.user_id);
      }
    }
  }

  let processed = 0;
  let failed = 0;
  for (const uid of userIds) {
    try {
      const result = await recomputeUserScore({ userId: uid, now: args?.now });
      if (result) processed += 1;
      else failed += 1;
    } catch (err) {
      console.error("[recomputeAllUserScores] user failed", { uid, err });
      failed += 1;
    }
  }
  return {
    totalProcessed: processed,
    totalFailed: failed,
    durationMs: Date.now() - startedAt,
  };
}

// ─── Internals ──────────────────────────────────────────────────────

function computeFlags(input: {
  reference: number;
  schedRows: Array<{ id: string; unlock_at: string }>;
  completionMap: Map<string, string>;
  respRows: Array<{
    scheduled_item_id: string;
    response_text: string | null;
    tags: string[] | null;
    created_at: string;
  }>;
  engagementDepth: number | null;
  conflictSignal: number | null;
  avgResponseChars: number;
  crisisKeywordCount: number;
  totalResponses: number;
}): UserFlag[] {
  const out = new Set<UserFlag>();
  const STUCK_MS = STUCK_DAYS * 24 * 60 * 60 * 1000;

  // stuck — at least one available item past STUCK_DAYS without response
  const respondedItems = new Set(input.respRows.map((r) => r.scheduled_item_id));
  for (const s of input.schedRows) {
    const unlockMs = Date.parse(s.unlock_at);
    if (!Number.isFinite(unlockMs) || unlockMs > input.reference) continue;
    if (input.completionMap.has(s.id)) continue;
    if (respondedItems.has(s.id)) continue;
    if (input.reference - unlockMs > STUCK_MS) {
      out.add("stuck");
      break;
    }
  }

  // non_responsive — ≥3 items, 0 responses
  if (input.schedRows.length >= 3 && input.respRows.length === 0) {
    out.add("non_responsive");
  }

  // crisis — explicit signal
  if (
    input.crisisKeywordCount >= 2 ||
    (input.conflictSignal !== null && input.conflictSignal >= 0.7)
  ) {
    out.add("crisis");
  }

  // overreactive — heavy + conflict signal at the same time
  if (
    input.avgResponseChars > 400 &&
    input.conflictSignal !== null &&
    input.conflictSignal >= 0.4
  ) {
    out.add("overreactive");
  }

  // disengaging — engagement_depth dropped >30% in last 14 days vs the
  // prior 14. Compute a quick on-the-fly comparison from the existing
  // respRows: split by midpoint of the window.
  // We approximate engagement_depth as char-substance only (cheap +
  // already computed).
  const midMs = input.reference - 14 * 24 * 60 * 60 * 1000;
  let recentChars = 0,
    recentCount = 0;
  let priorChars = 0,
    priorCount = 0;
  for (const r of input.respRows) {
    const ts = Date.parse(r.created_at);
    const len = (r.response_text ?? "").trim().length;
    if (ts >= midMs) {
      recentChars += len;
      recentCount += 1;
    } else {
      priorChars += len;
      priorCount += 1;
    }
  }
  if (priorCount >= 2 && recentCount >= 1) {
    const recentAvg = recentChars / recentCount;
    const priorAvg = priorChars / priorCount;
    if (priorAvg > 0 && recentAvg / priorAvg < 0.7) {
      out.add("disengaging");
    }
  }

  // highly_engaged — positive flag (so the clinician can also see who's
  // doing well, not just who's struggling)
  if (
    input.engagementDepth !== null &&
    input.engagementDepth >= 0.8 &&
    input.totalResponses >= 5 &&
    !out.has("crisis") &&
    !out.has("disengaging")
  ) {
    out.add("highly_engaged");
  }

  return Array.from(out);
}

function clamp(n: number, lo: number, hi: number): number {
  return n < lo ? lo : n > hi ? hi : n;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}
