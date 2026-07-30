// ============================================================
// Cadence engine - slice 3 of the v3 per-partner content delivery
// system.
//
// Responsibilities (everything in this file is server-only):
//
//   1. pickNextItemForUser(userId)
//        - Read user's ranking + delivered set + active candidates.
//          Apply weighted-interleave (largest-deficit) across the
//          ranked categories, with admin order (subtopic.sort_order
//          → item.sort_order) inside the chosen category.
//
//   2. markStaleAsSkipped(userId, autoSkipDays)
//        - Bulk UPDATE: every cadence scheduled_items row owned by
//          this user that's past auto_skip_after_days with no
//          response gets skipped_at = now(). Idempotent.
//
//   3. ensureCadenceAssignment(userId, anchorDate?)
//        - Idempotent get-or-create of the per-user cadence
//          assignment (migration 058). Returns the assignment_id.
//
//   4. materializeNextItemForUser(userId, opts)
//        - High-level entrypoint:
//            a. Skip-sweep
//            b. Resolve cadence assignment id
//            c. Pick next item
//            d. Insert delivered_items first (PK acts as a lock)
//            e. Insert scheduled_items
//            f. Backfill delivered_items.scheduled_item_id
//          Returns { ok: true, scheduledItemId, itemId } or
//          { ok: false, reason }.
//
//   5. isCadenceEligible(userId)
//        - Combined gate: journey entitlement is active, not in
//          grace, not blocked, has a journey_user_priorities row,
//          not manually paused (profiles.journey_paused_at IS NULL).
//
// All writes go through the service-role admin client because the
// engine routinely operates on rows the calling user wouldn't own
// (notably journey_user_delivered_items + journey_scheduled_items).
//
// Group-cohort awareness (slice 7) plugs into pickNextItemForUser
// at the marked extension point - each ranked category can be
// shadowed by a group's REPLACE-mode subtopic, and INTERLEAVE-mode
// items can be merged into the candidate pool.
//
// Random/discovery picks (tag = 'discovery') plug in similarly:
// when default_random_per_week > 0, every Nth pick is drawn from
// the discovery pool instead of the ranked queue. Slice 3 leaves
// the random rate at 0 by default so this branch never fires; the
// hook lives at the marked extension point.
// ============================================================

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import {
  getJourneySettings,
  effectiveDeliveryDays,
  effectiveDeliveryLocalHour,
  type JourneySettings,
} from "./journey-settings";
import { getReplaceSubtopicsForUser } from "./queries";

// ------------------------------------------------------------
// Types
// ------------------------------------------------------------

export type CadenceSource = "cadence" | "expert_push" | "group" | "random";

interface UserPrioritiesRow {
  user_id: string;
  ranking: string[];
  weights: number[];
}

interface CandidateItem {
  id: string;
  category_id: string;
  subtopic_id: string | null;
  /** Sort key for "next item in this category": subtopic order then
   *  item order. NULLS first means direct-on-category items appear
   *  before subtopic-bound items by default (admin-tunable per row). */
  category_sort_key: string;
}

export type MaterializeReason =
  | "migrated_to_cycles"
  | "no_priorities"
  | "no_candidates"
  | "no_assignment"
  | "duplicate"
  | "db_error";

export interface MaterializeResult {
  ok: boolean;
  scheduledItemId?: string;
  itemId?: string;
  categoryId?: string;
  reason?: MaterializeReason;
  error?: string;
}

// ------------------------------------------------------------
// 1. Picker
// ------------------------------------------------------------

/**
 * Pick the next item to deliver for a user given their ranking,
 * delivered history, and the active catalog. Returns null if there's
 * nothing to deliver (no priorities, no remaining items, etc.).
 *
 * Algorithm (largest-remainder / deficit picking):
 *   For each ranked category, the "expected share" is its weight.
 *   The "actual share" is delivered_count_in_category / total_delivered.
 *   The deficit is expected - actual.
 *   We pick the category with the largest deficit that still has at
 *   least one un-delivered candidate. Ties broken by ranking position.
 */
