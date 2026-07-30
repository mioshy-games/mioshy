// ============================================================
// lib/journey-content/cycle-engine.ts
//
// The I/O half of the five-track cycle model (docs/journey-five-track-model-spec.md).
// The selection rules themselves live in cycle-selection.ts and are pure.
//
//   previewCycleForUser  — what WOULD open. No writes. Used by the admin, and
//                          by the retroactive backfill so it can be reviewed
//                          before it runs.
//   openCycleForUser     — open the next cycle (five items, one per category,
//                          flexible fill) and record them in the global
//                          delivered ledger.
//   completeCycleItem    — §9.1 one partner marking it is enough; when all five
//                          are done the cycle closes and the next opens at once.
//   advanceDueCycles     — cron half: cycles whose month elapsed roll over.
//
// Eligibility is delegated to isCadenceEligible (cadence-engine.ts) rather than
// re-derived. That is what keeps a paused or in-grace customer's content
// WAITING instead of burning: a paused user is simply not eligible, so no cycle
// opens and no clock starts until they come back.
//
// journey_user_delivered_items stays the single "already consumed" ledger. Its
// PK (user_id, item_id) is the anti-repeat lock, so an item can never open
// twice for the same user even if two cycles are opened concurrently.
// ============================================================

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { isCadenceEligible } from "./cadence-engine";
import {
  selectCycleItems,
  type CandidateItem,
  type CycleSlot,
} from "./cycle-selection";

/** A cycle runs for one month unless all five items are marked done first. */
const CYCLE_LENGTH_DAYS = 30;

export interface CyclePreview {
  ok: boolean;
  reason?: string;
  userId: string;
  /** The cycle number this would be. */
  cycleNumber: number;
  ranking: string[];
  rankingSource: string;
  slots: CycleSlot[];
  exhaustedCategoryIds: string[];
  short: boolean;
}

export interface OpenCycleResult {
  ok: boolean;
  reason?: string;
  cycleId?: string;
  cycleNumber?: number;
  itemCount?: number;
}

