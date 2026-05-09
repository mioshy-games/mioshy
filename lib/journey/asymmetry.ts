/**
 * lib/journey/asymmetry.ts
 *
 * Layer-5 partner-asymmetry helper.
 *
 * Returns per-partner counts of:
 *   - completions
 *   - responses posted
 *   - reactions on coach replies
 *
 * Plus the absolute gap percentage (0-1) and whether sustained
 * gap > 40% over the trailing 14 days.
 *
 * Used by:
 *   - coach widget on /dashboard/my-clients (alert chip)
 *   - user-facing gentle hint on /my/journey/together
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";

export interface PartnerEngagement {
  userId:           string;
  completions:      number;
  responses:        number;
  /** Most recent activity timestamp across signals. */
  lastActiveAt:     string | null;
}

export interface CoupleAsymmetry {
  coupleId:         string;
  partners:         PartnerEngagement[];
  /** Absolute |a-b| / max(a,b) on the dominant signal (completions). 0..1. */
  gapFraction:      number;
  /** True when gap > 0.40 AND it has been ≥ 0.40 for the past 14 days. */
  sustained:        boolean;
  /** Slug of the partner with HIGHER activity, for "X is ahead" copy. */
  leaderUserId:     string | null;
}

const ONE_DAY_MS = 86_400_000;
const SUSTAINED_DAYS = 14;
const ALERT_THRESHOLD = 0.40;

export async function getCoupleAsymmetry(
  coupleId: string,
): Promise<CoupleAsymmetry | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data: members } = await admin
    .from("couple_members")
    .select("user_id")
    .eq("couple_id", coupleId);
  const userIds = ((members ?? []) as Array<{ user_id: string }>).map(
    (m) => m.user_id,
  );
  if (userIds.length < 2) return null;

  const { data: assignments } = await admin
    .from("journey_assignments")
    .select("id")
    .eq("couple_id", coupleId)
    .eq("is_active", true);
  const assignmentIds = ((assignments ?? []) as Array<{ id: string }>).map(
    (a) => a.id,
  );

  let scheduledIds: string[] = [];
  if (assignmentIds.length > 0) {
    const { data: scheduled } = await admin
      .from("journey_scheduled_items")
      .select("id")
      .in("assignment_id", assignmentIds);
    scheduledIds = ((scheduled ?? []) as Array<{ id: string }>).map((r) => r.id);
  }

  const partners = await Promise.all(
    userIds.map(async (uid) => {
      let completions = 0;
      let responses = 0;
      let lastActive: string | null = null;

      if (scheduledIds.length > 0) {
        const { data: comps } = await admin
          .from("journey_item_completions")
          .select("completed_at")
          .eq("completed_by", uid)
          .in("scheduled_item_id", scheduledIds)
          .order("completed_at", { ascending: false });
        completions = (comps ?? []).length;
        if (comps && comps[0]) {
          lastActive = (comps[0] as { completed_at: string }).completed_at;
        }

        const { data: resps } = await admin
          .from("journey_item_responses")
          .select("created_at")
          .eq("user_id", uid)
          .in("scheduled_item_id", scheduledIds)
          .order("created_at", { ascending: false });
        responses = (resps ?? []).length;
        if (resps && resps[0]) {
          const ra = (resps[0] as { created_at: string }).created_at;
          if (!lastActive || new Date(ra).getTime() > new Date(lastActive).getTime()) {
            lastActive = ra;
          }
        }
      }

      return {
        userId:       uid,
        completions,
        responses,
        lastActiveAt: lastActive,
      } as PartnerEngagement;
    }),
  );

  // Compute gap on the completions signal — most concrete, hardest
  // to game. Ties at zero are treated as no gap.
  const counts = partners.map((p) => p.completions);
  const max = Math.max(...counts);
  const min = Math.min(...counts);
  const gapFraction = max === 0 ? 0 : (max - min) / max;

  // Sustained = current gap above threshold AND was already above
  // threshold 14 days ago (approximated by counting completions in
  // the trailing window).
  let sustained = false;
  if (gapFraction >= ALERT_THRESHOLD && scheduledIds.length > 0) {
    const cutoffIso = new Date(Date.now() - SUSTAINED_DAYS * ONE_DAY_MS).toISOString();
    const trailing: number[] = [];
    for (const uid of userIds) {
      const { data: comps } = await admin
        .from("journey_item_completions")
        .select("completed_at", { count: "exact", head: false })
        .eq("completed_by", uid)
        .in("scheduled_item_id", scheduledIds)
        .gte("completed_at", cutoffIso);
      trailing.push((comps ?? []).length);
    }
    const tMax = Math.max(...trailing);
    const tMin = Math.min(...trailing);
    const tGap = tMax === 0 ? 0 : (tMax - tMin) / tMax;
    sustained = tGap >= ALERT_THRESHOLD;
  }

  // Leader = the partner with more completions; null when tied.
  const leaderUserId =
    counts[0] === counts[1]
      ? null
      : counts[0] > counts[1]
        ? userIds[0]
        : userIds[1];

  return {
    coupleId,
    partners,
    gapFraction,
    sustained,
    leaderUserId,
  };
}
