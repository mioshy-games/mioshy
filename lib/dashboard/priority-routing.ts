import "server-only";

/**
 * lib/dashboard/priority-routing.ts
 *
 * Phase 5 - adaptive content ordering based on the user's own
 * priority ranking from the assessment.
 *
 * The product principle:
 *   - Experts upload content tagged by category (communication,
 *     intimacy, emotional_connection, friendship, family).
 *   - Each USER (not couple) ranked these in the assessment.
 *   - When the user enters their tuned clinic, content reorders so
 *     their #1 priority appears first; their #5 last.
 *   - Two partners under the same couple may see DIFFERENT order
 *     because they ranked things differently.
 *
 * What this file owns:
 *   - getViewerPriorityOrder(userId) - returns the user's ranking
 *   - sortRailByPriorities(rail, order) - pure reorder of rail entries
 *
 * Mapping rules:
 *   - Categories whose slug matches a PriorityKey (i.e. one of the
 *     seeded journey_categories.assessment_priority_key values) map to
 *     the corresponding priority position.
 *   - The implicit "static:assessment" pill is always FIRST (the
 *     questionnaire stays at the top).
 *   - Categories outside the priority taxonomy (admin-defined extras)
 *     keep their natural sort_order, after the priority categories.
 *
 * What this file does NOT do:
 *   - It does not filter content out - every assigned item still
 *     appears in the rail. We only reorder.
 *   - It does not change WHICH items go to whom - that's the
 *     existing `audience` filter in journey_scheduled_items.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";
import { isPriorityKey, type PriorityKey } from "@/lib/journey/priorities";
import type { RailEntry } from "@/lib/dashboard/journey-rail";

/**
 * Pull the user's most recent priority ranking from
 * journey_responses.answer.kind === 'ranking'. Returns null when the
 * user has not completed the priority question - caller falls back
 * to natural sort_order.
 */
export async function getViewerPriorityOrder(
  userId: string,
): Promise<PriorityKey[] | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  // Find this user's most recent journey row
  const { data: journey } = await admin
    .from("journeys")
    .select("id")
    .eq("user_id", userId)
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!journey?.id) return null;

  const { data: responses } = await admin
    .from("journey_responses")
    .select("answer, created_at")
    .eq("journey_id", journey.id)
    .order("created_at", { ascending: false });

  if (!responses || responses.length === 0) return null;

  for (const r of responses) {
    const ans = r.answer as { kind?: string; order?: unknown } | null;
    if (!ans || ans.kind !== "ranking") continue;
    const order = ans.order;
    if (!Array.isArray(order)) continue;
    const validated: PriorityKey[] = [];
    for (const k of order) {
      if (isPriorityKey(k)) {
        validated.push(k);
      }
    }
    if (validated.length > 0) return validated;
  }
  return null;
}

/**
 * Reorder rail entries so categories matching the user's priority
 * order surface first, in their ranked order.
 *
 * Rules:
 *   1. The first entry that's identified as the assessment pill
 *      (key === 'static:assessment') stays at index 0 unchanged.
 *   2. Other entries whose `categorySlug` matches a priority key are
 *      ordered by the user's ranking position.
 *   3. Entries with no matching slug fall through after the priority
 *      block, in their original order.
 *
 * Pure: doesn't mutate input, returns a new array.
 *
 * `categorySlugByKey`: caller-supplied lookup from rail entry key →
 *   category slug. Built by the page from the timeline data, since
 *   the rail entry itself doesn't carry the slug currently. Pass an
 *   empty map and the function falls back to no reordering (safe).
 */
export function sortRailByPriorities(
  rail: RailEntry[],
  priorities: PriorityKey[] | null,
  categorySlugByKey: Map<string, string | null>,
): RailEntry[] {
  if (!priorities || priorities.length === 0) return rail;

  const positionOf = new Map<string, number>();
  priorities.forEach((k, i) => positionOf.set(k, i));

  const assessmentIdx = rail.findIndex((e) => e.key === "static:assessment");
  const assessmentEntry = assessmentIdx >= 0 ? rail[assessmentIdx] : null;
  const others = rail.filter((_, i) => i !== assessmentIdx);

  const priorityEntries: RailEntry[] = [];
  const otherEntries: RailEntry[] = [];

  for (const entry of others) {
    const slug = categorySlugByKey.get(entry.key) ?? null;
    if (slug && positionOf.has(slug)) {
      priorityEntries.push(entry);
    } else {
      otherEntries.push(entry);
    }
  }

  // Sort priority entries by user's ranking position
  priorityEntries.sort((a, b) => {
    const sa = categorySlugByKey.get(a.key) ?? "";
    const sb = categorySlugByKey.get(b.key) ?? "";
    const pa = positionOf.get(sa) ?? Number.MAX_SAFE_INTEGER;
    const pb = positionOf.get(sb) ?? Number.MAX_SAFE_INTEGER;
    return pa - pb;
  });

  return [
    ...(assessmentEntry ? [assessmentEntry] : []),
    ...priorityEntries,
    ...otherEntries,
  ];
}