export async function pickNextItemForUser(
  userId: string,
): Promise<{ itemId: string; categoryId: string } | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  // Load user's ranking + weights (or fall back to platform defaults).
  const settings = await getJourneySettings();
  const { data: prioritiesRow } = await admin
    .from("journey_user_priorities")
    .select("user_id, ranking, weights")
    .eq("user_id", userId)
    .maybeSingle();
  if (!prioritiesRow) return null;

  const priorities = prioritiesRow as unknown as UserPrioritiesRow;
  const ranking: string[] = Array.isArray(priorities.ranking)
    ? priorities.ranking
    : [];
  const weights: number[] = Array.isArray(priorities.weights)
    ? priorities.weights
    : settings.defaultPriorityWeights;
  if (ranking.length === 0) return null;

  // Per-category delivered counts. Joining delivered_items → items
  // lets us bucket by item.category_id even though the dedup table
  // doesn't store the category itself.
  const { data: deliveredRows, error: deliveredErr } = await admin
    .from("journey_user_delivered_items")
    .select("item_id, journey_items!inner(category_id)")
    .eq("user_id", userId);
  if (deliveredErr) {
    console.error("[cadence-engine.pick] delivered read failed", deliveredErr);
    return null;
  }
  const countsByCategory = new Map<string, number>();
  let totalDelivered = 0;
  for (const r of (deliveredRows ?? []) as unknown as Array<{
    journey_items: { category_id: string };
  }>) {
    const cat = r.journey_items?.category_id;
    if (!cat) continue;
    countsByCategory.set(cat, (countsByCategory.get(cat) ?? 0) + 1);
    totalDelivered++;
  }

  // Candidates: every active item in any of the ranked categories
  // that hasn't been delivered yet. Subtopic must be NULL or active
  // (an inactive subtopic hides its items from the queue).
  const { data: candidateRows, error: candErr } = await admin
    .from("journey_items")
    .select(
      "id, category_id, subtopic_id, sort_order, journey_subtopics(sort_order, is_active)",
    )
    .in("category_id", ranking)
    .eq("is_active", true);
  if (candErr) {
    console.error("[cadence-engine.pick] candidate read failed", candErr);
    return null;
  }

  // Build a delivered-id Set for O(1) filter.
  const deliveredItemIds = new Set<string>(
    ((deliveredRows ?? []) as unknown as Array<{ item_id: string }>).map(
      (r) => r.item_id,
    ),
  );

  // v3 slice 7 - group cohort filter. Replace-mode bindings hide the
  // bound subtopic from this user's auto-cadence entirely; admin
  // pushes (slice 8) are the only path to surface items in those
  // subtopics for the user. Interleave-mode bindings have no effect
  // here - items still flow normally; the additive admin-push lands
  // in slice 8.
  const replaceSubtopicIds = await getReplaceSubtopicsForUser(userId);

  // Filter: not delivered, subtopic active (or NULL), AND not in a
  // replace-mode subtopic for this user.
  const candidates: CandidateItem[] = [];
  for (const row of (candidateRows ?? []) as unknown as Array<{
    id: string;
    category_id: string;
    subtopic_id: string | null;
    sort_order: number;
    journey_subtopics: { sort_order: number; is_active: boolean } | null;
  }>) {
    if (deliveredItemIds.has(row.id)) continue;
    if (row.subtopic_id && !row.journey_subtopics?.is_active) continue;
    if (row.subtopic_id && replaceSubtopicIds.has(row.subtopic_id)) continue;
    const subSort = row.subtopic_id ? row.journey_subtopics?.sort_order ?? 0 : -1;
    // Build a sortable composite key. Pad with leading zeros so
    // string sort matches numeric sort. Direct-on-category items
    // (subSort = -1) sort before subtopic-bound ones; tweak by
    // raising direct items' subtopic sort floor if you want them
    // after subtopics.
    candidates.push({
      id: row.id,
      category_id: row.category_id,
      subtopic_id: row.subtopic_id,
      category_sort_key: `${String(subSort + 1_000_000).padStart(8, "0")}|${String(row.sort_order + 1_000_000).padStart(8, "0")}|${row.id}`,
    });
  }

  if (candidates.length === 0) return null;

  // Group candidates by category and sort each bucket.
  const byCategory = new Map<string, CandidateItem[]>();
  for (const c of candidates) {
    const list = byCategory.get(c.category_id) ?? [];
    list.push(c);
    byCategory.set(c.category_id, list);
  }
  for (const list of byCategory.values()) {
    list.sort((a, b) => a.category_sort_key.localeCompare(b.category_sort_key));
  }

  // ---------------------------------------------------------------
  // GROUP COHORTS (slice 7):
  //   Replace-mode bindings already filtered above (replaceSubtopicIds).
  //   Interleave mode is a no-op in the picker - items in those
  //   subtopics flow normally; the additive admin-push surfaces
  //   group-curated items via slice 8 (expert push v2).
  //
  // SLICE N EXTENSION POINT - random/discovery pool:
  //   When settings.defaultRandomPerWeek > 0 and (delivered cadence
  //   count modulo curated:random ratio) selects a random slot:
  //     - Skip the ranked queue and pick uniformly from items where
  //       'discovery' = ANY(tags) and id NOT IN delivered.
  //   Stays a no-op until slice 8 wires admin-configurable rates.
  // ---------------------------------------------------------------

  // Compute deficits and pick. Tie-break by ranking position so
  // the higher-priority category wins when shares are equal.
  let bestIdx = -1;
  let bestDeficit = -Infinity;
  for (let i = 0; i < ranking.length; i++) {
    const catId = ranking[i];
    const bucket = byCategory.get(catId);
    if (!bucket || bucket.length === 0) continue; // exhausted in this category
    const expected = weights[i] ?? 0;
    const actual = totalDelivered === 0
      ? 0
      : (countsByCategory.get(catId) ?? 0) / totalDelivered;
    const deficit = expected - actual;
    if (deficit > bestDeficit) {
      bestDeficit = deficit;
      bestIdx = i;
    }
  }

  if (bestIdx < 0) return null;
  const chosenCategory = ranking[bestIdx];
  const chosen = byCategory.get(chosenCategory)?.[0];
  if (!chosen) return null;
  return { itemId: chosen.id, categoryId: chosen.category_id };
}

