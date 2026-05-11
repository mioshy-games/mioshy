/**
 * lib/journey/score-history.ts
 *
 * Layer-4 score evolution helper. Walks the user's journey_analysis
 * rows ordered by computed_at and emits a tidy series the user-side
 * chart and the coach-side chart both consume.
 *
 * Three series:
 *   - friendship  (higher = better)
 *   - conflict    (higher = better — the column is conflict_health)
 *   - passion     (higher = WORSE — column is passion_risk; the
 *                 chart inverts it visually so up means good)
 *
 * Only returns ≥2 points: a single row is the baseline, and a
 * single-point chart isn't meaningful. The caller renders nothing
 * when this returns < 2 points.
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";

export interface ScorePoint {
  computedAt:    string;
  friendship:    number | null;
  conflictHealth: number | null;
  passionRisk:   number | null;
}

export async function getScoreHistoryForUser(
  userId: string,
): Promise<ScorePoint[]> {
  const admin = createServiceRoleClient();
  if (!admin) return [];

  // Find the user's journey rows (one per assessment session).
  const { data: journeys } = await admin
    .from("journeys")
    .select("id")
    .eq("user_id", userId);
  const journeyIds = ((journeys ?? []) as Array<{ id: string }>).map((j) => j.id);
  if (journeyIds.length === 0) return [];

  const { data: rows } = await admin
    .from("journey_analysis")
    .select(
      "computed_at, friendship_score, conflict_health, passion_risk",
    )
    .in("journey_id", journeyIds)
    .order("computed_at", { ascending: true });

  return ((rows ?? []) as Array<{
    computed_at:      string;
    friendship_score: number | null;
    conflict_health:  number | null;
    passion_risk:     number | null;
  }>).map((r) => ({
    computedAt:     r.computed_at,
    friendship:     r.friendship_score,
    conflictHealth: r.conflict_health,
    passionRisk:    r.passion_risk,
  }));
}

/**
 * Couple-scoped: aggregate both partners' latest score per analysis
 * cycle. For Layer 4 we surface the AVERAGE of both partners per
 * computed_at bucket; this gives the coach + the couple a single
 * trend line that's easy to read.
 */
export async function getScoreHistoryForCouple(
  coupleId: string,
): Promise<ScorePoint[]> {
  const admin = createServiceRoleClient();
  if (!admin) return [];

  const { data: members } = await admin
    .from("couple_members")
    .select("user_id")
    .eq("couple_id", coupleId);
  const userIds = ((members ?? []) as Array<{ user_id: string }>).map(
    (m) => m.user_id,
  );
  if (userIds.length === 0) return [];

  const perUser = await Promise.all(userIds.map(getScoreHistoryForUser));
  // Bucket by ISO day of computedAt so we average partners that
  // completed within the same day window.
  const buckets = new Map<
    string,
    {
      friendship: number[];
      conflict:   number[];
      passion:    number[];
      anchor:     string;
    }
  >();
  for (const series of perUser) {
    for (const pt of series) {
      const day = pt.computedAt.slice(0, 10);
      const cur = buckets.get(day) ?? {
        friendship: [],
        conflict:   [],
        passion:    [],
        anchor:     pt.computedAt,
      };
      if (pt.friendship !== null)     cur.friendship.push(pt.friendship);
      if (pt.conflictHealth !== null) cur.conflict.push(pt.conflictHealth);
      if (pt.passionRisk !== null)    cur.passion.push(pt.passionRisk);
      buckets.set(day, cur);
    }
  }
  const out: ScorePoint[] = Array.from(buckets.values()).map((b) => ({
    computedAt:    b.anchor,
    friendship:    avg(b.friendship),
    conflictHealth: avg(b.conflict),
    passionRisk:   avg(b.passion),
  }));
  out.sort((a, b) => a.computedAt.localeCompare(b.computedAt));
  return out;
}

function avg(arr: number[]): number | null {
  if (arr.length === 0) return null;
  return Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);
}
