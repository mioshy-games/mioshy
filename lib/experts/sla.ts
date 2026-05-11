/**
 * lib/experts/sla.ts
 *
 * Layer-2 SLA helper for the coach view.
 *
 * "SLA breach" definition for now: a journey_item_responses row with
 * clinician_status='open' (or null) that has no clinician_replied_at.
 * The age is computed from the response's created_at.
 *
 * Buckets:
 *   green  — none open  OR  oldest open < 12h
 *   amber  — 12h ≤ oldest < 24h
 *   red    — oldest ≥ 24h
 *
 * V3 will incorporate journey_messages with author_kind='expert' as
 * the canonical "replied" signal; for Layer 2 we lean on the
 * existing clinician_replied_at column which the legacy mirror
 * keeps in sync (see app/actions/journey-messages.ts).
 */

import { createServiceRoleClient } from "@/lib/supabase-admin";

export type SlaTone = "green" | "amber" | "red";

export interface CoupleSlaState {
  /** Couple this state describes. */
  coupleId:        string;
  /** Number of open responses without an expert reply. */
  openCount:       number;
  /** Hours since the OLDEST open response was posted. null = nothing open. */
  oldestOpenHours: number | null;
  tone:            SlaTone;
}

const ONE_HOUR_MS = 60 * 60 * 1000;

function classify(hours: number | null): SlaTone {
  if (hours === null) return "green";
  if (hours >= 24) return "red";
  if (hours >= 12) return "amber";
  return "green";
}

/**
 * Compute SLA state for a batch of couples in one round trip. Returns
 * a Map keyed by couple_id; missing entries default to all-green.
 */
export async function getSlaForCouples(
  coupleIds: string[],
): Promise<Map<string, CoupleSlaState>> {
  const map = new Map<string, CoupleSlaState>();
  if (coupleIds.length === 0) return map;

  const admin = createServiceRoleClient();
  if (!admin) return map;

  // The link from response → couple goes through the assignment.
  // We pull (response, assignment.couple_id) for every open response
  // belonging to one of the requested couples in a single JOIN.
  // Supabase JS client uses the implicit-join syntax via inner select.
  const { data, error } = await admin
    .from("journey_item_responses")
    .select(
      "id, created_at, clinician_replied_at, clinician_status, scheduled_item_id",
    )
    .is("clinician_replied_at", null)
    .or("clinician_status.is.null,clinician_status.eq.open");

  if (error) {
    console.error("[sla] response query failed", error);
    return map;
  }
  const responses = (data ?? []) as Array<{
    id:                   string;
    created_at:           string;
    clinician_replied_at: string | null;
    scheduled_item_id:    string;
  }>;

  if (responses.length === 0) {
    for (const id of coupleIds) {
      map.set(id, {
        coupleId:        id,
        openCount:       0,
        oldestOpenHours: null,
        tone:            "green",
      });
    }
    return map;
  }

  // Resolve scheduled_item → assignment → couple_id via two batched
  // lookups. Cheaper than a 3-way Supabase relational query for now.
  const scheduledIds = Array.from(new Set(responses.map((r) => r.scheduled_item_id)));
  const { data: scheduled } = await admin
    .from("journey_scheduled_items")
    .select("id, assignment_id")
    .in("id", scheduledIds);

  const scheduledToAssignment = new Map<string, string>();
  for (const row of (scheduled ?? []) as Array<{ id: string; assignment_id: string }>) {
    scheduledToAssignment.set(row.id, row.assignment_id);
  }

  const assignmentIds = Array.from(new Set(scheduledToAssignment.values()));
  const { data: assignments } = await admin
    .from("journey_assignments")
    .select("id, couple_id")
    .in("id", assignmentIds);

  const assignmentToCouple = new Map<string, string>();
  for (const row of (assignments ?? []) as Array<{
    id: string;
    couple_id: string | null;
  }>) {
    if (row.couple_id) assignmentToCouple.set(row.id, row.couple_id);
  }

  // Aggregate per couple.
  const now = Date.now();
  const wantedSet = new Set(coupleIds);
  const perCouple = new Map<string, { count: number; oldest: number }>();

  for (const r of responses) {
    const assignmentId = scheduledToAssignment.get(r.scheduled_item_id);
    if (!assignmentId) continue;
    const coupleId = assignmentToCouple.get(assignmentId);
    if (!coupleId || !wantedSet.has(coupleId)) continue;

    const hoursOld = (now - new Date(r.created_at).getTime()) / ONE_HOUR_MS;
    const cur = perCouple.get(coupleId);
    if (!cur) {
      perCouple.set(coupleId, { count: 1, oldest: hoursOld });
    } else {
      perCouple.set(coupleId, {
        count: cur.count + 1,
        oldest: Math.max(cur.oldest, hoursOld),
      });
    }
  }

  for (const id of coupleIds) {
    const agg = perCouple.get(id);
    if (!agg) {
      map.set(id, {
        coupleId:        id,
        openCount:       0,
        oldestOpenHours: null,
        tone:            "green",
      });
      continue;
    }
    map.set(id, {
      coupleId:        id,
      openCount:       agg.count,
      oldestOpenHours: Math.round(agg.oldest * 10) / 10,
      tone:            classify(agg.oldest),
    });
  }
  return map;
}
