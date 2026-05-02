// ============================================================
// observability.ts — slice 9 read-only queries powering the
// /dashboard/journey/health board, per-item stats sidebar,
// per-user inspector, and per-group aggregate.
//
// All functions are server-only and use the service-role admin
// client (admin-gated pages call them; RLS-bypass is fine since
// every caller already passes through requireAdmin()).
// ============================================================

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import type { CronJobName } from "./cron-log";

// ------------------------------------------------------------
// Per-item stats — drives the catalog editor sidebar AND the
// compact pills on the items list.
// ------------------------------------------------------------

export interface ItemLiveStats {
  /** Pending pushes still in queue (consumed_at IS NULL). */
  queued: number;
  /** Distinct users this item has been delivered to. */
  delivered: number;
  /** Among delivered, how many have a journey_item_completions row. */
  completed: number;
  /** Among delivered, how many have skipped_at stamped on the
   *  scheduled row. (Mutually exclusive with completed in practice
   *  because the cadence engine doesn't auto-skip a row that has
   *  responded_at, and completion implies engagement.) */
  skipped: number;
  /** Average days from unlock_at → first user response. NULL when
   *  there's no responded scheduled row yet. */
  avgDaysToFirstResponse: number | null;
}

export async function getItemLiveStats(
  itemId: string,
): Promise<ItemLiveStats> {
  const empty: ItemLiveStats = {
    queued: 0,
    delivered: 0,
    completed: 0,
    skipped: 0,
    avgDaysToFirstResponse: null,
  };
  const admin = createServiceRoleClient();
  if (!admin || !itemId) return empty;

  const [pendingRes, deliveredRes, scheduledRes] = await Promise.all([
    admin
      .from("journey_pending_pushes")
      .select("id", { head: true, count: "exact" })
      .eq("item_id", itemId)
      .is("consumed_at", null),
    admin
      .from("journey_user_delivered_items")
      .select("user_id", { head: true, count: "exact" })
      .eq("item_id", itemId),
    admin
      .from("journey_scheduled_items")
      .select("id, unlock_at, responded_at, skipped_at")
      .eq("item_id", itemId),
  ]);

  const queued = pendingRes.count ?? 0;
  const delivered = deliveredRes.count ?? 0;

  const scheduled = (scheduledRes.data ?? []) as Array<{
    id: string;
    unlock_at: string;
    responded_at: string | null;
    skipped_at: string | null;
  }>;
  const scheduledIds = scheduled.map((s) => s.id);
  let completed = 0;
  if (scheduledIds.length > 0) {
    const { count } = await admin
      .from("journey_item_completions")
      .select("scheduled_item_id", { head: true, count: "exact" })
      .in("scheduled_item_id", scheduledIds);
    completed = count ?? 0;
  }

  let skipped = 0;
  let totalRespondedDays = 0;
  let respondedCount = 0;
  for (const s of scheduled) {
    if (s.skipped_at) skipped++;
    if (s.responded_at) {
      const ms =
        new Date(s.responded_at).getTime() - new Date(s.unlock_at).getTime();
      if (Number.isFinite(ms) && ms >= 0) {
        totalRespondedDays += ms / 86_400_000;
        respondedCount++;
      }
    }
  }

  return {
    queued,
    delivered,
    completed,
    skipped,
    avgDaysToFirstResponse:
      respondedCount > 0
        ? Math.round((totalRespondedDays / respondedCount) * 10) / 10
        : null,
  };
}

/**
 * Batch variant — used by the items list to avoid N+1 round trips.
 * Returns a Map keyed by item_id with the full stats per item.
 */
