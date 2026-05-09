/**
 * lib/billing/pause-state.ts
 *
 * Read-side helper for the user's current pause state. Used by the
 * /account page (Layer-3 PauseSubscription component) and any future
 * surface that needs to know "is this user paused right now."
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface PauseState {
  isActive:    boolean;
  pausedUntil: string | null;
  pausedAt:    string | null;
  reason:      string | null;
}

export async function getCurrentUserPauseState(): Promise<PauseState> {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return { isActive: false, pausedUntil: null, pausedAt: null, reason: null };
  }

  const { data: row } = await supabase
    .from("subscription_pauses")
    .select("paused_at, paused_until, reason, resumed_at")
    .eq("user_id", auth.user.id)
    .is("resumed_at", null)
    .order("paused_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) {
    return { isActive: false, pausedUntil: null, pausedAt: null, reason: null };
  }

  const r = row as {
    paused_at:    string;
    paused_until: string;
    reason:       string;
    resumed_at:   string | null;
  };
  const isActive = new Date(r.paused_until).getTime() > Date.now();
  return {
    isActive,
    pausedUntil: r.paused_until,
    pausedAt:    r.paused_at,
    reason:      r.reason,
  };
}
