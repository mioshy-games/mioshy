import "server-only";

/**
 * lib/dashboard/clinician-queue.ts
 *
 * Phase 4 - the clinician's daily work queue.
 *
 * Reads many existing tables and produces ONE shape per couple, with
 * the workflow signals the clinician needs to triage:
 *   - pendingReplies: user responses with no clinician_status set
 *   - concerningCount: responses or messages flagged as 'concerning'
 *     OR auto-tagged 'crisis_keyword'
 *   - stuckCount: items 'available' for >7 days with no user response
 *   - unreadMessages: journey_user_messages with no clinician_status
 *   - lastUserActivityAt: most recent response or message timestamp
 *
 * The page derives a primary `signal` per row from these counts so
 * the CRM can group rows into Today/Stuck/Urgent/New tabs without
 * re-running query work in the UI.
 *
 * Authorization: callers must already have passed requireExpert().
 * This module assumes service-role access; it does not re-enforce
 * RLS. Filtering by expert_id (non-admin) is done by selecting a
 * scoped list of couple_ids upstream and passing it into here.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";

export type ClinicianSignal =
  | "urgent" // crisis keyword or concerning status
  | "stuck" // user has open items but no response for >7 days
  | "pending_reply" // user wrote, clinician hasn't replied
  | "new" // couple created in last 7 days with no activity yet
  | "active" // recent activity, nothing on fire
  | "idle"; // nothing to act on right now

export interface ClinicianQueueRow {
  coupleId: string;
  displayName: string | null;
  pairCode: string | null;
  /** Identifier shown in lists when display_name is null. */
  partnerLabels: string[];
  /** Partner emails for fallback labelling. */
  members: { userId: string; email: string | null }[];
  // ── Workflow signals ─────────────────────────────────────────
  pendingReplies: number;
  concerningCount: number;
  stuckCount: number;
  unreadMessages: number;
  lastUserActivityAt: string | null;
  /** Total scheduled items + completed (for context, not workflow). */
  scheduledItems: number;
  completedItems: number;
  /** Days since the couple was created, for the "new" bucket. */
  daysSinceCreated: number;
  /** Derived primary signal - what the row should be grouped under. */
  signal: ClinicianSignal;
}

const STUCK_DAYS = 7;
const NEW_DAYS = 7;