// ------------------------------------------------------------
// 2. Skip-sweep
// ------------------------------------------------------------

export async function markStaleAsSkipped(
  userId: string,
  autoSkipAfterDays: number,
): Promise<{ skipped: number }> {
  const admin = createServiceRoleClient();
  if (!admin) return { skipped: 0 };

  // Find scheduled rows belonging to this user via the cadence
  // assignment (we restrict to source='cadence' so expert pushes
  // and group/random items aren't auto-marked).
  const cutoffIso = new Date(
    Date.now() - autoSkipAfterDays * 86_400_000,
  ).toISOString();

  // Two-step: find ids first, then update by id list. We can't UPDATE
  // ... FROM ... in a single PostgREST call.
  const { data: stale, error: readErr } = await admin
    .from("journey_scheduled_items")
    .select("id, journey_assignments!inner(user_id, source_kind)")
    .eq("source", "cadence")
    .is("responded_at", null)
    .is("skipped_at", null)
    .lt("unlock_at", cutoffIso)
    .eq("journey_assignments.user_id", userId)
    .eq("journey_assignments.source_kind", "cadence");
  if (readErr) {
    console.error("[cadence-engine.skip-sweep] read failed", readErr);
    return { skipped: 0 };
  }
  const staleIds = (stale ?? []).map((r) => r.id as string);
  if (staleIds.length === 0) return { skipped: 0 };

  const nowIso = new Date().toISOString();
  const { error: updErr } = await admin
    .from("journey_scheduled_items")
    .update({ skipped_at: nowIso })
    .in("id", staleIds);
  if (updErr) {
    console.error("[cadence-engine.skip-sweep] update failed", updErr);
    return { skipped: 0 };
  }
  return { skipped: staleIds.length };
}

// ------------------------------------------------------------
// 3. Cadence assignment (idempotent get-or-create)
// ------------------------------------------------------------

export async function ensureCadenceAssignment(
  userId: string,
  anchorDate: Date = new Date(),
): Promise<string | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  // Hot path: row already exists (most common after day-1).
  const { data: existing } = await admin
    .from("journey_assignments")
    .select("id")
    .eq("user_id", userId)
    .eq("source_kind", "cadence")
    .eq("is_active", true)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await admin
    .from("journey_assignments")
    .insert({
      user_id: userId,
      source_kind: "cadence",
      // source_id NOT NULL on the existing schema; the user's own id
      // is a stable sentinel.
      source_id: userId,
      anchor_kind: "assignment",
      anchor_date: anchorDate.toISOString(),
      origin: "trigger",
      origin_ref: `assessment_complete:${userId}`,
      is_active: true,
    })
    .select("id")
    .single();

  // Race: another process inserted between our read and insert. The
  // partial unique index throws 23505 - re-read.
  if (error) {
    if (error.code === "23505") {
      const { data: raced } = await admin
        .from("journey_assignments")
        .select("id")
        .eq("user_id", userId)
        .eq("source_kind", "cadence")
        .eq("is_active", true)
        .maybeSingle();
      return (raced?.id as string) ?? null;
    }
    console.error("[cadence-engine.assignment] insert failed", error);
    return null;
  }
  return (created?.id as string) ?? null;
}

