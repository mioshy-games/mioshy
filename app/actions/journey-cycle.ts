"use server";

// ============================================================
// User-facing action: mark one cycle chapter as "we did this" (spec §3).
//
// §9.1 says one partner marking is enough and we never wait for the second.
// In this model that is structural rather than a rule to enforce: cycles are
// PER USER, so each partner marks their own five and neither waits on anyone.
// The ownership check below is therefore the whole authorisation story.
// ============================================================

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import { completeCycleItem } from "@/lib/journey-content/cycle-engine";

export type MarkDoneResult =
  | { ok: true; cycleClosed: boolean; nextCycleOpened: boolean }
  | { ok: false; error: string };

export async function markCycleItemDone(cycleItemId: string): Promise<MarkDoneResult> {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, error: "auth_required" };

  const admin = createServiceRoleClient();
  if (!admin) return { ok: false, error: "unavailable" };

  // The row must belong to THIS user's cycle. Without this check any signed-in
  // user could mark any other user's chapter and advance their cycle.
  const { data: row } = await admin
    .from("journey_cycle_items")
    .select("id, journey_cycles!inner(user_id)")
    .eq("id", cycleItemId)
    .maybeSingle();
  if (!row) return { ok: false, error: "not_found" };

  const owner = (row as unknown as { journey_cycles: { user_id: string } }).journey_cycles.user_id;
  if (owner !== auth.user.id) return { ok: false, error: "forbidden" };

  const result = await completeCycleItem(cycleItemId, auth.user.id);
  if (!result.ok) return { ok: false, error: result.reason ?? "failed" };

  revalidatePath("/[locale]/my/journey", "page");
  revalidatePath("/[locale]/my", "layout");

  return {
    ok: true,
    cycleClosed: result.cycleClosed,
    nextCycleOpened: result.nextCycleOpened,
  };
}
