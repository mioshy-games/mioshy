// ============================================================
// Cadence triggers — slice 3.
//
// Two entry points fire the cadence engine outside the cron loop:
//
//   1. onPriorityRankingSubmitted(userId, rankingKeys)
//      Called from /api/journey/answer when the q_priorities
//      response is saved. Persists the user's ranking into
//      journey_user_priorities (resolving slug→category_id) and
//      attempts a day-1 materialization with unlock_at = now() so
//      the user sees an item immediately on /my/journey.
//
//   2. onPriorityRankingChanged(userId, rankingKeys)
//      Called when the user re-orders their ranking from
//      /my/journey. Updates journey_user_priorities. Future picks
//      use the new order; history (delivered_items) is frozen so
//      no item is ever re-delivered.
//
// Both functions are server-only. They use the service-role admin
// client because they may run before the user has any RLS-visible
// rows in journey_user_priorities.
// ============================================================

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { getJourneySettings } from "./journey-settings";
import {
  isCadenceEligible,
  materializeNextItemForUser,
  type MaterializeResult,
} from "./cadence-engine";
import { isPriorityKey, type PriorityKey } from "@/lib/journey/priorities";

interface UpsertResult {
  ok: boolean;
  error?: string;
}

/**
 * Resolve the user's ranking (a list of priority slugs like
 * "communication") to category UUIDs, using the
 * assessment_priority_key seed. Order is preserved.
 *
 * Returns null if any slug fails to resolve — the caller should
 * treat that as "ranking is not actionable" and skip materialization
 * rather than persist a partial ranking.
 */
async function resolveRankingToCategoryIds(
  rankingKeys: string[],
): Promise<string[] | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const validKeys: PriorityKey[] = [];
  for (const k of rankingKeys) {
    if (isPriorityKey(k)) validKeys.push(k);
  }
  if (validKeys.length === 0) return null;

  const { data, error } = await admin
    .from("journey_categories")
    .select("id, assessment_priority_key")
    .in("assessment_priority_key", validKeys);
  if (error || !data) {
    console.error("[cadence-trigger.resolve] read failed", error);
    return null;
  }

  const idByKey = new Map<string, string>();
  for (const row of data as unknown as Array<{
    id: string;
    assessment_priority_key: string;
  }>) {
    idByKey.set(row.assessment_priority_key, row.id);
  }

  const ordered: string[] = [];
  for (const k of validKeys) {
    const id = idByKey.get(k);
    if (!id) {
      console.warn(
        `[cadence-trigger.resolve] no journey_categories row for assessment_priority_key='${k}' — slug may have been dropped from the seed`,
      );
      return null;
    }
    ordered.push(id);
  }
  return ordered;
}

async function upsertUserPriorities(
  userId: string,
  rankingKeys: string[],
  source: "assessment" | "user_edit" | "admin_override",
): Promise<UpsertResult> {
  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, error: "no admin client" };

  const ranking = await resolveRankingToCategoryIds(rankingKeys);
  if (!ranking) {
    return { ok: false, error: "ranking did not resolve to category ids" };
  }

  // Weights default to the platform setting. Future iterations could
  // let the user supply their own weights; for now they always pick
  // up whatever journey_settings has.
  const settings = await getJourneySettings();
  const weights = settings.defaultPriorityWeights.slice(0, ranking.length);
  // Pad with the smallest weight if the ranking has more entries
  // than the configured weight vector (shouldn't happen with the
  // seeded 5/5 today, but guards future expansion to 6+).
  while (weights.length < ranking.length) {
    weights.push(weights[weights.length - 1] ?? 0);
  }

  const { error } = await admin
    .from("journey_user_priorities")
    .upsert(
      {
        user_id: userId,
        ranking,
        weights,
        source,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) {
    console.error("[cadence-trigger.upsert] failed", error);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ------------------------------------------------------------
// Public triggers
// ------------------------------------------------------------

export interface DayOneResult {
  prioritiesSaved: boolean;
  materialized: MaterializeResult | null;
  /** Reason we didn't materialize (eligibility gate, etc.). Present
   *  when materialized is null. */
  skipReason?: string;
  error?: string;
}

/**
 * Fires when /api/journey/answer saves the q_priorities response.
 * Persists the ranking, then attempts an immediate day-1 materialize
 * with unlock_at = now() so the first item shows up the moment the
 * user lands on /my/journey.
 *
 * Best-effort: if materialization fails (no journey entitlement,
 * empty catalog), the caller still completes the assessment flow.
 * The cron will pick up the user on their next delivery slot.
 */
export async function onPriorityRankingSubmitted(
  userId: string,
  rankingKeys: string[],
): Promise<DayOneResult> {
  const upsert = await upsertUserPriorities(userId, rankingKeys, "assessment");
  if (!upsert.ok) {
    return {
      prioritiesSaved: false,
      materialized: null,
      error: upsert.error,
    };
  }

  // Eligibility gate: skip materialization if the user isn't
  // entitled (free assessment users see AnalysisSummary, not a
  // timeline item) or is in grace / blocked.
  const elig = await isCadenceEligible(userId);
  if (!elig.eligible) {
    return {
      prioritiesSaved: true,
      materialized: null,
      skipReason: elig.reason ?? "not_eligible",
    };
  }

  const result = await materializeNextItemForUser(userId, {
    unlockAt: new Date(),
    source: "cadence",
    // First-ever materialization — nothing to skip-sweep.
    skipSweep: true,
  });
  return { prioritiesSaved: true, materialized: result };
}

/**
 * Fires when the user reorders their ranking from /my/journey
 * (JourneyPriorityRanking edit). Updates the persisted ranking;
 * does NOT trigger materialization — the next slot will use the
 * new order. History is frozen by the dedup table.
 */
export async function onPriorityRankingChanged(
  userId: string,
  rankingKeys: string[],
): Promise<UpsertResult> {
  return upsertUserPriorities(userId, rankingKeys, "user_edit");
}
