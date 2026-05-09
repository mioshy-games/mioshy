"use server";

/**
 * app/actions/milestones.ts
 *
 * Layer-4 user action: dismiss a milestone reveal modal.
 * Stamps revealed_at on the row so it never reappears.
 */

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type Result = { ok: true } | { ok: false; error: string };

export async function dismissMilestone(milestoneId: string): Promise<Result> {
  if (!milestoneId) return { ok: false, error: "missing_id" };
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, error: "auth_required" };

  const { error } = await supabase
    .from("journey_milestones")
    .update({ revealed_at: new Date().toISOString() })
    .eq("id", milestoneId)
    .is("revealed_at", null);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/my/journey", "layout");
  return { ok: true };
}
