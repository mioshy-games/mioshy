/**
 * lib/journey/story-narrative.ts
 *
 * FU6.S5 — "Your story so far" narrative builder.
 *
 * Generates a templated retrospective paragraph at milestone reveal
 * time (10 / 20 items completed). No LLM — slot-filling against the
 * couple's actual journey data so the output is predictable and
 * always grounded in real items.
 *
 * Voice: human-first (Itzik's standard). No "we noticed", no
 * "your journey shows you've engaged with…". Just a quiet line that
 * names what they did and points forward.
 *
 * Returns null when there isn't enough material yet — the caller
 * (StoryReveal in the milestone modal) can hide the CTA quietly.
 */

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";

export interface StoryNarrative {
  /** Lead line — varies with milestone count (10 vs 20). */
  lead:        string;
  /** Item titles, in completion order, capped at the threshold. */
  itemTitles:  string[];
  /** Single excerpt the couple wrote at some point along the way.
   *  Truncated at ~120 chars. Null when no responses exist. */
  excerpt:     string | null;
  /** Closing line. Forward-pointing, never preachy. */
  outro:       string;
}

/**
 * Build the narrative for a couple. `coupleIdOrUserId` accepts either
 * a couple_id (preferred) or a user_id (fallback for solo users —
 * Layer 5 milestones are couple-only, but the Layer 4 ten/twenty
 * milestones can fire for solo users too).
 */
export async function generateCoupleStoryNarrative(args: {
  /** Pass coupleId when known; userId is the solo fallback. */
  coupleId?: string | null;
  userId?:   string | null;
  /** Hebrew or English copy. */
  isHe:      boolean;
  /** Threshold the user just hit (10 or 20). Drives lead/outro tone. */
  threshold: 10 | 20;
}): Promise<StoryNarrative | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;
  if (!args.coupleId && !args.userId) return null;

  // Resolve the assignments belonging to this owner.
  const assignmentQuery = admin
    .from("journey_assignments")
    .select("id")
    .eq("is_active", true);
  const { data: assignments } =
    args.coupleId
      ? await assignmentQuery.eq("couple_id", args.coupleId)
      : await assignmentQuery.eq("user_id", args.userId!);

  const assignmentIds = ((assignments ?? []) as Array<{ id: string }>).map(
    (a) => a.id,
  );
  if (assignmentIds.length === 0) return null;

  // Pull all scheduled items for those assignments, then their
  // completion + item rows. We sort by completed_at DESC and slice
  // to the threshold.
  const { data: scheduled } = await admin
    .from("journey_scheduled_items")
    .select("id, item_id")
    .in("assignment_id", assignmentIds);
  const scheduledIds = ((scheduled ?? []) as Array<{ id: string }>).map(
    (r) => r.id,
  );
  if (scheduledIds.length === 0) return null;

  const { data: completions } = await admin
    .from("journey_item_completions")
    .select("scheduled_item_id, completed_at")
    .in("scheduled_item_id", scheduledIds)
    .order("completed_at", { ascending: false })
    .limit(args.threshold);

  const completionRows = (completions ?? []) as Array<{
    scheduled_item_id: string;
    completed_at:      string;
  }>;
  if (completionRows.length === 0) return null;

  // Resolve item titles in batch via the scheduled_items mapping.
  const schedToItem = new Map<string, string>();
  for (const s of (scheduled ?? []) as Array<{ id: string; item_id: string }>) {
    schedToItem.set(s.id, s.item_id);
  }
  const itemIds = Array.from(
    new Set(
      completionRows
        .map((r) => schedToItem.get(r.scheduled_item_id))
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const titleByItem = new Map<string, string>();
  if (itemIds.length > 0) {
    const { data: items } = await admin
      .from("journey_items")
      .select("id, title_he, title_en")
      .in("id", itemIds);
    for (const it of (items ?? []) as Array<{
      id:        string;
      title_he:  string | null;
      title_en:  string | null;
    }>) {
      const t = args.isHe
        ? it.title_he ?? it.title_en ?? ""
        : it.title_en ?? it.title_he ?? "";
      if (t) titleByItem.set(it.id, t);
    }
  }

  // Order item titles by completion time (oldest → newest reads as
  // a story arc, even though we fetched newest-first).
  const orderedTitles = completionRows
    .slice()
    .reverse()
    .map((r) => {
      const itemId = schedToItem.get(r.scheduled_item_id);
      return itemId ? titleByItem.get(itemId) : undefined;
    })
    .filter((t): t is string => Boolean(t));

  // Pull a single representative response excerpt — the most
  // recent non-empty one across all those scheduled items. We
  // truncate gently and avoid over-claiming when the response is
  // very short.
  let excerpt: string | null = null;
  if (scheduledIds.length > 0) {
    const { data: responses } = await admin
      .from("journey_item_responses")
      .select("response_text, created_at")
      .in("scheduled_item_id", scheduledIds)
      .order("created_at", { ascending: false })
      .limit(20);
    for (const r of (responses ?? []) as Array<{
      response_text: string | null;
    }>) {
      const t = (r.response_text ?? "").trim();
      if (t.length >= 30) {
        excerpt = t.length > 120 ? `${t.slice(0, 117)}…` : t;
        break;
      }
    }
  }

  // Templated copy — varies by threshold + locale.
  const lead = args.isHe
    ? args.threshold === 10
      ? "עברתם עשרה פריטים. הנה השביל שעברתם:"
      : "עשרים פריטים מאחור. תסתכלו רגע איך זה נראה:"
    : args.threshold === 10
      ? "Ten items in. Here's the path you walked:"
      : "Twenty items behind you. Look back at the shape of it:";

  const outro = args.isHe
    ? args.threshold === 10
      ? "מכאן הקצב כבר שלכם. נמשיך."
      : "אם תסתכלו על עצמכם לפני זה — תראו זוג אחר. בלי דרמה. זה פשוט קרה."
    : args.threshold === 10
      ? "From here the rhythm is yours. We'll keep going."
      : "Look at yourselves before this — different couple. No drama. It just happened.";

  return {
    lead,
    itemTitles: orderedTitles,
    excerpt,
    outro,
  };
}
