/**
 * lib/journey/coach-suggestions.ts
 *
 * Phase 4 — smart content suggestions for the coach. Given a couple,
 * recommend the next 3 items to push.
 *
 * Heuristic-based (no LLM in V1) — relies on:
 *   1. Couple's priority ranking (from journey_responses 'ranking' answer).
 *      Top priority gets the strongest weight.
 *   2. Couple's current stage — distinct stages they've already
 *      completed at least one item in. We suggest the same stage or
 *      one above.
 *   3. Negative feedback signals — items rated 'not_for_us' or
 *      'made_things_worse' are demoted (could be wrong fit).
 *   4. Items already on the couple's timeline (scheduled or completed)
 *      are excluded — never recommend something they've already seen.
 *
 * Server-only.
 */

import "server-only";
import { createAdminClient } from "@/lib/supabase-admin";

const PRIORITY_KEYS = [
  "communication",
  "intimacy",
  "emotional_connection",
  "friendship",
  "family",
] as const;
type PriorityKey = (typeof PRIORITY_KEYS)[number];

export interface CoachSuggestion {
  itemId:        string;
  title_he:      string;
  category_he:   string;
  category_key:  PriorityKey | string;
  stage:         number | null;
  rationale:     string;
  /** Score 0-100, higher = stronger recommendation. */
  score:         number;
  /** Where the item lives in the catalog — drill-in for the coach. */
  itemHref:      string;
}

/**
 * Build the top-N suggestions for one couple.
 * Returns an empty array (not null) when there's nothing to suggest.
 */