function addDays(from: Date, days: number): Date {
  const d = new Date(from.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// ------------------------------------------------------------
// Candidates
// ------------------------------------------------------------

/**
 * Every active item this user has NOT already been given, in any category.
 * Reads the shared delivered ledger so content consumed under the old weekly
 * engine is never re-served.
 */
export async function loadUnseenCandidates(
  userId: string,
  programId?: string,
): Promise<CandidateItem[]> {
  const admin = createServiceRoleClient();
  if (!admin) return [];

  const { data: delivered } = await admin
    .from("journey_user_delivered_items")
    .select("item_id")
    .eq("user_id", userId);
  const seen = new Set(
    ((delivered ?? []) as Array<{ item_id: string }>).map((r) => r.item_id),
  );

  let q = admin
    .from("journey_items")
    .select("id, category_id, sort_order, is_active, journey_categories!inner(id, is_active, program_id)")
    .eq("is_active", true)
    .eq("kind", "content")
    .eq("journey_categories.is_active", true);
  if (programId) q = q.eq("journey_categories.program_id", programId);

  const { data, error } = await q;
  if (error || !data) return [];

  return (data as Array<{ id: string; category_id: string; sort_order: number | null }>)
    .filter((r) => !seen.has(r.id))
    .map((r) => ({
      id: r.id,
      categoryId: r.category_id,
      sortOrder: r.sort_order ?? 0,
    }));
}

async function loadRanking(
  userId: string,
): Promise<{ ranking: string[]; source: string } | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;
  const { data } = await admin
    .from("journey_user_priorities")
    .select("ranking, source")
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as { ranking?: string[]; source?: string } | null;
  if (!Array.isArray(row?.ranking) || row.ranking.length === 0) return null;
  return { ranking: row.ranking, source: row.source ?? "assessment" };
}

async function nextCycleNumber(userId: string): Promise<number> {
  const admin = createServiceRoleClient();
  if (!admin) return 1;
  const { data } = await admin
    .from("journey_cycles")
    .select("cycle_number")
    .eq("user_id", userId)
    .order("cycle_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as { cycle_number?: number } | null)?.cycle_number ?? 0) + 1;
}

// ------------------------------------------------------------
// Preview
// ------------------------------------------------------------

/**
 * What would open for this user right now — without writing anything.
 *
 * `checkEligibility: false` answers the hypothetical "what is waiting for them"
 * even when they are paused or in grace, which is exactly what the retroactive
 * review needs to show.
 */
export async function previewCycleForUser(
  userId: string,
  opts: { checkEligibility?: boolean } = {},
): Promise<CyclePreview> {
  const empty: CyclePreview = {
    ok: false,
    userId,
    cycleNumber: 0,
    ranking: [],
    rankingSource: "",
    slots: [],
    exhaustedCategoryIds: [],
    short: true,
  };

  if (opts.checkEligibility !== false) {
    const elig = await isCadenceEligible(userId);
    if (!elig.eligible) return { ...empty, reason: elig.reason };
  }

  const ranked = await loadRanking(userId);
  if (!ranked) return { ...empty, reason: "no_priorities" };

  const candidates = await loadUnseenCandidates(userId);
  const selection = selectCycleItems(ranked.ranking, candidates);

  return {
    ok: selection.slots.length > 0,
    reason: selection.slots.length === 0 ? "no_content_left" : undefined,
    userId,
    cycleNumber: await nextCycleNumber(userId),
    ranking: ranked.ranking,
    rankingSource: ranked.source,
    slots: selection.slots,
    exhaustedCategoryIds: selection.exhaustedCategoryIds,
    short: selection.short,
  };
}

// ------------------------------------------------------------
// Open
// ------------------------------------------------------------

/**
 * Open the next cycle. Idempotent in the sense that a user may have only ONE
 * open cycle (enforced by a partial unique index), so a concurrent second call
 * loses the race and returns `already_open` rather than duplicating.
 */
export async function openCycleForUser(
  userId: string,
  opts: { force?: boolean } = {},
): Promise<OpenCycleResult> {
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, reason: "no_admin_client" };

  // A paused / in-grace / unentitled user must not have a cycle opened: the
  // month clock would start while they are away and the content would burn.
  if (!opts.force) {
    const elig = await isCadenceEligible(userId);
    if (!elig.eligible) return { ok: false, reason: elig.reason };
  }

  const { data: open } = await admin
    .from("journey_cycles")
    .select("id")
    .eq("user_id", userId)
    .is("closed_at", null)
    .maybeSingle();
  if (open) return { ok: false, reason: "already_open" };

  const preview = await previewCycleForUser(userId, { checkEligibility: false });
  if (!preview.slots.length) return { ok: false, reason: preview.reason ?? "no_content_left" };

  const now = new Date();
  const { data: cycle, error: cycleErr } = await admin
    .from("journey_cycles")
    .insert({
      user_id: userId,
      cycle_number: preview.cycleNumber,
      opened_at: now.toISOString(),
      planned_next_open_at: addDays(now, CYCLE_LENGTH_DAYS).toISOString(),
      ranking_snapshot: preview.ranking,
      ranking_source: preview.rankingSource,
    })
    .select("id")
    .maybeSingle();
  if (cycleErr || !cycle) {
    // 23505 = the partial unique index caught a concurrent open.
    return { ok: false, reason: cycleErr?.code === "23505" ? "already_open" : cycleErr?.message };
  }
  const cycleId = (cycle as { id: string }).id;

  // Claim the items in the shared ledger FIRST — the PK is the lock, so a
  // parallel opener cannot hand out the same item twice.
  const { error: ledgerErr } = await admin.from("journey_user_delivered_items").insert(
    preview.slots.map((s) => ({
      user_id: userId,
      item_id: s.itemId,
      source: "cadence",
      delivered_at: now.toISOString(),
    })),
  );
  if (ledgerErr) {
    await admin.from("journey_cycles").delete().eq("id", cycleId);
    return { ok: false, reason: `ledger_insert_failed: ${ledgerErr.message}` };
  }

  const { error: itemsErr } = await admin.from("journey_cycle_items").insert(
    preview.slots.map((s) => ({
      cycle_id: cycleId,
      item_id: s.itemId,
      category_id: s.categoryId,
      rank_position: s.rankPosition,
      is_substitute: s.isSubstitute,
      intended_category_id: s.intendedCategoryId,
    })),
  );
  if (itemsErr) {
    await admin.from("journey_cycles").delete().eq("id", cycleId);
    return { ok: false, reason: `items_insert_failed: ${itemsErr.message}` };
  }

  console.log("[cycle-engine] opened cycle", {
    user_id8: userId.slice(0, 8),
    cycle: preview.cycleNumber,
    items: preview.slots.length,
    substitutes: preview.slots.filter((s) => s.isSubstitute).length,
    ranking_source: preview.rankingSource,
  });

  return {
    ok: true,
    cycleId,
    cycleNumber: preview.cycleNumber,
    itemCount: preview.slots.length,
  };
}

// ------------------------------------------------------------
// Complete
// ------------------------------------------------------------

/**
 * Mark one item done. §9.1: one partner is enough, so the first mark wins and a
 * second is a no-op. When the last open item is marked, the cycle closes and
 * the next opens immediately (§3).
 */
export async function completeCycleItem(
  cycleItemId: string,
  byUserId: string,
): Promise<{ ok: boolean; reason?: string; cycleClosed: boolean; nextCycleOpened: boolean }> {
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, reason: "no_admin_client", cycleClosed: false, nextCycleOpened: false };

  const { data: row } = await admin
    .from("journey_cycle_items")
    .select("id, cycle_id, completed_at, journey_cycles!inner(user_id, closed_at)")
    .eq("id", cycleItemId)
    .maybeSingle();
  if (!row) return { ok: false, reason: "not_found", cycleClosed: false, nextCycleOpened: false };

  const typed = row as unknown as {
    cycle_id: string;
    completed_at: string | null;
    journey_cycles: { user_id: string; closed_at: string | null };
  };
  const ownerId = typed.journey_cycles.user_id;

  if (!typed.completed_at) {
    // Guard on completed_at so a second partner's tap cannot overwrite who was
    // first (and cannot resurrect a closed cycle).
    await admin
      .from("journey_cycle_items")
      .update({ completed_at: new Date().toISOString(), completed_by: byUserId })
      .eq("id", cycleItemId)
      .is("completed_at", null);
  }

  const { count: stillOpen } = await admin
    .from("journey_cycle_items")
    .select("id", { count: "exact", head: true })
    .eq("cycle_id", typed.cycle_id)
    .is("completed_at", null);

  if ((stillOpen ?? 0) > 0) {
    return { ok: true, cycleClosed: false, nextCycleOpened: false };
  }

  await admin
    .from("journey_cycles")
    .update({ closed_at: new Date().toISOString(), close_reason: "all_completed", updated_at: new Date().toISOString() })
    .eq("id", typed.cycle_id)
    .is("closed_at", null);

  const next = await openCycleForUser(ownerId);
  return { ok: true, cycleClosed: true, nextCycleOpened: next.ok };
}