export async function getClinicianWorkQueue(args: {
  coupleIds: string[];
  now?: Date;
}): Promise<ClinicianQueueRow[]> {
  const admin = createServiceRoleClient();
  if (!admin) throw new Error("service role unavailable");

  const reference = (args.now ?? new Date()).getTime();
  if (args.coupleIds.length === 0) return [];

  // ── Couples + members ─────────────────────────────────────────────
  const { data: coupleRows } = await admin
    .from("couples")
    .select("id, display_name, pair_code, created_at")
    .in("id", args.coupleIds);

  const { data: memberRows } = await admin
    .from("couple_members")
    .select("couple_id, user_id, role")
    .in("couple_id", args.coupleIds);

  const userIds = Array.from(
    new Set(((memberRows ?? []) as Array<{ user_id: string }>).map((m) => m.user_id)),
  );

  const emailByUser = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: userRows } = await admin
      .from("admin_users_overview")
      .select("user_id, email")
      .in("user_id", userIds);
    for (const u of (userRows ?? []) as Array<{
      user_id: string;
      email: string | null;
    }>) {
      emailByUser.set(u.user_id, u.email);
    }
  }

  // ── Assignments → scheduled_items → completions ───────────────────
  const { data: assignRows } = await admin
    .from("journey_assignments")
    .select("id, couple_id, user_id, is_active")
    .in("couple_id", args.coupleIds);

  const couplesByAssignment = new Map<string, string>();
  const assignmentsByCouple = new Map<string, string[]>();
  for (const a of (assignRows ?? []) as Array<{
    id: string;
    couple_id: string;
    is_active: boolean;
  }>) {
    couplesByAssignment.set(a.id, a.couple_id);
    const list = assignmentsByCouple.get(a.couple_id) ?? [];
    list.push(a.id);
    assignmentsByCouple.set(a.couple_id, list);
  }

  // Also resolve assignments that target a user_id directly (solo
  // assignments) by reading user_id field. We approximate by
  // matching user_id ↔ couple member; solo journeys without a
  // couple don't surface here yet.

  const allAssignmentIds = Array.from(couplesByAssignment.keys());

  // Fetch all scheduled items + completions for the assignments above.
  type SchedRow = {
    id: string;
    assignment_id: string;
    unlock_at: string;
  };
  let schedRows: SchedRow[] = [];
  if (allAssignmentIds.length > 0) {
    const { data } = await admin
      .from("journey_scheduled_items")
      .select("id, assignment_id, unlock_at")
      .in("assignment_id", allAssignmentIds);
    schedRows = (data ?? []) as SchedRow[];
  }

  const schedIds = schedRows.map((s) => s.id);
  const completionByScheduled = new Map<string, string>(); // sched_id → completed_at
  if (schedIds.length > 0) {
    const { data: doneRows } = await admin
      .from("journey_item_completions")
      .select("scheduled_item_id, completed_at")
      .in("scheduled_item_id", schedIds);
    for (const d of (doneRows ?? []) as Array<{
      scheduled_item_id: string;
      completed_at: string;
    }>) {
      completionByScheduled.set(d.scheduled_item_id, d.completed_at);
    }
  }

  // ── Responses + messages ──────────────────────────────────────────
  type RespRow = {
    id: string;
    scheduled_item_id: string;
    user_id: string;
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
        "id, scheduled_item_id, user_id, is_private, clinician_status, clinician_reply_text, tags, created_at",
      )
      .in("scheduled_item_id", schedIds);
    respRows = (data ?? []) as RespRow[];
  }

  type MsgRow = {
    id: string;
    user_id: string;
    couple_id: string | null;
    clinician_status: "open" | "resolved" | "concerning" | null;
    tags: string[] | null;
    created_at: string;
  };
  let msgRows: MsgRow[] = [];
  if (args.coupleIds.length > 0) {
    const { data } = await admin
      .from("journey_user_messages")
      .select("id, user_id, couple_id, clinician_status, tags, created_at")
      .in("couple_id", args.coupleIds);
    msgRows = (data ?? []) as MsgRow[];
  }

  // ── Aggregate per couple ──────────────────────────────────────────
  const sched_to_couple = new Map<string, string>();
  for (const s of schedRows) {
    const cid = couplesByAssignment.get(s.assignment_id);
    if (cid) sched_to_couple.set(s.id, cid);
  }

  // Index: per-user latest response per scheduled_item - used to
  // detect "available item with no response" (stuck) without
  // double-counting revisions.
  const latestResponseByItemUser = new Map<string, RespRow>();
  for (const r of respRows) {
    const key = `${r.scheduled_item_id}:${r.user_id}`;
    const prev = latestResponseByItemUser.get(key);
    if (!prev || r.created_at > prev.created_at) {
      latestResponseByItemUser.set(key, r);
    }
  }

  type CoupleAggregate = {
    pendingReplies: number;
    concerningCount: number;
    stuckCount: number;
    unreadMessages: number;
    lastUserActivityAt: string | null;
    scheduledItems: number;
    completedItems: number;
  };
  const agg = new Map<string, CoupleAggregate>();
  const ensure = (cid: string): CoupleAggregate => {
    let a = agg.get(cid);
    if (!a) {
      a = {
        pendingReplies: 0,
        concerningCount: 0,
        stuckCount: 0,
        unreadMessages: 0,
        lastUserActivityAt: null,
        scheduledItems: 0,
        completedItems: 0,
      };
      agg.set(cid, a);
    }
    return a;
  };

  // Sum scheduled + completed per couple
  for (const s of schedRows) {
    const cid = sched_to_couple.get(s.id);
    if (!cid) continue;
    const a = ensure(cid);
    a.scheduledItems += 1;
    if (completionByScheduled.has(s.id)) a.completedItems += 1;
  }

  // Stuck: an item is available (unlocked) but the responsible user
  // has no response, AND it's been available >7 days.
  const memberSet = new Map<string, Set<string>>();
  for (const m of (memberRows ?? []) as Array<{
    couple_id: string;
    user_id: string;
  }>) {
    const set = memberSet.get(m.couple_id) ?? new Set<string>();
    set.add(m.user_id);
    memberSet.set(m.couple_id, set);
  }
  const STUCK_MS = STUCK_DAYS * 24 * 60 * 60 * 1000;
  for (const s of schedRows) {
    const cid = sched_to_couple.get(s.id);
    if (!cid) continue;
    const unlockMs = Date.parse(s.unlock_at);
    if (!Number.isFinite(unlockMs)) continue;
    if (unlockMs > reference) continue; // still locked
    if (completionByScheduled.has(s.id)) continue; // done
    if (reference - unlockMs < STUCK_MS) continue; // not stuck yet
    // No response from EITHER partner → count as stuck
    const partners = memberSet.get(cid);
    if (!partners) continue;
    let anyResponse = false;
    for (const uid of partners) {
      if (latestResponseByItemUser.has(`${s.id}:${uid}`)) {
        anyResponse = true;
        break;
      }
    }
    if (!anyResponse) ensure(cid).stuckCount += 1;
  }

  // Pending replies + concerning + last user activity
  for (const r of respRows) {
    const cid = sched_to_couple.get(r.scheduled_item_id);
    if (!cid) continue;
    const a = ensure(cid);
    if (r.clinician_status === null && !r.clinician_reply_text) {
      a.pendingReplies += 1;
    }
    if (
      r.clinician_status === "concerning" ||
      (r.tags ?? []).includes("crisis_keyword")
    ) {
      a.concerningCount += 1;
    }
    if (!a.lastUserActivityAt || r.created_at > a.lastUserActivityAt) {
      a.lastUserActivityAt = r.created_at;
    }
  }

  // Messages: unread + concerning + last activity
  for (const m of msgRows) {
    const cid = m.couple_id;
    if (!cid) continue;
    const a = ensure(cid);
    if (m.clinician_status === null) a.unreadMessages += 1;
    if (
      m.clinician_status === "concerning" ||
      (m.tags ?? []).includes("crisis_keyword")
    ) {
      a.concerningCount += 1;
    }
    if (!a.lastUserActivityAt || m.created_at > a.lastUserActivityAt) {
      a.lastUserActivityAt = m.created_at;
    }
  }

  // ── Build rows ────────────────────────────────────────────────────
  const NEW_MS = NEW_DAYS * 24 * 60 * 60 * 1000;
  const out: ClinicianQueueRow[] = [];

  for (const cid of args.coupleIds) {
    const couple = ((coupleRows ?? []) as Array<{
      id: string;
      display_name: string | null;
      pair_code: string | null;
      created_at: string;
    }>).find((c) => c.id === cid);
    if (!couple) continue;
    const a = agg.get(cid) ?? {
      pendingReplies: 0,
      concerningCount: 0,
      stuckCount: 0,
      unreadMessages: 0,
      lastUserActivityAt: null,
      scheduledItems: 0,
      completedItems: 0,
    };

    const members = ((memberRows ?? []) as Array<{
      couple_id: string;
      user_id: string;
    }>)
      .filter((m) => m.couple_id === cid)
      .map((m) => ({
        userId: m.user_id,
        email: emailByUser.get(m.user_id) ?? null,
      }));

    const partnerLabels = members.map(
      (m) => m.email ?? `User ${m.userId.slice(0, 6)}`,
    );

    const createdMs = Date.parse(couple.created_at);
    const daysSinceCreated = Number.isFinite(createdMs)
      ? Math.max(0, Math.floor((reference - createdMs) / (24 * 60 * 60 * 1000)))
      : 0;

    // Derive primary signal - first match wins.
    let signal: ClinicianSignal = "idle";
    if (a.concerningCount > 0) signal = "urgent";
    else if (a.stuckCount > 0) signal = "stuck";
    else if (a.pendingReplies > 0 || a.unreadMessages > 0)
      signal = "pending_reply";
    else if (
      reference - createdMs < NEW_MS &&
      a.lastUserActivityAt === null
    )
      signal = "new";
    else if (a.lastUserActivityAt) signal = "active";

    out.push({
      coupleId: cid,
      displayName: couple.display_name,
      pairCode: couple.pair_code,
      partnerLabels,
      members,
      pendingReplies: a.pendingReplies,
      concerningCount: a.concerningCount,
      stuckCount: a.stuckCount,
      unreadMessages: a.unreadMessages,
      lastUserActivityAt: a.lastUserActivityAt,
      scheduledItems: a.scheduledItems,
      completedItems: a.completedItems,
      daysSinceCreated,
      signal,
    });
  }

  // Sort: urgent → stuck → pending_reply → new → active → idle.
  // Within a signal, most-recent-activity first.
  const order: Record<ClinicianSignal, number> = {
    urgent: 0,
    stuck: 1,
    pending_reply: 2,
    new: 3,
    active: 4,
    idle: 5,
  };
  out.sort((x, y) => {
    const dx = order[x.signal] - order[y.signal];
    if (dx !== 0) return dx;
    return (y.lastUserActivityAt ?? "").localeCompare(
      x.lastUserActivityAt ?? "",
    );
  });

  return out;
}

/** Map signal → bilingual label. */
export function signalLabel(
  signal: ClinicianSignal,
  isHe: boolean,
): { label: string; tone: "rose" | "amber" | "violet" | "emerald" | "white" | "muted" } {
  switch (signal) {
    case "urgent":
      return { label: isHe ? "דחוף" : "Urgent", tone: "rose" };
    case "stuck":
      return { label: isHe ? "תקוע" : "Stuck", tone: "amber" };
    case "pending_reply":
      return { label: isHe ? "ממתין למענה" : "Awaiting reply", tone: "violet" };
    case "new":
      return { label: isHe ? "חדש" : "New", tone: "emerald" };
    case "active":
      return { label: isHe ? "פעיל" : "Active", tone: "white" };
    default:
      return { label: isHe ? "רגוע" : "Idle", tone: "muted" };
  }
}