// ------------------------------------------------------------
// 4. Materialize
// ------------------------------------------------------------

export interface MaterializeOpts {
  /** When set, this is the unlock_at timestamp written on the new
   *  scheduled_items row. Defaults to now(). Day-1 trigger uses now;
   *  the cron uses now (the slot has already fired). */
  unlockAt?: Date;
  /** Override the source enum on both scheduled_items and
   *  delivered_items. Default 'cadence'. */
  source?: CadenceSource;
  /** Set to skip the skip-sweep step (useful for tests / day-1
   *  where there's no prior history to evaluate). */
  skipSweep?: boolean;
}

export async function materializeNextItemForUser(
  userId: string,
  opts: MaterializeOpts = {},
): Promise<MaterializeResult> {
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, reason: "db_error", error: "no admin client" };

  const settings = await getJourneySettings();
  const defaultSource: CadenceSource = opts.source ?? "cadence";
  const unlockAt = (opts.unlockAt ?? new Date()).toISOString();

  // Skip-sweep first so the picker's deficit math reflects reality.
  if (!opts.skipSweep) {
    await markStaleAsSkipped(userId, settings.autoSkipAfterDays);
  }

  const assignmentId = await ensureCadenceAssignment(userId);
  if (!assignmentId) {
    return { ok: false, reason: "no_assignment" };
  }

  // v3 slice 8 - drain pending expert pushes BEFORE the regular
  // picker. The oldest unconsumed push for this user wins; replace-
  // mode subtopic filters from slice 7 are bypassed because pushes
  // carry an explicit item_id (no picker involved). One push consumed
  // per slot - multi-item batches drain over multiple slots.
  let pendingPushId: string | null = null;
  let chosenItemId: string;
  let chosenSource: CadenceSource = defaultSource;
  let chosenCategoryId: string | undefined;

  const { data: pendingRow, error: pendingErr } = await admin
    .from("journey_pending_pushes")
    .select("id, item_id")
    .eq("recipient_user_id", userId)
    .is("consumed_at", null)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (pendingErr) {
    console.warn(
      "[cadence-engine.materialize] pending-push read failed - falling through to picker",
      pendingErr,
    );
  }
  if (pendingRow) {
    pendingPushId = pendingRow.id as string;
    chosenItemId = pendingRow.item_id as string;
    chosenSource = "expert_push";
  } else {
    // ── Cut-over guard (Itzik 2026-07-31) ───────────────────────────────
    // Deliberately placed on the REGULAR-PICKER branch only, AFTER the push
    // drain: once a user is on the five-track cycle model this engine must
    // stop handing out weekly cadence items to them (two mechanisms writing
    // journey_user_delivered_items is the bug family that cost 2026-07-30) —
    // but the expert push lane stays open, because §9.3 keeps the expert on a
    // weekly rhythm regardless of the monthly cycle. An earlier version of
    // this guard sat at the top of the function and silently killed expert
    // pushes for every cycle user.
    const { data: openCycle } = await admin
      .from("journey_cycles")
      .select("id")
      .eq("user_id", userId)
      .is("closed_at", null)
      .limit(1)
      .maybeSingle();
    if (openCycle) {
      console.log("[cadence-engine] cadence pick skipped — user is on the cycle model", {
        user_id8: userId.slice(0, 8),
      });
      return { ok: false, reason: "migrated_to_cycles" };
    }

    const pick = await pickNextItemForUser(userId);
    if (!pick) {
      return { ok: false, reason: "no_candidates" };
    }
    chosenItemId = pick.itemId;
    chosenCategoryId = pick.categoryId;
  }

  // Step 1: insert dedup row first. Its PK on (user_id, item_id)
  // acts as a lock - concurrent materializers (cron + day-1 trigger)
  // can't both succeed on the same item.
  const { error: dedupErr } = await admin
    .from("journey_user_delivered_items")
    .insert({
      user_id: userId,
      item_id: chosenItemId,
      source: chosenSource,
    });
  if (dedupErr) {
    if (dedupErr.code === "23505") {
      // Already delivered - another concurrent process won the race,
      // OR the same item was already pushed and delivered earlier.
      // For pushes: mark this row consumed too so it doesn't queue
      // forever; the user already got the item via the prior path.
      if (pendingPushId) {
        await admin
          .from("journey_pending_pushes")
          .update({ consumed_at: new Date().toISOString() })
          .eq("id", pendingPushId);
      }
      return { ok: false, reason: "duplicate" };
    }
    console.error("[cadence-engine.materialize] dedup insert failed", dedupErr);
    return { ok: false, reason: "db_error", error: dedupErr.message };
  }

  // Step 2: insert the scheduled row.
  // For the audience field: cadence + push rows are per-user (assignment
  // is user-owned), so 'both' is the only sensible value - a couple-
  // partition matters only on couple-owned assignments.
  const { data: schedRow, error: schedErr } = await admin
    .from("journey_scheduled_items")
    .insert({
      assignment_id: assignmentId,
      item_id: chosenItemId,
      unlock_at: unlockAt,
      sort_order: 0,
      has_unlock_override: false,
      source: chosenSource,
      audience: "both",
    })
    .select("id")
    .single();
  if (schedErr || !schedRow) {
    console.error(
      "[cadence-engine.materialize] scheduled insert failed",
      schedErr,
    );
    // Roll back the dedup row so the item is reachable next time.
    // This is best-effort - if delete also fails we leak a row but
    // never deliver twice (the picker filters by delivered).
    await admin
      .from("journey_user_delivered_items")
      .delete()
      .eq("user_id", userId)
      .eq("item_id", chosenItemId);
    return {
      ok: false,
      reason: "db_error",
      error: schedErr?.message ?? "scheduled insert returned null",
    };
  }

  // Step 3: backfill the FK on the dedup row. Best-effort; failure
  // here is harmless (the FK is purely informational).
  await admin
    .from("journey_user_delivered_items")
    .update({ scheduled_item_id: schedRow.id })
    .eq("user_id", userId)
    .eq("item_id", chosenItemId);

  // Step 4: when this materialization drained a pending push, mark
  // the source row consumed and link it to the new scheduled row.
  // Same best-effort semantics as the FK backfill above.
  if (pendingPushId) {
    await admin
      .from("journey_pending_pushes")
      .update({
        consumed_at: new Date().toISOString(),
        scheduled_item_id: schedRow.id,
      })
      .eq("id", pendingPushId);
  }

  return {
    ok: true,
    scheduledItemId: schedRow.id as string,
    itemId: chosenItemId,
    categoryId: chosenCategoryId,
  };
}

