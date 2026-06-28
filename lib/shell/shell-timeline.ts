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
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { listAssignmentsForOwner } from "@/lib/journey-content/queries";
import { viewerIsPartnerOfOwner } from "@/lib/journey-content/owner";
import type { JourneyOwner } from "@/lib/journey-content/types";
import { makeLogger } from "@/lib/observability/log";

// 2026-05-31 — surface slow timeline calls. The embedded select replaced
// 6 queries with 1, but we still want to spot regressions if the join
// gets heavy. Filter `scope=shell.timeline` to see every call's timing.
const log = makeLogger("shell.timeline");

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
  /** Gate B (shared-content step 2): the authenticated viewer. When the
   *  owner is a *different* user and the viewer is that owner's partner,
   *  the assignment + scheduled reads escalate to the admin client so RLS
   *  doesn't drop the owner's per-user cadence rows. Omit to keep the
   *  session client (unchanged behaviour). */
  viewerUserId?: string;
  /** Clock override for tests. Defaults to now. */
  now?: Date;
}

// Embedded-select shape returned from PostgREST.
//
// PostgREST gotcha: at runtime, forward FKs (many-to-one) return single
// objects while reverse FKs return arrays. The TypeScript types from
// @supabase/postgrest-js, however, model EVERY embedded relation as an
// array. Our union/array tolerance below absorbs the mismatch — we use
// `pickOne` at the call site to flatten either shape.
type ItemEmbedded = {
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
  journey_categories: CategoryEmbedded | CategoryEmbedded[] | null;
};

type CategoryEmbedded = {
  id: string;
  slug: string;
  name_he: string;
  name_en: string | null;
};

type CompletionEmbedded = { completed_at: string | null };

type RawRow = {
  id: string;
  assignment_id: string;
  audience: "both" | "owner" | "partner";
  unlock_at: string;
  item_id: string;
  journey_items: ItemEmbedded | ItemEmbedded[] | null;
  journey_item_completions:
    | CompletionEmbedded
    | CompletionEmbedded[]
    | null;
};

/** Defensive helper — PostgREST returns single objects for many-to-one
 *  relations at runtime but the TS types model them as arrays. This
 *  unwraps either shape into the singular form (or null). */
function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? value[0] ?? null : value;
}

export async function getShellTimelineEntries(
  args: Args,
): Promise<ShellTimelineEntry[]> {
  const t0 = Date.now();
  const { owner, viewerCoupleRole, sourceKinds, viewerUserId, now } = args;
  const clockIso = (now ?? new Date()).toISOString();
  const ownerKey =
    owner.kind === "couple" ? `couple:${owner.coupleId}` : `user:${owner.userId}`;

  // Gate B (shared-content step 2): escalate to the admin client only when
  // the viewer is reading the subscription owner's per-user queue and
  // couple_members confirms the partnership. Otherwise session client.
  const crossUser =
    !!viewerUserId &&
    owner.kind === "user" &&
    owner.userId !== viewerUserId &&
    (await viewerIsPartnerOfOwner(viewerUserId, owner.userId));

  // 1. Assignment ids — cached helper, free on repeat within a render.
  const tAssign = Date.now();
  const assignments = await listAssignmentsForOwner(owner, {
    onlyActive: true,
    sourceKinds,
    viewerUserId,
  });
  log.info("assignments_fetched", {
    owner: ownerKey,
    kinds: sourceKinds.join(","),
    count: assignments.length,
    dur_ms: Date.now() - tAssign,
  });
  if (assignments.length === 0) {
    log.info("empty_short_circuit", {
      owner: ownerKey,
      dur_ms: Date.now() - t0,
    });
    return [];
  }
  const assignmentIds = assignments.map((a) => a.id);

  // 2. The one embedded select that replaces the 5 sibling reads in
  //    getTimelineForOwner. Supabase auto-resolves FK names; if the
  //    schema ever grows a second FK between the same tables we'll
  //    need to qualify with `journey_items!fk_name(...)`.
  const tFetch = Date.now();
  const supabase = crossUser
    ? (createServiceRoleClient() ?? (await createServerSupabaseClient()))
    : await createServerSupabaseClient();
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
  const fetchDur = Date.now() - tFetch;

  if (error) {
    log.error("embedded_select_failed", {
      owner: ownerKey,
      reason: error.message,
      dur_ms: fetchDur,
    });
    return [];
  }

  // Anything > 500ms here usually means cross-region traffic or a
  // missing index, both worth surfacing immediately.
  if (fetchDur > 500) {
    log.warn("embedded_select_slow", {
      owner: ownerKey,
      rows: (data ?? []).length,
      dur_ms: fetchDur,
    });
  } else {
    log.info("embedded_select_done", {
      owner: ownerKey,
      rows: (data ?? []).length,
      dur_ms: fetchDur,
    });
  }

  const rows = (data ?? []) as unknown as RawRow[];

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
    const item = pickOne(r.journey_items);
    if (!item) continue;
    if (!item.is_active) continue;
    const category = pickOne(item.journey_categories);
    if (!category) continue;

    // PRIMARY KEY constraint on journey_item_completions.scheduled_item_id
    // means at most one completion row. pickOne handles both the array
    // shape the TS types model and the single-object PostgREST runtime
    // returns for reverse 1-1 relations.
    const completionRow = pickOne(r.journey_item_completions);

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

  log.info("done", {
    owner: ownerKey,
    raw_rows: rows.length,
    out_rows: out.length,
    dur_ms: Date.now() - t0,
  });
  return out;
}
