// ============================================================
// group-stats.ts - slice 9 read-only aggregates for a single group:
//   - per-member delivered/completed/skipped counts
//   - per-binding "delivered to N members" counts
//
// Server-only; admin client. Single-page read; no caching.
// ============================================================

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";

export interface GroupMemberStats {
  user_id: string;
  delivered: number;
  completed: number;
  skipped: number;
}

export interface GroupBindingStats {
  subtopic_id: string;
  delivered_to_members: number;
}

export async function getGroupMemberStats(
  groupId: string,
): Promise<Map<string, GroupMemberStats>> {
  const out = new Map<string, GroupMemberStats>();
  const admin = createServiceRoleClient();
  if (!admin) return out;

  const { data: memberRows } = await admin
    .from("journey_group_members")
    .select("user_id")
    .eq("group_id", groupId);
  const userIds = ((memberRows ?? []) as Array<{ user_id: string }>).map(
    (r) => r.user_id,
  );
  if (userIds.length === 0) return out;
  for (const uid of userIds) {
    out.set(uid, { user_id: uid, delivered: 0, completed: 0, skipped: 0 });
  }

  // Delivered count via delivered_items (cheap aggregate).
  const { data: deliveredRows } = await admin
    .from("journey_user_delivered_items")
    .select("user_id")
    .in("user_id", userIds);
  for (const r of (deliveredRows ?? []) as Array<{ user_id: string }>) {
    const slot = out.get(r.user_id);
    if (slot) slot.delivered++;
  }

  // Skipped + completed need scheduled_items joined to assignments
  // (so we can attribute back to the user) and journey_item_completions.
  const { data: assignRows } = await admin
    .from("journey_assignments")
    .select("id, user_id")
    .in("user_id", userIds)
    .eq("source_kind", "cadence")
    .eq("is_active", true);
  const userByAssign = new Map<string, string>();
  for (const a of (assignRows ?? []) as Array<{
    id: string;
    user_id: string;
  }>) {
    userByAssign.set(a.id, a.user_id);
  }
  const assignIds = Array.from(userByAssign.keys());
  if (assignIds.length === 0) return out;

  const { data: schedRows } = await admin
    .from("journey_scheduled_items")
    .select("id, assignment_id, skipped_at")
    .in("assignment_id", assignIds);
  const schedRowsArr = (schedRows ?? []) as Array<{
    id: string;
    assignment_id: string;
    skipped_at: string | null;
  }>;
  const schedToUser = new Map<string, string>();
  for (const s of schedRowsArr) {
    const uid = userByAssign.get(s.assignment_id);
    if (!uid) continue;
    schedToUser.set(s.id, uid);
    if (s.skipped_at) {
      const slot = out.get(uid);
      if (slot) slot.skipped++;
    }
  }

  const schedIds = Array.from(schedToUser.keys());
  if (schedIds.length > 0) {
    const { data: completedRows } = await admin
      .from("journey_item_completions")
      .select("scheduled_item_id")
      .in("scheduled_item_id", schedIds);
    for (const r of (completedRows ?? []) as Array<{
      scheduled_item_id: string;
    }>) {
      const uid = schedToUser.get(r.scheduled_item_id);
      if (!uid) continue;
      const slot = out.get(uid);
      if (slot) slot.completed++;
    }
  }

  return out;
}

/**
 * For each (subtopic) the group is bound to, count distinct member
 * users who've received any item from that subtopic (regardless of
 * binding mode). Useful sanity check: in a replace-mode binding, this
 * count equals "number of members who got an admin push on it"; in
 * interleave mode, includes cadence picks too.
 */
export async function getGroupBindingDeliveryCounts(
  groupId: string,
): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  const admin = createServiceRoleClient();
  if (!admin) return out;

  const [memberRows, bindingRows] = await Promise.all([
    admin
      .from("journey_group_members")
      .select("user_id")
      .eq("group_id", groupId),
    admin
      .from("journey_group_subtopics")
      .select("subtopic_id")
      .eq("group_id", groupId),
  ]);
  const userIds = ((memberRows.data ?? []) as Array<{ user_id: string }>).map(
    (r) => r.user_id,
  );
  const subtopicIds = ((bindingRows.data ?? []) as Array<{
    subtopic_id: string;
  }>).map((r) => r.subtopic_id);
  for (const sid of subtopicIds) out.set(sid, 0);
  if (userIds.length === 0 || subtopicIds.length === 0) return out;

  // Pull every delivered (user, item) pair for these members and look
  // up subtopic via items.
  const { data: deliveredRows } = await admin
    .from("journey_user_delivered_items")
    .select("user_id, item_id, journey_items!inner(subtopic_id)")
    .in("user_id", userIds);

  const distinctByMember = new Map<string, Set<string>>();
  for (const sid of subtopicIds) distinctByMember.set(sid, new Set());
  for (const r of (deliveredRows ?? []) as Array<{
    user_id: string;
    item_id: string;
    journey_items:
      | { subtopic_id: string | null }
      | Array<{ subtopic_id: string | null }>
      | null;
  }>) {
    const a = r.journey_items;
    const list = Array.isArray(a) ? a : a ? [a] : [];
    for (const item of list) {
      const subId = item?.subtopic_id;
      if (!subId) continue;
      if (!subtopicIds.includes(subId)) continue;
      distinctByMember.get(subId)!.add(r.user_id);
    }
  }
  for (const [sid, set] of distinctByMember) out.set(sid, set.size);
  return out;
}
