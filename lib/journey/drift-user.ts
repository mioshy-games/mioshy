/**
 * lib/journey/drift-user.ts
 *
 * User-facing drift state lookup. Returns the relevant drift_alerts
 * row for the current user (by couple membership), but ONLY when
 * the coach has actually reached out (coach_checked_in_at IS NOT
 * NULL). Pages use this to render the gentle "your coach reached
 * out" banner — never to surface automated guilt.
 *
 * Server-only.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface UserDriftBannerState {
  state:             "drifting" | "silent";
  coachCheckedInAt:  string;
  coachCheckedInBy:  string | null;
  daysSilent:        number | null;
}

const ONE_DAY_MS = 86_400_000;

export async function getDriftBannerForCurrentUser(): Promise<UserDriftBannerState | null> {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  // Resolve couple via membership.
  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const coupleId = (membership as { couple_id: string } | null)?.couple_id;
  if (!coupleId) return null;

  const { data: row } = await supabase
    .from("journey_drift_alerts")
    .select("state, coach_checked_in_at, coach_checked_in_by, last_response_at, last_message_at")
    .eq("couple_id", coupleId)
    .maybeSingle();
  if (!row) return null;

  const r = row as {
    state:               "active" | "drifting" | "silent";
    coach_checked_in_at: string | null;
    coach_checked_in_by: string | null;
    last_response_at:    string | null;
    last_message_at:     string | null;
  };
  if (r.state === "active") return null;
  if (!r.coach_checked_in_at) return null;

  // Days since last user signal (the same we drove the state from).
  const lastSignal =
    r.last_response_at && r.last_message_at
      ? new Date(r.last_response_at).getTime() > new Date(r.last_message_at).getTime()
        ? r.last_response_at
        : r.last_message_at
      : r.last_response_at ?? r.last_message_at;
  const daysSilent = lastSignal
    ? Math.floor((Date.now() - new Date(lastSignal).getTime()) / ONE_DAY_MS)
    : null;

  return {
    state:            r.state,
    coachCheckedInAt: r.coach_checked_in_at,
    coachCheckedInBy: r.coach_checked_in_by,
    daysSilent,
  };
}