export async function getCoachSuggestionsForCouple(
  coupleId: string,
  limit = 3,
): Promise<CoachSuggestion[]> {
  const admin = await createAdminClient();

  // ── 1. Resolve owner identity (couple members) ──────────────
  const { data: members } = await admin
    .from("couple_members")
    .select("user_id")
    .eq("couple_id", coupleId);
  const memberIds = ((members ?? []) as Array<{ user_id: string }>).map(
    (m) => m.user_id,
  );
  if (memberIds.length === 0) return [];

  // ── 2. Pull priority ranking from journey_responses ──────────
  // Use the most recent ranking from either partner. The cadence
  // engine already prefers partner-specific rankings; for coach
  // suggestions a couple-level view is fine.
  const { data: journeys } = await admin
    .from("journeys")
    .select("id, user_id, last_activity_at")
    .in("user_id", memberIds)
    .order("last_activity_at", { ascending: false });

  const journeyIds = ((journeys ?? []) as Array<{ id: string }>).map((j) => j.id);
  const priorityWeights = new Map<PriorityKey, number>();
  if (journeyIds.length > 0) {
    const { data: responses } = await admin
      .from("journey_responses")
      .select("answer")
      .in("journey_id", journeyIds);
    for (const r of (responses ?? []) as Array<{
      answer: { kind?: string; order?: unknown };
    }>) {
      const ans = r.answer ?? {};
      if (ans.kind !== "ranking") continue;
      const order = ans.order;
      if (!Array.isArray(order)) continue;
      for (let i = 0; i < order.length; i++) {
        const key = String(order[i] ?? "");
        if ((PRIORITY_KEYS as readonly string[]).includes(key)) {
          // Weight: 50 / 40 / 30 / 20 / 10 by rank.
          const weight = 50 - i * 10;
          const existing = priorityWeights.get(key as PriorityKey) ?? 0;
          if (weight > existing) {
            priorityWeights.set(key as PriorityKey, weight);
          }
        }
      }
    }
  }

  // Fallback: if no ranking, give every priority a flat weight.
  if (priorityWeights.size === 0) {
    for (const k of PRIORITY_KEYS) priorityWeights.set(k, 25);
  }

  // ── 3. Pull active assignments + scheduled item ids to exclude ──
  // Phase 13 — no-repeat: pull EVERY scheduled item ever (active or not)
  // for this couple, plus every dismissed recommendation. Both get
  // excluded from the suggestion pool.
  const { data: assignments } = await admin
    .from("journey_assignments")
    .select("id")
    .eq("couple_id", coupleId);
  const assignmentIds = ((assignments ?? []) as Array<{ id: string }>).map(
    (a) => a.id,
  );
  const seenItemIds = new Set<string>();
  if (assignmentIds.length > 0) {
    const { data: scheduled } = await admin
      .from("journey_scheduled_items")
      .select("item_id")
      .in("assignment_id", assignmentIds);
    for (const r of (scheduled ?? []) as Array<{ item_id: string }>) {
      seenItemIds.add(r.item_id);
    }
  }
  // Also exclude dismissed recommendations — coach said "not for them".
  const { data: dismissed } = await admin
    .from("journey_couple_recommendations")
    .select("item_id")
    .eq("couple_id", coupleId)
    .not("dismissed_at", "is", null);
  for (const r of (dismissed ?? []) as Array<{ item_id: string }>) {
    if (r.item_id) seenItemIds.add(r.item_id);
  }

  // ── 4. Determine current stage progression ──────────────────
  // Pull completion rows joined to scheduled → item → stage. The
  // "current stage" = max stage with at least one completion. We
  // bias suggestions toward the same stage or stage+1.
  let currentStage = 1;
  if (assignmentIds.length > 0) {
    const { data: scheduled } = await admin
      .from("journey_scheduled_items")
      .select("id, item_id")
      .in("assignment_id", assignmentIds);
    const schedToItem = new Map<string, string>(
      ((scheduled ?? []) as Array<{ id: string; item_id: string }>).map(
        (r) => [r.id, r.item_id],
      ),
    );
    const allItemIds = Array.from(new Set(schedToItem.values()));
    if (allItemIds.length > 0) {
      const { data: items } = await admin
        .from("journey_items")
        .select("id, stage")
        .in("id", allItemIds)
        .not("stage", "is", null);
      const stageByItem = new Map<string, number>(
        ((items ?? []) as Array<{ id: string; stage: number }>).map(
          (r) => [r.id, r.stage],
        ),
      );
      const schedIds = Array.from(schedToItem.keys());
      if (schedIds.length > 0) {
        const { data: comps } = await admin
          .from("journey_item_completions")
          .select("scheduled_item_id")
          .in("scheduled_item_id", schedIds);
        let maxStageCompleted = 0;
        for (const c of (comps ?? []) as Array<{
          scheduled_item_id: string;
        }>) {
          const itemId = schedToItem.get(c.scheduled_item_id);
          if (!itemId) continue;
          const s = stageByItem.get(itemId);
          if (s && s > maxStageCompleted) maxStageCompleted = s;
        }
        currentStage = Math.min(4, Math.max(1, maxStageCompleted + 1));
      }
    }
  }

  // ── 5. Pull candidate items in priority categories ─────────────
  const { data: cats } = await admin
    .from("journey_categories")
    .select("id, name_he, assessment_priority_key")
    .in("assessment_priority_key", Array.from(PRIORITY_KEYS));
  const catRows = (cats ?? []) as Array<{
    id: string;
    name_he: string;
    assessment_priority_key: PriorityKey;
  }>;
  const catKeyById = new Map(catRows.map((c) => [c.id, c.assessment_priority_key]));
  const catNameById = new Map(catRows.map((c) => [c.id, c.name_he]));

  const candidateCategoryIds = catRows.map((c) => c.id);
  if (candidateCategoryIds.length === 0) return [];

  // Phase 13 — exclude one-off items (those belong to other couples).
  // The catalog index `journey_items_catalog_idx` covers this WHERE
  // clause for fast lookup.
  const { data: items } = await admin
    .from("journey_items")
    .select("id, title_he, category_id, stage")
    .in("category_id", candidateCategoryIds)
    .eq("is_active", true)
    .eq("is_one_off", false)
    .not("stage", "is", null);

  // ── 6. Score + rank ──────────────────────────────────────────
  // Score formula:
  //   priorityWeight (10-50)
  // + stageMatchBonus (0/10/20)  — exact match = 20, +1 stage = 10
  // - negativeFeedbackPenalty (10 per negative rating, capped 30)
  const candidateRows = ((items ?? []) as Array<{
    id: string;
    title_he: string;
    category_id: string;
    stage: number;
  }>).filter((it) => !seenItemIds.has(it.id));

  // Pull negative feedback aggregated per item across all couples.
  const itemIds = candidateRows.map((c) => c.id);
  const negativeByItem = new Map<string, number>();
  if (itemIds.length > 0) {
    const { data: feedback } = await admin
      .from("journey_item_feedback")
      .select("scheduled_item_id, rating");
    // Map scheduled_item_id → item_id requires another query; we
    // approximate by relying on an earlier-pulled mapping when
    // possible. For V1 we keep it simple: count negative feedback
    // rows whose item_id we can recover by joining via scheduled.
    const { data: schedRows } = await admin
      .from("journey_scheduled_items")
      .select("id, item_id")
      .in("item_id", itemIds);
    const schedToItem2 = new Map<string, string>(
      ((schedRows ?? []) as Array<{ id: string; item_id: string }>).map(
        (r) => [r.id, r.item_id],
      ),
    );
    for (const f of (feedback ?? []) as Array<{
      scheduled_item_id: string;
      rating: string;
    }>) {
      if (f.rating !== "not_for_us" && f.rating !== "made_things_worse") continue;
      const itemId = schedToItem2.get(f.scheduled_item_id);
      if (!itemId) continue;
      negativeByItem.set(itemId, (negativeByItem.get(itemId) ?? 0) + 1);
    }
  }

  const scored = candidateRows.map((it) => {
    const catKey = catKeyById.get(it.category_id) ?? "?";
    const priorityWeight = priorityWeights.get(catKey as PriorityKey) ?? 0;
    const stageMatch =
      it.stage === currentStage ? 20 :
      it.stage === currentStage + 1 ? 10 :
      0;
    const negativeCount = negativeByItem.get(it.id) ?? 0;
    const negativePenalty = Math.min(30, negativeCount * 10);
    const score = priorityWeight + stageMatch + 5 - negativePenalty;

    const rationale = buildRationale({
      catName: catNameById.get(it.category_id) ?? "",
      priorityWeight,
      stageMatch,
      currentStage,
      itemStage: it.stage,
    });
    return {
      itemId:       it.id,
      title_he:     it.title_he,
      category_he:  catNameById.get(it.category_id) ?? "",
      category_key: catKey,
      stage:        it.stage,
      rationale,
      score,
      itemHref:     `/dashboard/journey/items/${it.id}`,
    } satisfies CoachSuggestion;
  });

  scored.sort((a, b) => b.score - a.score);

  // Phase 13 — 24h cooldown. Skip suggestions we showed in the last 24h
  // unless the coach acted on them or dismissed them (those get
  // permanently excluded above via the dismissed_at filter).
  const now = Date.now();
  const cooldownMs = 24 * 3600_000;
  const { data: recentRecs } = await admin
    .from("journey_couple_recommendations")
    .select("item_id, last_suggested_at, acted_at")
    .eq("couple_id", coupleId);
  const recentByItem = new Map<string, { last: string; acted: string | null }>();
  for (const r of (recentRecs ?? []) as Array<{
    item_id: string | null;
    last_suggested_at: string;
    acted_at: string | null;
  }>) {
    if (r.item_id) {
      recentByItem.set(r.item_id, {
        last:  r.last_suggested_at,
        acted: r.acted_at,
      });
    }
  }
  const filtered = scored.filter((s) => {
    const rec = recentByItem.get(s.itemId);
    if (!rec) return true;                       // never suggested → fresh
    if (rec.acted) return false;                  // already acted on → skip
    const lastT = new Date(rec.last).getTime();
    return (now - lastT) >= cooldownMs;           // older than 24h → fresh again
  });

  const top = filtered.slice(0, limit);

  // Log the new suggestions so the cooldown applies on the next call.
  // Fire-and-forget — failure here doesn't break the read path.
  if (top.length > 0) {
    void admin
      .from("journey_couple_recommendations")
      .upsert(
        top.map((s) => ({
          couple_id:         coupleId,
          item_id:           s.itemId,
          rationale:         s.rationale,
          score:             s.score,
          last_suggested_at: new Date().toISOString(),
        })),
        { onConflict: "couple_id,item_id" },
      );
  }

  return top;
}

