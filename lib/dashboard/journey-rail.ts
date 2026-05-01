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

export type RailStepStatus = "completed" | "current" | "pending";

export interface RailEntry {
  /** Stable identity. Static entries use slugs; dynamic ones use category UUIDs. */
  key: string;
  /** Localized label shown to the user. */
  label: string;
  status: RailStepStatus;
  /** Tiny line above the label ("הושלם" / "השלב הנוכחי" / "ייפתח בקרוב" / ...). */
  hint: string;
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

  return STATIC_STEPS.map((step, idx) => ({
    key: `static:${step.key}`,
    label: isHe ? step.label_he : step.label_en,
    status: statuses[idx],
    hint: hintFor(statuses[idx], isHe, /* unlockSoon */ false),
  }));
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
  now?: Date;
}): RailEntry[] {
  const { isHe, timeline, assessmentCompleted, now } = args;
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

    return {
      key: `dyn:${bucket.categoryId}`,
      label: bucket.label,
      status,
      hint: hintFor(status, isHe, unlockSoon),
    };
  });

  // Prepend the implicit "אבחון" pill so the rail always starts with
  // the questionnaire step — keeps the narrative consistent across
  // both static and dynamic modes.
  const assessmentEntry: RailEntry = {
    key: "static:assessment",
    label: isHe ? "אבחון" : "Assessment",
    status: assessmentCompleted ? "completed" : "current",
    hint: hintFor(
      assessmentCompleted ? "completed" : "current",
      isHe,
      false,
    ),
  };

  return [assessmentEntry, ...dynamicEntries];
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
