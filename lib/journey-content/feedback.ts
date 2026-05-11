/**
 * lib/journey-content/feedback.ts
 *
 * Server-side queries for journey_item_feedback. The user-facing
 * write path (the 4-button bar) lives in app/actions/journey-feedback.ts;
 * this module only handles read-side admin views.
 */

import { createAdminClient } from "@/lib/supabase-admin";

export type FeedbackRating =
  | "helpful"
  | "neutral"
  | "not_for_us"
  | "made_things_worse";

export interface ItemFeedbackEntry {
  id:                string;
  scheduled_item_id: string;
  user_id:           string;
  rating:            FeedbackRating;
  optional_text:     string | null;
  created_at:        string;
}

export interface ItemFeedbackSummary {
  /** Map rating → count. Buckets that haven't been used are 0. */
  counts:        Record<FeedbackRating, number>;
  total:         number;
  helpfulRate:   number;          // 0-1
  /** Recent feedback rows (most recent first) — capped. */
  recent:        ItemFeedbackEntry[];
}

const ZERO_COUNTS: Record<FeedbackRating, number> = {
  helpful:           0,
  neutral:           0,
  not_for_us:        0,
  made_things_worse: 0,
};

/**
 * Aggregate feedback for ONE journey_item — pulls every feedback row
 * across every scheduled instance of that item. Used by the admin
 * per-item dashboard (/dashboard/journey/items/[id]/feedback).
 */
export async function getItemFeedbackSummary(
  itemId: string,
  recentLimit = 30,
): Promise<ItemFeedbackSummary> {
  const admin = await createAdminClient();

  // Fetch every scheduled_item id for this item, then every feedback
  // row that points at any of those scheduled rows. Two small queries;
  // cheaper than a JOIN against the very-wide journey_scheduled_items.
  const { data: scheduled, error: sErr } = await admin
    .from("journey_scheduled_items")
    .select("id")
    .eq("item_id", itemId);

  if (sErr) {
    console.error("[feedback] scheduled lookup failed", sErr);
    return {
      counts:      { ...ZERO_COUNTS },
      total:       0,
      helpfulRate: 0,
      recent:      [],
    };
  }

  const scheduledIds = (scheduled ?? []).map((r) => (r as { id: string }).id);
  if (scheduledIds.length === 0) {
    return {
      counts:      { ...ZERO_COUNTS },
      total:       0,
      helpfulRate: 0,
      recent:      [],
    };
  }

  const { data: feedback, error: fErr } = await admin
    .from("journey_item_feedback")
    .select("*")
    .in("scheduled_item_id", scheduledIds)
    .order("created_at", { ascending: false });

  if (fErr) {
    console.error("[feedback] feedback lookup failed", fErr);
    return {
      counts:      { ...ZERO_COUNTS },
      total:       0,
      helpfulRate: 0,
      recent:      [],
    };
  }

  const rows = (feedback ?? []) as ItemFeedbackEntry[];
  const counts: Record<FeedbackRating, number> = { ...ZERO_COUNTS };
  for (const r of rows) counts[r.rating] += 1;

  const total = rows.length;
  const helpfulRate = total === 0 ? 0 : counts.helpful / total;

  return {
    counts,
    total,
    helpfulRate,
    recent: rows.slice(0, recentLimit),
  };
}