// ------------------------------------------------------------
// 5. Eligibility
// ------------------------------------------------------------

export interface EligibilityResult {
  eligible: boolean;
  reason?:
    | "no_journey_subscription"
    | "in_grace"
    | "blocked"
    | "no_priorities"
    | "manually_paused";
}

export async function isCadenceEligible(
  userId: string,
): Promise<EligibilityResult> {
  const admin = createServiceRoleClient();
  if (!admin) return { eligible: false, reason: "no_journey_subscription" };

  // Subscription gate: there must be a current journey subscription
  // that's neither in grace nor blocked.
  const { data: sub } = await admin
    .from("subscriptions")
    .select("status, current_period_end, journey_grace_until, journey_blocked_at")
    .eq("user_id", userId)
    .eq("product", "journey")
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!sub) return { eligible: false, reason: "no_journey_subscription" };
  if (sub.journey_blocked_at) return { eligible: false, reason: "blocked" };
  if (sub.journey_grace_until) {
    // Grace window: pause new materialization but past content stays.
    const graceUntil = new Date(sub.journey_grace_until as string).getTime();
    if (graceUntil > Date.now()) {
      return { eligible: false, reason: "in_grace" };
    }
    // Grace passed without renewal - the grace-watcher cron should
    // have flipped journey_blocked_at by now. Treat as blocked
    // defensively.
    return { eligible: false, reason: "blocked" };
  }
  // A3 (task 26, bug ג): a trialing sub materializes chapters exactly like an
  // active one — trial = full membership. current_period_end mirrors
  // trial_ends_at, so the deadline check below still applies.
  if (sub.status !== "active" && sub.status !== "trialing") {
    return { eligible: false, reason: "no_journey_subscription" };
  }
  if (
    sub.current_period_end &&
    new Date(sub.current_period_end as string).getTime() < Date.now()
  ) {
    // Period ended without grace flag - should not happen if the
    // grace-watcher (slice 5) is running. Treat as inactive.
    return { eligible: false, reason: "no_journey_subscription" };
  }

  // Manual pause (profiles.journey_paused_at).
  const { data: profile } = await admin
    .from("profiles")
    .select("journey_paused_at")
    .eq("id", userId)
    .maybeSingle();
  if (profile?.journey_paused_at) {
    const pausedAt = new Date(profile.journey_paused_at as string).getTime();
    if (pausedAt <= Date.now()) {
      return { eligible: false, reason: "manually_paused" };
    }
  }

  // Layer-3 user-initiated pause via subscription_pauses. Belt-and-
  // suspenders alongside the /my/journey UI gate so even if the
  // page route is bypassed, the cadence engine never materialises
  // for a paused user.
  const { data: pauseRow } = await admin
    .from("subscription_pauses")
    .select("paused_until")
    .eq("user_id", userId)
    .is("resumed_at", null)
    .order("paused_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pauseRow) {
    const until = new Date(
      (pauseRow as { paused_until: string }).paused_until,
    ).getTime();
    if (Number.isFinite(until) && until > Date.now()) {
      return { eligible: false, reason: "manually_paused" };
    }
  }

  // Must have a ranking row.
  const { data: priorities } = await admin
    .from("journey_user_priorities")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!priorities) return { eligible: false, reason: "no_priorities" };

  return { eligible: true };
}