export async function getItemLiveStatsBatch(
  itemIds: string[],
): Promise<Map<string, ItemLiveStats>> {
  const out = new Map<string, ItemLiveStats>();
  if (itemIds.length === 0) return out;
  const admin = createServiceRoleClient();
  if (!admin) return out;

  // Initialise a zero entry for every requested id so callers can
  // safely .get() without null-checks.
  for (const id of itemIds) {
    out.set(id, {
      queued: 0,
      delivered: 0,
      completed: 0,
      skipped: 0,
      avgDaysToFirstResponse: null,
    });
  }

  const [pendingRes, deliveredRes, scheduledRes] = await Promise.all([
    admin
      .from("journey_pending_pushes")
      .select("item_id")
      .in("item_id", itemIds)
      .is("consumed_at", null),
    admin
      .from("journey_user_delivered_items")
      .select("item_id")
      .in("item_id", itemIds),
    admin
      .from("journey_scheduled_items")
      .select("id, item_id, unlock_at, responded_at, skipped_at")
      .in("item_id", itemIds),
  ]);

  for (const r of (pendingRes.data ?? []) as Array<{ item_id: string }>) {
    const slot = out.get(r.item_id);
    if (slot) slot.queued++;
  }
  for (const r of (deliveredRes.data ?? []) as Array<{ item_id: string }>) {
    const slot = out.get(r.item_id);
    if (slot) slot.delivered++;
  }

  const scheduled = (scheduledRes.data ?? []) as Array<{
    id: string;
    item_id: string;
    unlock_at: string;
    responded_at: string | null;
    skipped_at: string | null;
  }>;
  const scheduledIds = scheduled.map((s) => s.id);
  let completedSet = new Set<string>();
  if (scheduledIds.length > 0) {
    const { data: completions } = await admin
      .from("journey_item_completions")
      .select("scheduled_item_id")
      .in("scheduled_item_id", scheduledIds);
    completedSet = new Set(
      ((completions ?? []) as Array<{ scheduled_item_id: string }>).map(
        (r) => r.scheduled_item_id,
      ),
    );
  }
  // Walk scheduled rows once, accumulating per-item.
  const respondedByItem = new Map<
    string,
    { totalDays: number; count: number }
  >();
  for (const s of scheduled) {
    const slot = out.get(s.item_id);
    if (!slot) continue;
    if (s.skipped_at) slot.skipped++;
    if (completedSet.has(s.id)) slot.completed++;
    if (s.responded_at) {
      const ms =
        new Date(s.responded_at).getTime() - new Date(s.unlock_at).getTime();
      if (Number.isFinite(ms) && ms >= 0) {
        const acc = respondedByItem.get(s.item_id) ?? { totalDays: 0, count: 0 };
        acc.totalDays += ms / 86_400_000;
        acc.count++;
        respondedByItem.set(s.item_id, acc);
      }
    }
  }
  for (const [itemId, acc] of respondedByItem) {
    const slot = out.get(itemId);
    if (slot && acc.count > 0) {
      slot.avgDaysToFirstResponse =
        Math.round((acc.totalDays / acc.count) * 10) / 10;
    }
  }

  return out;
}

// ------------------------------------------------------------
// Per-user live stats — drives the per-user inspector queue
// snapshot, engagement bundle, recent skips.
// ------------------------------------------------------------

export interface PendingPushSnapshot {
  id: string;
  item_id: string;
  item_title_he: string | null;
  reason_note: string | null;
  pushed_by: string | null;
  pushed_by_label: string | null;
  group_id: string | null;
  created_at: string;
  age_days: number;
}

export interface UpcomingScheduledSnapshot {
  id: string;
  item_id: string;
  item_title_he: string | null;
  unlock_at: string;
  source: string | null;
}

export interface DeliveredSnapshot {
  scheduled_item_id: string;
  item_id: string;
  item_title_he: string | null;
  unlock_at: string;
  responded_at: string | null;
  skipped_at: string | null;
  completed_at: string | null;
  source: string | null;
}

export interface UserLiveStats {
  pendingPushes: PendingPushSnapshot[];
  upcoming: UpcomingScheduledSnapshot[];
  recentDelivered: DeliveredSnapshot[];
  recentSkipped: DeliveredSnapshot[];
  lastResponseAt: string | null;
  lastChannelMessageAt: string | null;
}

