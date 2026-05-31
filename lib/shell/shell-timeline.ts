/**
 * Slim, shell-specific timeline fetcher.
 *
 * Why this exists:
 *   `lib/journey-content/queries.ts:getTimelineForOwner` fans out 6 DB
 *   queries per call (scheduled, items, completions, responses, rules,
 *   categories) and is shared across /my/journey, admin surfaces, and
 *   the cadence engine. The shell pages (/my/today, /my/lessons) only
 *   need a small subset of that data:
 *     • scheduled.id + scheduled.unlock_at
 *     • item title (he/en) + body/insight + est_minutes + is_active
 *     • category name (he/en)
 *     • completion.completed_at
 *   …yet calling getTimelineForOwner pays for everything.
 *
 *   This file collapses those 6 reads into ONE Supabase request using
 *   PostgREST's embedded-select syntax (FK-driven joins). Per call:
 *     1× `listAssignmentsForOwner` (already React.cache'd → free on
 *        repeat within the same render)
 *     1× embedded select on `journey_scheduled_items` that pulls the
 *        item, its category, and the completion row in a single query.
 *
 *   Audience filtering is preserved: couple-owned timelines with an
 *   unknown viewer role surface only `audience='both'` rows, matching
 *   getTimelineForOwner's defensive default. Items with `is_active=false`
 *   are dropped client-side, matching the soft-hide rule there.
 *
 * Why we did NOT change `getTimelineForOwner` itself:
 *   It's load-bearing for surfaces that DO need responses/rules (e.g.
 *   /my/journey shows expert responses; admin surfaces show rule
 *   rationale). Replacing it would ripple far beyond the shell. A
 *   parallel slim helper avoids that risk.
 *
 * Added 2026-05-31 (L15 of the shell perf pass).
 */

import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { listAssignmentsForOwner } from "@/lib/journey-content/queries";
import type { JourneyOwner } from "@/lib/journey-content/types";

/**
 * Minimal entry shape consumed by the shell's today + lessons fetchers.
 * Mirrors the keys those consumers actually touch — no rules, no
 * responses, no status, no Item-level fields the shell never reads.
 */
export interface ShellTimelineEntry {
  scheduled: {
    id: string;
    unlock_at: string;
  };
  item: {
    id: string;
    title_he: string;
    title_en: string | null;
    body_he: string | null;
    body_en: string | null;
    expert_insight_he: string | null;
    expert_insight_en: string | null;
    est_minutes: number | null;
    is_active: boolean;
  };
  category: {
    id: string;
    slug: string;
    name_he: string;
    name_en: string | null;
  };
  /** Null when not yet completed. */
  completion: { completed_at: string | null } | null;
}

interface Args {
  owner: JourneyOwner;
  /** owner|partner|null. Couple-owned rows targeted at the OTHER member
   *  are hidden when this is null. */
  viewerCoupleRole: "owner" | "partner" | null;
  sourceKinds: Array<"program" | "category" | "item" | "cadence">;
  /** Clock override for tests. Defaults to now. */
  now?: Date;
}

// Embedded-select shape returned from PostgREST. Categories embed inside
// items, completion is a left-joined array (PostgREST returns reverse
// relations as arrays even when 1-1, so we take [0] below).
type RawRow = {
  id: string;
  assignment_id: string;
  audience: "both" | "owner" | "partner";
  unlock_at: string;
  item_id: string;
  journey_items: {
    id: string;
    title_he: string;
    title_en: string | null;
    body_he: string | null;
    body_en: string | null;
    expert_insight_he: string | null;
    expert_insight_en: string | null;
    est_minutes: number | null;
    is_active: boolean;
    category_id: string;
    journey_categories: {
      id: string;
      slug: string;
      name_he: string;
      name_en: string | null;
    } | null;
  } | null;
  journey_item_completions:
    | Array<{ completed_at: string | null }>
    | { completed_at: string | null }
    | null;
};

export async function getShellTimelineEntries(
  args: Args,
): Promise<ShellTimelineEntry[]> {
  const { owner, viewerCoupleRole, sourceKinds, now } = args;
  const clockIso = (now ?? new Date()).toISOString();

  // 1. Assignment ids — cached helper, free on repeat within a render.
  const assignments = await listAssignmentsForOwner(owner, {
    onlyActive: true,
    sourceKinds,
  });
  if (assignments.length === 0) return [];
  const assignmentIds = assignments.map((a) => a.id);

  // 2. The one embedded select that replaces the 5 sibling reads in
  //    getTimelineForOwner. Supabase auto-resolves FK names; if the
  //    schema ever grows a second FK between the same tables we'll
  //    need to qualify with `journey_items!fk_name(...)`.
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("journey_scheduled_items")
    .select(
      `
      id, assignment_id, audience, unlock_at, item_id,
      journey_items (
        id, title_he, title_en, body_he, body_en,
        expert_insight_he, expert_insight_en, est_minutes, is_active, category_id,
        journey_categories ( id, slug, name_he, name_en )
      ),
      journey_item_completions ( completed_at )
      `,
    )
    .in("assignment_id", assignmentIds)
    .lte("unlock_at", clockIso)
    .order("unlock_at", { ascending: true });

  if (error) {
    console.warn("[shell-timeline] embedded select failed", error);
    return [];
  }

  const rows = (data ?? []) as RawRow[];

  // 3. Audience filter (couple-owned only) + dropping rows whose item or
  //    category didn't resolve (is_active=false or admin deleted).
  const out: ShellTimelineEntry[] = [];
  for (const r of rows) {
    // Audience: couple-owned with unknown role → only 'both' surfaces.
    if (owner.kind === "couple") {
      if (r.audience !== "both") {
        if (!viewerCoupleRole) continue;
        if (r.audience !== viewerCoupleRole) continue;
      }
    }
    const item = r.journey_items;
    if (!item) continue;
    if (!item.is_active) continue;
    const category = item.journey_categories;
    if (!category) continue;

    // PostgREST returns 1-1 reverse-embedded relations as arrays; pick
    // the first row (there's at most one due to PRIMARY KEY constraint
    // on journey_item_completions.scheduled_item_id).
    const completionRaw = r.journey_item_completions;
    const completionRow = Array.isArray(completionRaw)
      ? completionRaw[0] ?? null
      : completionRaw ?? null;

    out.push({
      scheduled: {
        id: r.id,
        unlock_at: r.unlock_at,
      },
      item: {
        id: item.id,
        title_he: item.title_he,
        title_en: item.title_en,
        body_he: item.body_he,
        body_en: item.body_en,
        expert_insight_he: item.expert_insight_he,
        expert_insight_en: item.expert_insight_en,
        est_minutes: item.est_minutes,
        is_active: item.is_active,
      },
      category: {
        id: category.id,
        slug: category.slug,
        name_he: category.name_he,
        name_en: category.name_en,
      },
      completion: completionRow
        ? { completed_at: completionRow.completed_at }
        : null,
    });
  }

  return out;
}