// ------------------------------------------------------------
// 6. Cron sweep helpers
// ------------------------------------------------------------

/**
 * Compute the user's effective delivery schedule (with profile
 * overrides applied) and decide whether right now is a delivery
 * slot they should receive an item in.
 *
 * Timezone caveat: profiles has no tz column today. We treat
 * delivery_local_hour as UTC. Default 9 UTC ≈ noon Israel - close
 * enough for v3 launch. A future migration can add profiles.timezone
 * and wire it in here.
 */
export function isDeliverySlotNow(
  settings: JourneySettings,
  profileOverrideDays: number[] | null,
  profileOverrideHour: number | null,
  now: Date = new Date(),
): { isSlot: boolean; reason?: "wrong_day" | "before_hour" } {
  const days = effectiveDeliveryDays(settings, profileOverrideDays);
  const hour = effectiveDeliveryLocalHour(settings, profileOverrideHour);

  // Postgres extract(dow): 0=Sun..6=Sat. JS Date.getUTCDay matches.
  const dow = now.getUTCDay();
  if (!days.includes(dow)) return { isSlot: false, reason: "wrong_day" };
  if (now.getUTCHours() < hour) {
    return { isSlot: false, reason: "before_hour" };
  }
  return { isSlot: true };
}

/**
 * Has this user already received a cadence item today (UTC) - and
 * are they at or above their weekly cap?
 *
 * Returns:
 *   { capReached: true }  → don't deliver more this week
 *   { capReached: false, deliveredToday: boolean }
 *
 * Weekly cap is a 7-day rolling window, not a calendar week. With
 * 1/week + Monday default, this means at most one delivery per
 * Monday; if a user changes to Mon+Wed with cap=2, they'll get one
 * each. With cap=1 and Mon+Wed schedule, they'd get one on Monday
 * then the Wednesday slot is no-op until the Monday slot rolls off
 * the 7-day window.
 */
export async function checkWeeklyDeliveryState(
  userId: string,
  curatedPerWeek: number,
): Promise<{ capReached: boolean; deliveredToday: boolean }> {
  const admin = createServiceRoleClient();
  if (!admin) return { capReached: true, deliveredToday: false };

  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const todayStartIso = new Date(
    Date.UTC(
      new Date().getUTCFullYear(),
      new Date().getUTCMonth(),
      new Date().getUTCDate(),
    ),
  ).toISOString();

  const { data: rows, error } = await admin
    .from("journey_scheduled_items")
    .select("unlock_at, journey_assignments!inner(user_id, source_kind)")
    .eq("source", "cadence")
    .gte("unlock_at", sevenDaysAgo)
    .eq("journey_assignments.user_id", userId)
    .eq("journey_assignments.source_kind", "cadence");

  if (error) {
    console.error("[cadence-engine.weekly-state] read failed", error);
    return { capReached: true, deliveredToday: false };
  }

  const list = rows ?? [];
  let deliveredToday = false;
  for (const r of list) {
    if ((r.unlock_at as string) >= todayStartIso) {
      deliveredToday = true;
      break;
    }
  }
  return {
    capReached: list.length >= curatedPerWeek,
    deliveredToday,
  };
}
