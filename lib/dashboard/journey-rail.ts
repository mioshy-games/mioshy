/**
 * lib/dashboard/journey-rail.ts
 *
 * Pure builders that turn the user's journey state into the entries
 * shown in the JourneyProgressRail component on /my.
 *
 * Two modes:
 *   - "static"  → the six baseline topics (אבחון → ... → משפחה),
 *                 used when the user has no assigned content yet.
 *   - "dynamic" → derived from the user's actual timeline
 *                 (journey_categories aggregated from
 *                 journey_scheduled_items + journey_item_completions).
 *
 * The rule is simple:
 *   if (timeline has any entries) → dynamic
 *   else                          → static
 *
 * The page calls the right builder; the rail component just renders.
 *
 * Tone note (per spec §1.5): NEVER include specific calendar dates
 * in the rail labels. Locked entries say "ייפתח בקרוב" (within 7
 * days) or "ייפתח בהמשך" (further out / no date). Specifics live
 * inside the item view, not on the dashboard.
 */

import type { TimelineEntry } from "@/lib/journey-content/types";
import type { AssessmentStage } from "@/lib/dashboard/pillar-state";
import { createServiceRoleClient } from "@/lib/supabase-admin";

export type RailStepStatus = "completed" | "current" | "pending";
export type PillItemStatus = "available" | "completed" | "locked" | "assessment";

/** A piece of content surfaced inside a rail entry's content panel.
 *  Either a real scheduled journey item (kind=content/assessment) or
 *  a synthetic entry for the assessment pill that just routes to
 *  /journey/assessment. */
export interface PillItemRef {
  /** Stable id — scheduled_item.id for real items, sentinel for assessment. */
  id: string;
  /** journey_items.id, or null for the synthetic assessment entry. */
  itemId: string | null;
  title: string;
  /** Body markdown/plaintext, may be null. */
  body: string | null;
  imageUrl: string | null;
  videoUrl: string | null;
  status: PillItemStatus;
  /** Where to send the user when they want the full item view. */
  href: string;
  completedAt: string | null;
  unlockAt: string | null;
  // ── Phase 5: conversation thread ──────────────────────────────────
  /** The viewer's most recent response text on this item, if any. */
  userResponseText: string | null;
  /** Whether that response was marked private (user-only + clinician). */
  userResponsePrivate: boolean | null;
  userResponseAt: string | null;
  /** Clinician's reply on that response, if any. */
  clinicianReplyText: string | null;
  clinicianRepliedAt: string | null;
  /** Clinician triage status: "concerning" lights a slightly more
   *  urgent pill in the UI; the user never sees the literal label. */
  clinicianStatus: "open" | "resolved" | "concerning" | null;
  /** True when there's a clinician reply that arrived AFTER the
   *  user's last visit. Computed against `journey_item_seen` (or
   *  whatever heuristic the page chooses) — the rail uses this to
   *  show a small notification dot on the pill. */
  hasUnreadReply: boolean;
}

export interface RailEntry {
  /** Stable identity. Static entries use slugs; dynamic ones use category UUIDs. */
  key: string;
  /** Localized label shown to the user. */
  label: string;
  status: RailStepStatus;
  /** Tiny line above the label ("הושלם" / "השלב הנוכחי" / "ייפתח בקרוב" / ...). */
  hint: string;
  /** Phase 2 step B — when present, the pill becomes a Link.
   *  Dynamic entries: deep-link to the most relevant scheduled item
   *  in the category (current available, or the most recent completed).
   *  Static entries: special routes ("/journey/assessment" for אבחון). */
  href?: string | null;
  /** Phase 5 — items belonging to this pill, surfaced in the
   *  JourneyDesk content panel when the pill is selected. May be
   *  empty (e.g. DB-backed empty rail before the clinician schedules
   *  any content) — the panel renders a "preparing" state in that case. */
  items?: PillItemRef[];
}

// ─────────────────────────────────────────────────────────────────────
// Static fallback — six baseline topics, in narrative order
// ─────────────────────────────────────────────────────────────────────

const STATIC_STEPS: Array<{ key: string; label_he: string; label_en: string }> = [
  { key: "assessment",    label_he: "אבחון",            label_en: "Assessment" },
  { key: "insights",      label_he: "תובנות",           label_en: "Insights" },
  { key: "communication", label_he: "תקשורת זוגית",     label_en: "Communication" },
  { key: "intimacy",      label_he: "מיניות ואינטימיות", label_en: "Intimacy" },
  { key: "love",          label_he: "אהבה וחיבור",      label_en: "Love & connection" },
  { key: "family",        label_he: "משפחה ולחצים",     label_en: "Family & stress" },
];

