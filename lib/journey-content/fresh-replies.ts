"use server";

/**
 * lib/journey-content/fresh-replies.ts
 *
 * Server-side query that returns the most recent clinician reply for
 * a user, plus a count of replies in the last 30 days. Used by the
 * ClinicianReplyBanner on /my/journey (Phase 2F).
 *
 * RLS note: we use the session client. Migration 035 lets the user
 * SELECT their own journey_item_responses rows, and we filter on
 * user_id = auth.uid() implicitly via the policy. The clinician_*
 * columns are returned to the user - they're not sensitive (the user
 * already has a right to see what their clinician wrote about their
 * own responses).
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface FreshClinicianReplies {
  /** ISO timestamp of the latest clinician_replied_at, or null. */
  latestReplyAt: string | null;
  /** Number of distinct responses with a clinician reply in the last
   *  30 days. Used by the banner to say "3 תגובות חדשות" when it
   *  applies. */
  recentReplyCount: number;
  /** Deep-link to the item the latest reply is on, when known. */
  latestReplyHref: string | null;
}

const RECENT_WINDOW_DAYS = 30;

export async function getFreshClinicianReplies(
  userId: string,
): Promise<FreshClinicianReplies> {
  const empty: FreshClinicianReplies = {
    latestReplyAt: null,
    recentReplyCount: 0,
    latestReplyHref: null,
  };

  if (!userId) return empty;

  try {
    const supabase = await createServerSupabaseClient();
    const cutoffIso = new Date(
      Date.now() - RECENT_WINDOW_DAYS * 24 * 3600 * 1000,
    ).toISOString();

    const { data, error } = await supabase
      .from("journey_item_responses")
      .select("scheduled_item_id, clinician_replied_at")
      .eq("user_id", userId)
      .not("clinician_reply_text", "is", null)
      .gte("clinician_replied_at", cutoffIso)
      .order("clinician_replied_at", { ascending: false });

    if (error || !data || data.length === 0) return empty;

    const latest = data[0];
    return {
      latestReplyAt: (latest.clinician_replied_at as string | null) ?? null,
      recentReplyCount: data.length,
      latestReplyHref: latest.scheduled_item_id
        ? `/journey/timeline/${latest.scheduled_item_id}`
        : null,
    };
  } catch (err) {
    console.error("[getFreshClinicianReplies] failed", err);
    return empty;
  }
}
