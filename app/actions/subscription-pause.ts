"use server";

/**
 * app/actions/subscription-pause.ts
 *
 * Layer-3 user action: pause a Mioshy subscription instead of
 * cancelling. The pause is a state, not a teardown — the
 * underlying subscription stays alive but the cadence engine and
 * user surfaces respect "paused" by hiding new content + skipping
 * billing for the pause window (V3 hooks the cadence; L3 just
 * records and surfaces the state).
 *
 * Resume:
 *   - explicit (user clicks "I'm back")  → resumed_at = now
 *   - implicit (paused_until passes)     → no DB change; the read
 *     helper treats expired pauses as inactive
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const REASONS = ["too_busy", "life_event", "tried_not_for_us", "other"] as const;
const DURATIONS = [2, 4, 8] as const; // weeks

const pauseSchema = z.object({
  weeks:      z.coerce.number().int().refine((v) => DURATIONS.includes(v as 2 | 4 | 8), {
    message: "invalid_duration",
  }),
  reason:     z.enum(REASONS),
  reasonText: z.string().trim().max(500).optional().nullable(),
});

type Result =
  | { ok: true; pausedUntil: string }
  | { ok: false; error: string };

export async function pauseSubscription(raw: unknown): Promise<Result> {
  const parsed = pauseSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: first ? first.message : "invalid_input" };
  }

  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, error: "auth_required" };

  // No double-pausing: if there's an active pause already, return it.
  const { data: existing } = await supabase
    .from("subscription_pauses")
    .select("id, paused_until")
    .eq("user_id", auth.user.id)
    .is("resumed_at", null)
    .order("paused_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing) {
    const row = existing as { id: string; paused_until: string };
    if (new Date(row.paused_until).getTime() > Date.now()) {
      return { ok: true, pausedUntil: row.paused_until };
    }
  }

  // Resolve the latest active subscription for this user (best-effort —
  // pauses still record even when no subscription row is found; the
  // user-facing UI treats the pause state as authoritative).
  const { data: sub } = await supabase
    .from("subscriptions")
    .select("id")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const subscriptionId = (sub as { id: string } | null)?.id ?? null;

  const pausedUntilDate = new Date();
  pausedUntilDate.setUTCDate(
    pausedUntilDate.getUTCDate() + parsed.data.weeks * 7,
  );

  const { error } = await supabase.from("subscription_pauses").insert({
    user_id:         auth.user.id,
    subscription_id: subscriptionId,
    paused_until:    pausedUntilDate.toISOString(),
    reason:          parsed.data.reason,
    reason_text:     parsed.data.reasonText?.trim() || null,
  });
  if (error) {
    console.error("[pauseSubscription] insert failed", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/[locale]/account", "layout");
  revalidatePath("/[locale]/my/journey", "layout");
  return { ok: true, pausedUntil: pausedUntilDate.toISOString() };
}

export async function resumeSubscription(): Promise<Result> {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return { ok: false, error: "auth_required" };

  const { data: row } = await supabase
    .from("subscription_pauses")
    .select("id, paused_until")
    .eq("user_id", auth.user.id)
    .is("resumed_at", null)
    .order("paused_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!row) return { ok: false, error: "no_active_pause" };

  const { error } = await supabase
    .from("subscription_pauses")
    .update({ resumed_at: new Date().toISOString() })
    .eq("id", (row as { id: string }).id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/[locale]/account", "layout");
  revalidatePath("/[locale]/my/journey", "layout");
  return { ok: true, pausedUntil: (row as { paused_until: string }).paused_until };
}