export function buildStaticRail(args: {
  isHe: boolean;
  assessmentStage: AssessmentStage;
  hasActiveAssignments: boolean;
}): RailEntry[] {
  const { isHe, assessmentStage, hasActiveAssignments } = args;

  // Defaults: every step pending
  const statuses: RailStepStatus[] = STATIC_STEPS.map(() => "pending");

  if (assessmentStage === "completed") {
    statuses[0] = "completed";
    // Once assessment is done, "תובנות" is the bridge step the
    // clinician is working on. If they've already attached a program,
    // treat that bridge as done and light the next one.
    statuses[1] = hasActiveAssignments ? "completed" : "current";
    if (hasActiveAssignments) statuses[2] = "current";
  } else {
    // not_started / in_progress → user is on step "אבחון"
    statuses[0] = "current";
  }

  return STATIC_STEPS.map((step, idx) => {
    const isAssessment = step.key === "assessment";
    const items: PillItemRef[] = isAssessment
      ? [makeAssessmentItem(isHe, statuses[idx])]
      : [];
    return {
      key: `static:${step.key}`,
      label: isHe ? step.label_he : step.label_en,
      status: statuses[idx],
      hint: hintFor(statuses[idx], isHe, /* unlockSoon */ false),
      // Step B: only the "אבחון" pill is meaningfully clickable in the
      // static fallback — it routes to the assessment. The other static
      // steps don't have content yet, so they stay informational.
      href:
        isAssessment && statuses[idx] !== "pending"
          ? "/journey/assessment"
          : null,
      items,
    };
  });
}

// Synthetic item used by the assessment pill — not a real
// scheduled_item, but the desk panel needs *something* to render.
function makeAssessmentItem(isHe: boolean, status: RailStepStatus): PillItemRef {
  return {
    id: "assessment-link",
    itemId: null,
    title: isHe ? "האבחון האישי שלכם" : "Your personal assessment",
    body: isHe
      ? status === "completed"
        ? "סיימתם את האבחון. תוכלו לחזור אליו בכל עת לרענון התשובות."
        : "השאלון הראשוני שמכוון את עבודת המומחה איתכם. עונים לפי הקצב שלכם — אפשר לחזור אליו בהמשך."
      : status === "completed"
        ? "You completed the assessment. Re-open it any time to refresh your answers."
        : "The initial questionnaire that guides your clinician's work with you. Take it at your own pace.",
    imageUrl: null,
    videoUrl: null,
    status: "assessment",
    href: "/journey/assessment",
    completedAt: null,
    unlockAt: null,
    userResponseText: null,
    userResponsePrivate: null,
    userResponseAt: null,
    clinicianReplyText: null,
    clinicianRepliedAt: null,
    clinicianStatus: null,
    hasUnreadReply: false,
  };
}

// ─────────────────────────────────────────────────────────────────────
// Dynamic — aggregate the user's real timeline into category-level entries
// ─────────────────────────────────────────────────────────────────────