export async function getUserLiveStats(
  userId: string,
): Promise<UserLiveStats> {
  const empty: UserLiveStats = {
    pendingPushes: [],
    upcoming: [],
    recentDelivered: [],
    recentSkipped: [],
    lastResponseAt: null,
    lastChannelMessageAt: null,
  };
  const admin = createServiceRoleClient();
  if (!admin || !userId) return empty;

  // Resolve cadence assignment id (may be NULL for users that haven't
  // taken the assessment yet; engagement still works for the legacy
  // couple-owned timeline downstream).
  const { data: cadenceAssignRow } = await admin
    .from("journey_assignments")
    .select("id")
    .eq("user_id", userId)
    .eq("source_kind", "cadence")
    .eq("is_active", true)
    .maybeSingle();
  const cadenceAssignId = (cadenceAssignRow?.id as string | null) ?? null;

  const nowMs = Date.now();

  // Pending pushes (with item title + pusher label).
  const { data: pendingRows } = await admin
    .from("journey_pending_pushes")
    .select("id, item_id, pushed_by, group_id, reason_note, created_at")
    .eq("recipient_user_id", userId)
    .is("consumed_at", null)
    .order("created_at", { ascending: true })
    .limit(20);
  const pendingArr = (pendingRows ?? []) as Array<{
    id: string;
    item_id: string;
    pushed_by: string | null;
    group_id: string | null;
    reason_note: string | null;
    created_at: string;
  }>;

  const pendingItemIds = Array.from(new Set(pendingArr.map((r) => r.item_id)));
  const pusherIds = Array.from(
    new Set(pendingArr.map((r) => r.pushed_by).filter((x): x is string => !!x)),
  );

  // Scheduled-items snapshots (upcoming + recent delivered/skipped).
  let scheduledRows: Array<{
    id: string;
    item_id: string;
    unlock_at: string;
    responded_at: string | null;
    skipped_at: string | null;
    source: string | null;
  }> = [];
  if (cadenceAssignId) {
    const { data } = await admin
      .from("journey_scheduled_items")
      .select("id, item_id, unlock_at, responded_at, skipped_at, source")
      .eq("assignment_id", cadenceAssignId)
      .order("unlock_at", { ascending: false })
      .limit(50);
    scheduledRows = (data ?? []) as typeof scheduledRows;
  }

  const scheduledItemIds = Array.from(
    new Set(scheduledRows.map((s) => s.item_id)),
  );
  const allItemIds = Array.from(
    new Set([...pendingItemIds, ...scheduledItemIds]),
  );

  // Hydrate item titles + pusher labels in parallel.
  const [itemsRes, pushersRes, completionsRes, lastRespRes, lastChanRes] =
    await Promise.all([
      allItemIds.length > 0
        ? admin
            .from("journey_items")
            .select("id, title_he")
            .in("id", allItemIds)
        : Promise.resolve({ data: [] as Array<{ id: string; title_he: string }> }),
      pusherIds.length > 0
        ? admin
            .from("admin_users_overview")
            .select("user_id, email")
            .in("user_id", pusherIds)
        : Promise.resolve({
            data: [] as Array<{ user_id: string; email: string | null }>,
          }),
      scheduledRows.length > 0
        ? admin
            .from("journey_item_completions")
            .select("scheduled_item_id, completed_at")
            .in(
              "scheduled_item_id",
              scheduledRows.map((s) => s.id),
            )
        : Promise.resolve({
            data: [] as Array<{
              scheduled_item_id: string;
              completed_at: string;
            }>,
          }),
      admin
        .from("journey_messages")
        .select("created_at")
        .eq("author_user_id", userId)
        .eq("author_kind", "user")
        .not("scheduled_item_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("journey_messages")
        .select("created_at")
        .eq("author_user_id", userId)
        .eq("author_kind", "user")
        .not("channel_user_id", "is", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  const itemTitleById = new Map(
    ((itemsRes.data ?? []) as Array<{ id: string; title_he: string }>).map(
      (i) => [i.id, i.title_he],
    ),
  );
  const pusherLabelById = new Map(
    ((pushersRes.data ?? []) as Array<{
      user_id: string;
      email: string | null;
    }>).map((p) => [p.user_id, p.email]),
  );
  const completionByScheduled = new Map(
    ((completionsRes.data ?? []) as Array<{
      scheduled_item_id: string;
      completed_at: string;
    }>).map((c) => [c.scheduled_item_id, c.completed_at]),
  );

  const pendingPushes: PendingPushSnapshot[] = pendingArr.map((p) => ({
    id: p.id,
    item_id: p.item_id,
    item_title_he: itemTitleById.get(p.item_id) ?? null,
    reason_note: p.reason_note,
    pushed_by: p.pushed_by,
    pushed_by_label: p.pushed_by ? pusherLabelById.get(p.pushed_by) ?? null : null,
    group_id: p.group_id,
    created_at: p.created_at,
    age_days: Math.max(
      0,
      Math.round((nowMs - new Date(p.created_at).getTime()) / 86_400_000),
    ),
  }));

  const upcoming: UpcomingScheduledSnapshot[] = scheduledRows
    .filter((s) => new Date(s.unlock_at).getTime() > nowMs)
    .slice(0, 10)
    .map((s) => ({
      id: s.id,
      item_id: s.item_id,
      item_title_he: itemTitleById.get(s.item_id) ?? null,
      unlock_at: s.unlock_at,
      source: s.source,
    }));

  const deliveredRows = scheduledRows.filter(
    (s) => new Date(s.unlock_at).getTime() <= nowMs,
  );
  const recentDelivered: DeliveredSnapshot[] = deliveredRows
    .slice(0, 5)
    .map((s) => ({
      scheduled_item_id: s.id,
      item_id: s.item_id,
      item_title_he: itemTitleById.get(s.item_id) ?? null,
      unlock_at: s.unlock_at,
      responded_at: s.responded_at,
      skipped_at: s.skipped_at,
      completed_at: completionByScheduled.get(s.id) ?? null,
      source: s.source,
    }));

  const recentSkipped: DeliveredSnapshot[] = deliveredRows
    .filter((s) => !!s.skipped_at)
    .slice(0, 10)
    .map((s) => ({
      scheduled_item_id: s.id,
      item_id: s.item_id,
      item_title_he: itemTitleById.get(s.item_id) ?? null,
      unlock_at: s.unlock_at,
      responded_at: s.responded_at,
      skipped_at: s.skipped_at,
      completed_at: completionByScheduled.get(s.id) ?? null,
      source: s.source,
    }));

  return {
    pendingPushes,
    upcoming,
    recentDelivered,
    recentSkipped,
    lastResponseAt:
      (lastRespRes.data?.created_at as string | undefined) ?? null,
    lastChannelMessageAt:
      (lastChanRes.data?.created_at as string | undefined) ?? null,
  };
}

// ------------------------------------------------------------
// Cron health snapshot — last 24h per job.
// ------------------------------------------------------------

export interface CronHealthRow {
  job_name: CronJobName;
  /** Seconds we expect between successful runs. Drives the "stale"
   *  pill: lastRunAt > 1.5 × expected → stale. */
  expectedIntervalSec: number;
  lastRunAt: string | null;
  lastRunOk: boolean | null;
  lastRunRows: number;
  lastRunError: string | null;
  /** Sum across the last 24h. */
  rowsProcessed24h: number;
  failures24h: number;
  isStale: boolean;
}

const EXPECTED_INTERVAL_SEC: Record<CronJobName, number> = {
  cadence_advance: 15 * 60,        // every 15 min
  notify_unlocks: 60 * 60,         // hourly at :15
  grace_watcher: 60 * 60,          // hourly at :00
  scores_recompute: 24 * 60 * 60,  // daily at 04:00
  reminders: 24 * 60 * 60,         // daily at 08:00
};

export async function getCronHealthSnapshot(): Promise<CronHealthRow[]> {
  const admin = createServiceRoleClient();
  const jobs: CronJobName[] = [
    "cadence_advance",
    "notify_unlocks",
    "grace_watcher",
    "scores_recompute",
    "reminders",
  ];
  if (!admin) {
    return jobs.map((j) => ({
      job_name: j,
      expectedIntervalSec: EXPECTED_INTERVAL_SEC[j],
      lastRunAt: null,
      lastRunOk: null,
      lastRunRows: 0,
      lastRunError: null,
      rowsProcessed24h: 0,
      failures24h: 0,
      isStale: true,
    }));
  }

  const since = new Date(Date.now() - 24 * 3600_000).toISOString();
  const { data: rows } = await admin
    .from("journey_cron_runs")
    .select("job_name, finished_at, ok, rows_processed, error_text")
    .gte("finished_at", since)
    .order("finished_at", { ascending: false });

  const buckets = new Map<
    CronJobName,
    {
      runs: Array<{
        finished_at: string;
        ok: boolean;
        rows_processed: number;
        error_text: string | null;
      }>;
    }
  >();
  for (const j of jobs) buckets.set(j, { runs: [] });
  for (const r of (rows ?? []) as Array<{
    job_name: string;
    finished_at: string;
    ok: boolean;
    rows_processed: number;
    error_text: string | null;
  }>) {
    const slot = buckets.get(r.job_name as CronJobName);
    if (!slot) continue;
    slot.runs.push({
      finished_at: r.finished_at,
      ok: r.ok,
      rows_processed: r.rows_processed,
      error_text: r.error_text,
    });
  }

  const nowMs = Date.now();
  return jobs.map((j) => {
    const slot = buckets.get(j)!;
    const last = slot.runs[0] ?? null;
    const expected = EXPECTED_INTERVAL_SEC[j];
    const ageSec = last
      ? (nowMs - new Date(last.finished_at).getTime()) / 1000
      : Infinity;
    const isStale = ageSec > expected * 1.5;
    const rowsProcessed24h = slot.runs.reduce(
      (acc, r) => acc + (r.rows_processed ?? 0),
      0,
    );
    const failures24h = slot.runs.filter((r) => !r.ok).length;
    return {
      job_name: j,
      expectedIntervalSec: expected,
      lastRunAt: last?.finished_at ?? null,
      lastRunOk: last?.ok ?? null,
      lastRunRows: last?.rows_processed ?? 0,
      lastRunError: last?.error_text ?? null,
      rowsProcessed24h,
      failures24h,
      isStale,
    };
  });
}

// ------------------------------------------------------------
// Stuck users — empty-queue alert source.
// ------------------------------------------------------------

export interface StuckUser {
  user_id: string;
  email: string | null;
  full_name: string | null;
  last_delivery_at: string | null;
  days_since_delivery: number;
  pending_pushes: number;
}

/**
 * Users who:
 *   - are journey-entitled (have an active cadence assignment)
 *   - have been quiet for >= minIdleDays (no cadence delivery)
 *   - have no pending pushes (so the cadence engine SHOULD be picking
 *     for them, but isn't — usually a "no candidates" or eligibility
 *     issue).
 *
 * The health board surfaces this list so admins can investigate.
 */
export async function getStuckUsers(
  minIdleDays = 7,
  limit = 50,
): Promise<StuckUser[]> {
  const admin = createServiceRoleClient();
  if (!admin) return [];

  // Step 1: every user with an active cadence assignment.
  const { data: assignRows } = await admin
    .from("journey_assignments")
    .select("user_id")
    .eq("source_kind", "cadence")
    .eq("is_active", true)
    .not("user_id", "is", null);
  const userIds = Array.from(
    new Set(((assignRows ?? []) as Array<{ user_id: string }>).map((r) => r.user_id)),
  );
  if (userIds.length === 0) return [];

  // Step 2: latest cadence delivery per user.
  const { data: schedRows } = await admin
    .from("journey_scheduled_items")
    .select("unlock_at, journey_assignments!inner(user_id, source_kind)")
    .eq("journey_assignments.source_kind", "cadence")
    .in("journey_assignments.user_id", userIds)
    .order("unlock_at", { ascending: false });

  const lastByUser = new Map<string, string>();
  for (const r of (schedRows ?? []) as Array<{
    unlock_at: string;
    journey_assignments:
      | { user_id: string }
      | Array<{ user_id: string }>
      | null;
  }>) {
    const a = r.journey_assignments;
    const list = Array.isArray(a) ? a : a ? [a] : [];
    for (const item of list) {
      if (!item?.user_id) continue;
      if (!lastByUser.has(item.user_id)) {
        // First (== latest) row for this user.
        lastByUser.set(item.user_id, r.unlock_at);
      }
    }
  }

  // Step 3: pending push counts per user.
  const { data: pendingRows } = await admin
    .from("journey_pending_pushes")
    .select("recipient_user_id")
    .in("recipient_user_id", userIds)
    .is("consumed_at", null);
  const pendingByUser = new Map<string, number>();
  for (const r of (pendingRows ?? []) as Array<{ recipient_user_id: string }>) {
    pendingByUser.set(
      r.recipient_user_id,
      (pendingByUser.get(r.recipient_user_id) ?? 0) + 1,
    );
  }

  const cutoffMs = Date.now() - minIdleDays * 86_400_000;
  const stuckIds: string[] = [];
  const ageByUser = new Map<string, number>();
  const lastByUser2 = new Map<string, string | null>();
  for (const uid of userIds) {
    const last = lastByUser.get(uid);
    const lastMs = last ? new Date(last).getTime() : 0;
    const ageDays = last
      ? Math.round((Date.now() - lastMs) / 86_400_000)
      : 999;
    if ((!last || lastMs < cutoffMs) && (pendingByUser.get(uid) ?? 0) === 0) {
      stuckIds.push(uid);
      ageByUser.set(uid, ageDays);
      lastByUser2.set(uid, last ?? null);
    }
  }
  if (stuckIds.length === 0) return [];

  const top = stuckIds.slice(0, limit);
  const [profilesRes, emailsRes] = await Promise.all([
    admin.from("profiles").select("id, full_name").in("id", top),
    admin
      .from("admin_users_overview")
      .select("user_id, email")
      .in("user_id", top),
  ]);
  const fullNameById = new Map(
    ((profilesRes.data ?? []) as Array<{ id: string; full_name: string | null }>).map(
      (p) => [p.id, p.full_name],
    ),
  );
  const emailById = new Map(
    ((emailsRes.data ?? []) as Array<{ user_id: string; email: string | null }>).map(
      (u) => [u.user_id, u.email],
    ),
  );

  return top
    .map<StuckUser>((uid) => ({
      user_id: uid,
      email: emailById.get(uid) ?? null,
      full_name: fullNameById.get(uid) ?? null,
      last_delivery_at: lastByUser2.get(uid) ?? null,
      days_since_delivery: ageByUser.get(uid) ?? 999,
      pending_pushes: pendingByUser.get(uid) ?? 0,
    }))
    .sort((a, b) => b.days_since_delivery - a.days_since_delivery);
}

// ------------------------------------------------------------
// Pending pushes summary (health board).
// ------------------------------------------------------------

export interface PendingPushesSummary {
  totalUnconsumed: number;
  oldestAgeDays: number | null;
  byKind: { user: number; couple: number; group: number };
}

export async function getPendingPushesSummary(): Promise<PendingPushesSummary> {
  const empty: PendingPushesSummary = {
    totalUnconsumed: 0,
    oldestAgeDays: null,
    byKind: { user: 0, couple: 0, group: 0 },
  };
  const admin = createServiceRoleClient();
  if (!admin) return empty;

  const { data: rows } = await admin
    .from("journey_pending_pushes")
    .select("created_at, group_id, recipient_user_id")
    .is("consumed_at", null)
    .order("created_at", { ascending: true });

  const list = (rows ?? []) as Array<{
    created_at: string;
    group_id: string | null;
    recipient_user_id: string;
  }>;
  if (list.length === 0) return empty;

  // Heuristic for kind: the pending_pushes row doesn't store the
  // original recipient kind, so we infer:
  //   - group_id set      → group push (counted once per group push,
  //                          not per resulting fan-out row, by
  //                          de-duplicating on group_id+created_at)
  //   - group_id null     → user OR couple push. We can't distinguish
  //                          definitively without joining couple_members
  //                          (a pair of rows with the same item_id +
  //                          created_at + null group is a couple push).
  //                          For the health board summary, "by kind"
  //                          counts ROWS not original-pushes — clearer
  //                          than guessing.
  let groupRows = 0;
  let userOrCoupleRows = 0;
  for (const r of list) {
    if (r.group_id) groupRows++;
    else userOrCoupleRows++;
  }

  const oldestMs = Date.now() - new Date(list[0].created_at).getTime();
  return {
    totalUnconsumed: list.length,
    oldestAgeDays: Math.max(0, Math.round(oldestMs / 86_400_000)),
    byKind: {
      // Rough split — we surface the row count, not the push count.
      // The health board labels it explicitly so admins know.
      user: userOrCoupleRows,
      couple: 0,
      group: groupRows,
    },
  };
}
