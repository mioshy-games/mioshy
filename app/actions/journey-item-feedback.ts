"use server";

/**
 * app/actions/journey-item-feedback.ts
 *
 * User-facing server action for the per-item 4-button feedback bar.
 * Idempotent on (scheduled_item_id, user_id) — re-submission replaces.
 *
 * NOTE: do not confuse this with the admin-side `journey_feedback`
 * table (clinical observations) handled in app/actions/journey-feedback.ts.
 * That table is admin-only; this one is user-authored.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const RATING = ["helpful", "neutral", "not_for_us", "made_things_worse"] as const;

const schema = z.object({
  scheduledItemId: z.string().uuid(),
  rating: z.enum(RATING),
  optionalText: z.string().trim().max(2000).nullable().optional(),
});

type Result = { ok: true } | { ok: false; error: string };

export async function submitItemFeedback(raw: unknown): Promise<Result> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first ? first.message : "invalid input" };
  }
  const { scheduledItemId, rating, optionalText } = parsed.data;

  const supabase = await createServerSupabaseClient();
  const { data: auth, error: authErr } = await supabase.auth.getUser();
  if (authErr || !auth?.user) {
    return { ok: false, error: "auth_required" };
  }

  const { error } = await supabase
    .from("journey_item_feedback")
    .upsert(
      {
        scheduled_item_id: scheduledItemId,
        user_id: auth.user.id,
        rating,
        optional_text: optionalText?.trim() || null,
      },
      { onConflict: "scheduled_item_id,user_id" },
    );

  if (error) {
    console.error("[submitItemFeedback] upsert failed", error);
    return { ok: false, error: error.message };
  }

  // Refresh the item detail so the bar reflects the saved rating
  // on next render (the bar reads its initial state from the page).
  revalidatePath("/[locale]/journey/timeline/[scheduledId]", "page");
  return { ok: true };
}
