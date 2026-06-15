/**
 * lib/journey/full-assessment-pending.ts (F3.2)
 *
 * "Complete later" derived state — no new schema. A subscriber who saw the
 * SHORT report but hasn't finished the full assessment yet. Surfaced as a
 * minimal card on /my linking back into the (full) assessment.
 *
 * Derivation: subscribed AND the latest journey_analysis is a SHORT report AND
 * the journey isn't complete. Once the full set is finished, a 'full' analysis
 * row is inserted (newer) and the journey is 'complete' → card hides.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export function deriveFullAssessmentPending(input: {
  subscriptionActive: boolean;
  latestReportPhase: string | null;
  latestJourneyStatus: string | null;
}): boolean {
  return (
    input.subscriptionActive &&
    input.latestReportPhase === "short" &&
    input.latestJourneyStatus !== "complete"
  );
}

export async function isFullAssessmentPending(
  client: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const [{ data: sub }, { data: analysisRow }, { data: journeyRow }] =
      await Promise.all([
        client
          .from("subscriptions")
          .select("status")
          .eq("user_id", userId)
          .eq("status", "active")
          .maybeSingle(),
        client
          .from("journey_analysis")
          .select("report_phase")
          .eq("user_id", userId)
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        client
          .from("journeys")
          .select("status")
          .eq("user_id", userId)
          .order("last_activity_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    return deriveFullAssessmentPending({
      subscriptionActive: !!sub,
      latestReportPhase: (analysisRow?.report_phase as string | null) ?? null,
      latestJourneyStatus: (journeyRow?.status as string | null) ?? null,
    });
  } catch {
    return false;
  }
}
