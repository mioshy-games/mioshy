/**
 * lib/journey/pacts.ts
 *
 * Read-side helper for journey_couple_pacts. The write path lives in
 * app/actions/journey-pact.ts. This module is server-side only —
 * route handlers and pages call it; client components do not.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface JourneyPact {
  id:                          string;
  couple_id:                   string | null;
  user_id:                     string | null;
  committed_minutes_per_week:  number;
  committed_weeks:             number;
  agreed_at:                   string;
  agreed_by_user_id:           string;
  honoured_through_week:       number | null;
}

/**
 * Pull the pact (if any) for the current authenticated user. Looks at
 * BOTH solo pacts (user_id = current) AND couple pacts via couple
 * membership. Returns null when no pact exists yet.
 */
export async function getCurrentUserPact(): Promise<JourneyPact | null> {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  // Solo first — usually the only path before pairing.
  const { data: solo } = await supabase
    .from("journey_couple_pacts")
    .select("*")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (solo) return solo as JourneyPact;

  // Couple membership lookup.
  const { data: membership } = await supabase
    .from("couple_members")
    .select("couple_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  const coupleId = (membership as { couple_id: string } | null)?.couple_id;
  if (!coupleId) return null;

  const { data: couple } = await supabase
    .from("journey_couple_pacts")
    .select("*")
    .eq("couple_id", coupleId)
    .maybeSingle();

  return (couple as JourneyPact | null) ?? null;
}

/**
 * Compute weeks remaining on the pact, capped at 0 below.
 * Returns null when the pact has no agreed_at (shouldn't happen).
 */
export function pactWeeksRemaining(pact: JourneyPact, now = new Date()): number {
  const start = new Date(pact.agreed_at);
  if (Number.isNaN(start.getTime())) return pact.committed_weeks;
  const elapsedWeeks = Math.floor(
    (now.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000),
  );
  return Math.max(0, pact.committed_weeks - elapsedWeeks);
}
