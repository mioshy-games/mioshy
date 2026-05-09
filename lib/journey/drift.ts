/**
 * lib/journey/drift.ts
 *
 * Layer-3 drift classifier — turns raw activity timestamps into a
 * coarse state the coach view + the cron can both consume.
 *
 * Buckets:
 *   active    — last activity ≤ 7 days ago
 *   drifting  — 8–14 days
 *   silent    — 15+ days
 *
 * "Activity" = the most recent of:
 *   - journey_item_responses.created_at (any partner)
 *   - journey_messages.created_at where author_kind='user'
 *
 * Read-side helper. Mutations live in the cron + check-in action.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";

export type DriftState = "active" | "drifting" | "silent";

export interface CoupleDriftSnapshot {
  coupleId:            string;
  state:               DriftState;
  lastResponseAt:      string | null;
  lastMessageAt:       string | null;
  daysSinceLastSignal: number | null;
  /** When (if at all) the coach sent a drift check-in since the last
   *  drifting episode. Null = no coach action yet. */
  coachCheckedInAt:    string | null;
}

const ONE_DAY_MS = 86_400_000;

export function classify(daysSinceSignal: number | null): DriftState {
  if (daysSinceSignal === null) return "silent";
  if (daysSinceSignal >= 15) return "silent";
  if (daysSinceSignal >= 8)  return "drifting";
  return "active";
}

/**
 * Compute drift state for a batch of couples in one round-trip.
 * Returns a Map keyed by couple_id; missing entries default to a
 * "silent + no signal" snapshot so the caller never has to handle
 * undefined.
 */
export async function getDriftForCouples(
  coupleIds: string[],
): Promise<Map<string, CoupleDriftSnapshot>> {
  const out = new Map<string, CoupleDriftSnapshot>();
  if (coupleIds.length === 0) return out;

  const admin = createServiceRoleClient();
  if (!admin) return out;

  // Pull every active assignment for these couples to walk to
  // scheduled_items → responses (the primary activity signal).
  const { data: assignments } = await admin
    .from("journey_assignments")
    .select("id, couple_id")
    .in("couple_id", coupleIds)
    .eq("is_active", true);

  const assignmentToCouple = new Map<string, string>();
  for (const row of (assignments ?? []) as Array<{ id: string; couple_id: string | null }>) {
    if (row.couple_id) assignmentToCouple.set(row.id, row.couple_id);
  }
  const assignmentIds = Array.from(assignmentToCouple.keys());

  // Latest response per couple via scheduled_items join. We pull
  // only the columns we need + filter by the assignments above.
  const lastResponsePerCouple = new Map<string, string>();
  if (assignmentIds.length > 0) {
    const { data: scheduled } = await admin
      .from("journey_scheduled_items")
      .select("id, assignment_id")
      .in("assignment_id", assignmentIds);
    const scheduledToAssignment = new Map<string, string>();
    for (const row of (scheduled ?? []) as Array<{ id: string; assignment_id: string }>) {
      scheduledToAssignment.set(row.id, row.assignment_id);
    }

    const scheduledIds = Array.from(scheduledToAssignment.keys());
    if (scheduledIds.length > 0) {
      const { data: responses } = await admin
        .from("journey_item_responses")
        .select("scheduled_item_id, created_at")
        .in("scheduled_item_id", scheduledIds)
        .order("created_at", { ascending: false });
      for (const row of (responses ?? []) as Array<{
        scheduled_item_id: string;
        created_at:        string;
      }>) {
        const assignmentId = scheduledToAssignment.get(row.scheduled_item_id);
        if (!assignmentId) continue;
        const coupleId = assignmentToCouple.get(assignmentId);
        if (!coupleId) continue;
        if (!lastResponsePerCouple.has(coupleId)) {
          lastResponsePerCouple.set(coupleId, row.created_at);
        }
      }
    }
  }

  // Latest user-authored message per couple (via couple_members).
  // Channel messages are user-owned (channel_user_id = user.id), so
  // we scope by couple membership.
  const lastMessagePerCouple = new Map<string, string>();
  const { data: members } = await admin
    .from("couple_members")
    .select("couple_id, user_id")
    .in("couple_id", coupleIds);
  const userToCouple = new Map<string, string>();
  for (const row of (members ?? []) as Array<{ couple_id: string; user_id: string }>) {
    userToCouple.set(row.user_id, row.couple_id);
  }
  const userIds = Array.from(userToCouple.keys());
  if (userIds.length > 0) {
    const { data: messages } = await admin
      .from("journey_messages")
      .select("author_user_id, created_at")
      .in("author_user_id", userIds)
      .eq("author_kind", "user")
      .order("created_at", { ascending: false });
    for (const row of (messages ?? []) as Array<{
      author_user_id: string;
      created_at:     string;
    }>) {
      const coupleId = userToCouple.get(row.author_user_id);
      if (!coupleId) continue;
      if (!lastMessagePerCouple.has(coupleId)) {
        lastMessagePerCouple.set(coupleId, row.created_at);
      }
    }
  }

  // Pull current drift_alert rows for the coach_checked_in_at flag.
  const { data: alerts } = await admin
    .from("journey_drift_alerts")
    .select("couple_id, coach_checked_in_at")
    .in("couple_id", coupleIds);
  const checkedInByCouple = new Map<string, string | null>();
  for (const row of (alerts ?? []) as Array<{
    couple_id:           string | null;
    coach_checked_in_at: string | null;
  }>) {
    if (row.couple_id) {
      checkedInByCouple.set(row.couple_id, row.coach_checked_in_at);
    }
  }

  // Aggregate.
  const now = Date.now();
  for (const id of coupleIds) {
    const lastResponse = lastResponsePerCouple.get(id) ?? null;
    const lastMessage  = lastMessagePerCouple.get(id) ?? null;
    const lastSignal = pickLatest(lastResponse, lastMessage);
    const days = lastSignal
      ? Math.floor((now - new Date(lastSignal).getTime()) / ONE_DAY_MS)
      : null;

    out.set(id, {
      coupleId:            id,
      state:               classify(days),
      lastResponseAt:      lastResponse,
      lastMessageAt:       lastMessage,
      daysSinceLastSignal: days,
      coachCheckedInAt:    checkedInByCouple.get(id) ?? null,
    });
  }

  return out;
}

function pickLatest(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

/**
 * Convenience: single-couple lookup. Wraps getDriftForCouples for
 * surfaces that only need one. Returns null when the couple isn't
 * known or has no assignments.
 */
export async function getCoupleDriftState(
  coupleId: string,
): Promise<CoupleDriftSnapshot | null> {
  const map = await getDriftForCouples([coupleId]);
  return map.get(coupleId) ?? null;
}