export function buildDynamicRail(args: {
  isHe: boolean;
  timeline: TimelineEntry[];
  /** Whether the user has finished the questionnaire. Used to render
   *  the implicit first "אבחון" pill at the head of the rail. */
  assessmentCompleted: boolean;
  /** The viewing user's id, used to pick THEIR response from each item's
   *  responses array (each scheduled item can have responses from both
   *  partners in a couple). */
  viewerUserId: string;
  /** Per-item "last seen" timestamps from journey_item_seen (or any other
   *  source). When a clinician_replied_at is newer than the seen time
   *  for that item, the rail shows an "unread reply" dot. Pass an empty
   *  Map if the page hasn't loaded seen-state — items will then default
   *  to "unread" only if there's a reply at all. */
  itemSeenAt?: Map<string, string>;
  now?: Date;
}): RailEntry[] {
  const {
    isHe,
    timeline,
    assessmentCompleted,
    viewerUserId,
    itemSeenAt,
    now,
  } = args;
  const reference = (now ?? new Date()).getTime();
  const SOON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

  // Group timeline entries by category id, preserving the earliest
  // unlock_at per category for sorting.
  type Bucket = {
    categoryId: string;
    label: string;
    items: TimelineEntry[];
    earliestUnlockMs: number;
  };
  const buckets = new Map<string, Bucket>();

  for (const entry of timeline) {
    const categoryId = entry.category.id;
    const label =
      (isHe
        ? entry.category.name_he
        : entry.category.name_en || entry.category.name_he) ?? "";
    const unlockMs = Date.parse(entry.scheduled.unlock_at);
    const existing = buckets.get(categoryId);
    if (existing) {
      existing.items.push(entry);
      if (Number.isFinite(unlockMs) && unlockMs < existing.earliestUnlockMs) {
        existing.earliestUnlockMs = unlockMs;
      }
    } else {
      buckets.set(categoryId, {
        categoryId,
        label,
        items: [entry],
        earliestUnlockMs: Number.isFinite(unlockMs) ? unlockMs : Number.MAX_SAFE_INTEGER,
      });
    }
  }

  const orderedBuckets = Array.from(buckets.values()).sort(
    (a, b) => a.earliestUnlockMs - b.earliestUnlockMs,
  );

  // Per-bucket status:
  //   completed → every item in this category is completed
  //   current   → at least one item is currently 'available'
  //   pending   → all items locked (none available, none completed yet)
  // If a category mixes completed + locked, treat as "current" — it's
  // mid-flight from the user's perspective.
  const dynamicEntries: RailEntry[] = orderedBuckets.map((bucket) => {
    const allCompleted = bucket.items.every((e) => e.status === "completed");
    const anyAvailable = bucket.items.some((e) => e.status === "available");
    const anyCompleted = bucket.items.some((e) => e.status === "completed");
    const minUnlockMs = bucket.earliestUnlockMs;
    const unlockSoon =
      Number.isFinite(minUnlockMs) &&
      minUnlockMs > reference &&
      minUnlockMs - reference <= SOON_WINDOW_MS;

    let status: RailStepStatus;
    if (allCompleted) status = "completed";
    else if (anyAvailable || anyCompleted) status = "current";
    else status = "pending";

    // Step B: pick a deep-link target inside the category.
    //   - Prefer an item the user can act on RIGHT NOW (available).
    //   - Else, the most recent completion (so they can re-read).
    //   - Else (all locked): no link.
    let target: typeof bucket.items[number] | null = null;
    if (anyAvailable) {
      target = bucket.items.find((e) => e.status === "available") ?? null;
    }
    if (!target && anyCompleted) {
      // Sort completed by completed_at desc, latest first
      const completed = bucket.items.filter((e) => e.status === "completed");
      completed.sort((a, b) => {
        const ta = Date.parse(a.completion?.completed_at ?? a.scheduled.unlock_at);
        const tb = Date.parse(b.completion?.completed_at ?? b.scheduled.unlock_at);
        return tb - ta;
      });
      target = completed[0] ?? null;
    }
    const href = target
      ? `/journey/timeline/${target.scheduled.id}`
      : null;

    // Build PillItemRef[] for the desk panel: every TimelineEntry in
    // this bucket becomes a pill item. Sort: available first (most
    // actionable), then completed (most recent first), then locked
    // (earliest unlock first).
    const sortedItems = [...bucket.items].sort((a, b) => {
      const rank = (s: typeof a.status) =>
        s === "available" ? 0 : s === "completed" ? 1 : 2;
      const dr = rank(a.status) - rank(b.status);
      if (dr !== 0) return dr;
      if (a.status === "completed" && b.status === "completed") {
        const ta = Date.parse(
          a.completion?.completed_at ?? a.scheduled.unlock_at,
        );
        const tb = Date.parse(
          b.completion?.completed_at ?? b.scheduled.unlock_at,
        );
        return tb - ta;
      }
      const ua = Date.parse(a.scheduled.unlock_at);
      const ub = Date.parse(b.scheduled.unlock_at);
      return ua - ub;
    });
    const items: PillItemRef[] = sortedItems.map((entry) => {
      // Pick the viewer's most recent response on this item. There can
      // be multiple responses per item (revisions, partner responses
      // when private=false). We take the latest by created_at that
      // belongs to the viewer.
      const myResponses = entry.responses
        .filter((r) => r.user_id === viewerUserId)
        .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
      const myLatest = myResponses[0] ?? null;

      // Find the latest clinician reply on any of this item's
      // responses (including the partner's, if shared) — the user
      // benefits from seeing the clinician's voice on the thread even
      // when it was technically attached to the partner's response.
      // Sort by clinician_replied_at desc.
      const repliedResponses = entry.responses
        .filter((r) => !!r.clinician_reply_text && !!r.clinician_replied_at)
        .sort(
          (a, b) =>
            Date.parse(b.clinician_replied_at as string) -
            Date.parse(a.clinician_replied_at as string),
        );
      const latestReply = repliedResponses[0] ?? null;

      const seenIso = itemSeenAt?.get(entry.scheduled.id) ?? null;
      const seenMs = seenIso ? Date.parse(seenIso) : 0;
      const repliedMs = latestReply?.clinician_replied_at
        ? Date.parse(latestReply.clinician_replied_at)
        : 0;
      const hasUnreadReply = !!latestReply && repliedMs > seenMs;

      return {
        id: entry.scheduled.id,
        itemId: entry.item.id,
        title:
          (isHe
            ? entry.item.title_he
            : entry.item.title_en || entry.item.title_he) ?? "",
        body:
          (isHe
            ? entry.item.body_he
            : entry.item.body_en || entry.item.body_he) ?? null,
        imageUrl: entry.item.image_url ?? null,
        videoUrl: entry.item.video_url ?? null,
        status: entry.status,
        href: `/journey/timeline/${entry.scheduled.id}`,
        completedAt: entry.completion?.completed_at ?? null,
        unlockAt: entry.scheduled.unlock_at,
        userResponseText: myLatest?.response_text ?? null,
        userResponsePrivate: myLatest?.is_private ?? null,
        userResponseAt: myLatest?.created_at ?? null,
        clinicianReplyText: latestReply?.clinician_reply_text ?? null,
        clinicianRepliedAt: latestReply?.clinician_replied_at ?? null,
        clinicianStatus: latestReply?.clinician_status ?? null,
        hasUnreadReply,
      };
    });

    return {
      key: `dyn:${bucket.categoryId}`,
      label: bucket.label,
      status,
      hint: hintFor(status, isHe, unlockSoon),
      href,
      items,
    };
  });

  // Prepend the implicit "אבחון" pill so the rail always starts with
  // the questionnaire step — keeps the narrative consistent across
  // both static and dynamic modes.
  const assessmentStatus: RailStepStatus = assessmentCompleted
    ? "completed"
    : "current";
  const assessmentEntry: RailEntry = {
    key: "static:assessment",
    label: isHe ? "אבחון" : "Assessment",
    status: assessmentStatus,
    hint: hintFor(assessmentStatus, isHe, false),
    // Always clickable — completed assessments take the user to a
    // recap, in-progress to resume.
    href: "/journey/assessment",
    items: [makeAssessmentItem(isHe, assessmentStatus)],
  };

  return [assessmentEntry, ...dynamicEntries];
}