/**
 * Admin intervention (§5): undo a completion mark.
 *
 * Only meaningful while the cycle is still open — once it closed, the next
 * cycle already opened and un-marking an item would leave the user with two
 * open cycles, which the partial unique index forbids anyway. We therefore
 * refuse rather than half-apply.
 */
export async function resetCycleItemCompletion(
  cycleItemId: string,
): Promise<{ ok: boolean; reason?: string }> {
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, reason: "no_admin_client" };

  const { data: row } = await admin
    .from("journey_cycle_items")
    .select("id, completed_at, journey_cycles!inner(closed_at)")
    .eq("id", cycleItemId)
    .maybeSingle();
  if (!row) return { ok: false, reason: "not_found" };

  const typed = row as unknown as {
    completed_at: string | null;
    journey_cycles: { closed_at: string | null };
  };
  if (typed.journey_cycles.closed_at) return { ok: false, reason: "cycle_already_closed" };
  if (!typed.completed_at) return { ok: true }; // already un-marked

  const { error } = await admin
    .from("journey_cycle_items")
    .update({ completed_at: null, completed_by: null })
    .eq("id", cycleItemId);
  if (error) return { ok: false, reason: error.message };

  console.log("[cycle-engine] completion reset by admin", { cycle_item_id: cycleItemId });
  return { ok: true };
}

// ------------------------------------------------------------
// Cron
// ------------------------------------------------------------

/**
 * Roll over every cycle whose month has elapsed. Unfinished items are NOT
 * revoked — the cycle simply closes and the next opens alongside it (§3:
 * "nothing gets closed off").
 */
export async function advanceDueCycles(
  limit = 100,
): Promise<{ scanned: number; rolled: number; opened: number; skipped: Array<{ userId: string; reason: string }> }> {
  const admin = createServiceRoleClient();
  if (!admin) return { scanned: 0, rolled: 0, opened: 0, skipped: [] };

  const { data: due } = await admin
    .from("journey_cycles")
    .select("id, user_id, cycle_number")
    .is("closed_at", null)
    .lte("planned_next_open_at", new Date().toISOString())
    .order("planned_next_open_at", { ascending: true })
    .limit(limit);

  const rows = (due ?? []) as Array<{ id: string; user_id: string }>;
  const skipped: Array<{ userId: string; reason: string }> = [];
  let rolled = 0;
  let opened = 0;

  for (const c of rows) {
    await admin
      .from("journey_cycles")
      .update({ closed_at: new Date().toISOString(), close_reason: "month_elapsed", updated_at: new Date().toISOString() })
      .eq("id", c.id)
      .is("closed_at", null);
    rolled++;

    const next = await openCycleForUser(c.user_id);
    if (next.ok) opened++;
    else skipped.push({ userId: c.user_id, reason: next.reason ?? "unknown" });
  }

  return { scanned: rows.length, rolled, opened, skipped };
}