/**
 * Phase 13 — record that the coach acted on a recommendation.
 * Called by the push-content action to mark the suggestion as taken.
 */
export async function recordRecommendationActed(args: {
  coupleId: string;
  itemId:   string;
}): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase-admin");
  const admin = await createAdminClient();
  await admin
    .from("journey_couple_recommendations")
    .upsert(
      {
        couple_id: args.coupleId,
        item_id:   args.itemId,
        acted_at:  new Date().toISOString(),
      },
      { onConflict: "couple_id,item_id" },
    );
}

/**
 * Phase 13 — coach explicitly dismissed a suggestion ("not for them").
 * This is a permanent exclusion — never re-suggest this item.
 */
export async function dismissRecommendation(args: {
  coupleId: string;
  itemId:   string;
  reason?:  string;
}): Promise<void> {
  const { createAdminClient } = await import("@/lib/supabase-admin");
  const admin = await createAdminClient();
  await admin
    .from("journey_couple_recommendations")
    .upsert(
      {
        couple_id:      args.coupleId,
        item_id:        args.itemId,
        dismissed_at:   new Date().toISOString(),
        dismiss_reason: args.reason ?? null,
      },
      { onConflict: "couple_id,item_id" },
    );
}

function buildRationale(args: {
  catName:        string;
  priorityWeight: number;
  stageMatch:     number;
  currentStage:   number;
  itemStage:      number;
}): string {
  const parts: string[] = [];
  if (args.priorityWeight >= 40) {
    parts.push(`עדיפות #${args.priorityWeight === 50 ? "1" : "2"} שלהם — ${args.catName}`);
  } else if (args.priorityWeight >= 20) {
    parts.push(`בעדיפות שלהם — ${args.catName}`);
  } else {
    parts.push(`קטגוריה: ${args.catName}`);
  }
  if (args.stageMatch === 20) {
    parts.push(`בשלב הנוכחי (${args.currentStage})`);
  } else if (args.stageMatch === 10) {
    parts.push(`שלב הבא — ${args.itemStage}`);
  }
  return parts.join(" · ");
}
