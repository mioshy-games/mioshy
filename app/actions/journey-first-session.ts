"use server";

/**
 * app/actions/journey-first-session.ts
 *
 * Layer-1 marker: stamp profiles.journey_first_session_completed_at
 * the first time the user opens their day-1 item. Idempotent — only
 * sets the column when it's currently NULL.
 *
 * Called from the day-1 item detail page on render (server-side).
 */

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Result = { ok: true; alreadySet?: boolean } | { ok: false; error: string };

export async function markFirstSessionCompleted(): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, error: "auth_required" };

  // Only stamp if not already set — idempotent guard at the SQL level
  // via UPDATE ... WHERE journey_first_session_completed_at IS NULL.
  const { data, error } = await supabase
    .from("profiles")
    .update({ journey_first_session_completed_at: new Date().toISOString() })
    .eq("id", auth.user.id)
    .is("journey_first_session_completed_at", null)
    .select("id");

  if (error) {
    console.error("[markFirstSessionCompleted] update failed", error);
    return { ok: false, error: error.message };
  }

  // data is empty array when the row already had a value — that's the
  // happy idempotent path. We surface alreadySet=true so callers can
  // skip the revalidation chore in that case.
  const alreadySet = !data || data.length === 0;
  if (!alreadySet) {
    revalidatePath("/[locale]/my/journey", "layout");
    revalidatePath("/[locale]/my", "layout");
  }
  return { ok: true, alreadySet };
}