// ─────────────────────────────────────────────────────────────────────
// DB-backed empty state — Phase 2 step C.
//
// When the user is entitled to Journey but has zero scheduled items,
// we still render the rail. Instead of the hardcoded six-topic
// placeholder, this builder pulls the journey program's actual
// categories from the DB. That way:
//   - The clinician can rename/reorder categories from the admin
//     and the user sees it.
//   - There's no synthetic hardcode pretending to be content.
//   - Adding a 7th topic doesn't require a code change.
//
// Falls back to the hardcoded buildStaticRail if the DB query fails
// (e.g. service-role missing on the env). The page is never empty.
// ─────────────────────────────────────────────────────────────────────

export async function buildDbBackedEmptyRail(args: {
  isHe: boolean;
  assessmentStage: AssessmentStage;
}): Promise<RailEntry[]> {
  const admin = createServiceRoleClient();
  if (!admin) {
    return buildStaticRail({
      isHe: args.isHe,
      assessmentStage: args.assessmentStage,
      hasActiveAssignments: false,
    });
  }

  try {
    // Find the canonical 'journey' program. We don't hardcode the
    // program id — admins create programs by slug, and the journey
    // program is conventionally slug='journey'.
    const { data: program } = await admin
      .from("journey_programs")
      .select("id")
      .eq("slug", "journey")
      .eq("is_active", true)
      .maybeSingle();

    if (!program?.id) {
      return buildStaticRail({
        isHe: args.isHe,
        assessmentStage: args.assessmentStage,
        hasActiveAssignments: false,
      });
    }

    const { data: cats } = await admin
      .from("journey_categories")
      .select("id, name_he, name_en, sort_order")
      .eq("program_id", program.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (!cats || cats.length === 0) {
      return buildStaticRail({
        isHe: args.isHe,
        assessmentStage: args.assessmentStage,
        hasActiveAssignments: false,
      });
    }

    // Lead with the assessment pill (it's not a category — it's the
    // questionnaire), then every active category from the program in
    // 'pending' state. Status comes from real assignments later when
    // the timeline grows; this is the empty fallback only.
    const assessmentStatus: RailStepStatus =
      args.assessmentStage === "completed" ? "completed" : "current";
    const assessmentEntry: RailEntry = {
      key: "static:assessment",
      label: args.isHe ? "אבחון" : "Assessment",
      status: assessmentStatus,
      hint: hintFor(assessmentStatus, args.isHe, false),
      href: "/journey/assessment",
      items: [makeAssessmentItem(args.isHe, assessmentStatus)],
    };

    const categoryEntries: RailEntry[] = cats.map((c) => ({
      key: `cat:${String(c.id)}`,
      label: args.isHe ? c.name_he : (c.name_en as string | null) || c.name_he,
      status: "pending",
      hint: hintFor("pending", args.isHe, false),
      href: null,
      // Empty: no scheduled items yet. JourneyDesk renders a
      // "preparing" panel state for these.
      items: [],
    }));

    return [assessmentEntry, ...categoryEntries];
  } catch (err) {
    console.error("[buildDbBackedEmptyRail] failed, falling back to static", err);
    return buildStaticRail({
      isHe: args.isHe,
      assessmentStage: args.assessmentStage,
      hasActiveAssignments: false,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────
// Progress aggregation — Phase 5
//
// Pure summary of the rail entries used by the JourneyDesk "progress
// strip" above the rail+content. The shape is deliberately small so
// the desk component can render it without juggling.
// ─────────────────────────────────────────────────────────────────────

export interface JourneyProgressSummary {
  /** Total real items across all pills (excludes the synthetic
   *  assessment item). */
  totalItems: number;
  completedItems: number;
  availableItems: number;
  lockedItems: number;
  /** Items the user has NOT responded to yet, but are currently
   *  available. The "what's waiting on me" number. */
  awaitingResponseItems: number;
  /** Items where the user has been "stuck" — available for >7 days
   *  with no response yet. Surfaced as a soft alert. */
  stuckItems: number;
  /** Total clinician replies the user hasn't acknowledged yet
   *  (rail-aggregated). */
  unreadReplies: number;
}

export function aggregateProgress(
  entries: RailEntry[],
  now?: Date,
): JourneyProgressSummary {
  const reference = (now ?? new Date()).getTime();
  const STUCK_MS = 7 * 24 * 60 * 60 * 1000;

  let total = 0;
  let completed = 0;
  let available = 0;
  let locked = 0;
  let awaiting = 0;
  let stuck = 0;
  let unread = 0;

  for (const entry of entries) {
    if (!entry.items) continue;
    for (const item of entry.items) {
      // Skip the synthetic assessment-link item — it's not a real
      // scheduled item with a completion lifecycle.
      if (item.status === "assessment") continue;
      total += 1;
      if (item.hasUnreadReply) unread += 1;
      if (item.status === "completed") {
        completed += 1;
        continue;
      }
      if (item.status === "locked") {
        locked += 1;
        continue;
      }
      if (item.status === "available") {
        available += 1;
        if (!item.userResponseText) {
          awaiting += 1;
          const unlockMs = item.unlockAt ? Date.parse(item.unlockAt) : 0;
          if (unlockMs > 0 && reference - unlockMs > STUCK_MS) {
            stuck += 1;
          }
        }
      }
    }
  }
  return {
    totalItems: total,
    completedItems: completed,
    availableItems: available,
    lockedItems: locked,
    awaitingResponseItems: awaiting,
    stuckItems: stuck,
    unreadReplies: unread,
  };
}

// ─────────────────────────────────────────────────────────────────────
// helpers
// ─────────────────────────────────────────────────────────────────────

function hintFor(status: RailStepStatus, isHe: boolean, unlockSoon: boolean): string {
  if (status === "completed") return isHe ? "הושלם" : "Completed";
  if (status === "current") return isHe ? "השלב הנוכחי" : "Current step";
  // pending
  if (unlockSoon) return isHe ? "ייפתח בקרוב" : "Coming soon";
  return isHe ? "ייפתח בהמשך" : "Coming up";
}
