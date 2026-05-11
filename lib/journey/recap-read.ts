/**
 * lib/journey/recap-read.ts
 *
 * Read-side helper for the most recent weekly recap that the
 * current user is allowed to see (their solo recap or their
 * couple's recap). RLS already enforces this; we keep one server-
 * side helper for tidy call sites.
 */

import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface LatestRecap {
  weekStarting:    string;
  summaryHe:       string;
  summaryEn:       string;
  notableSignals:  Record<string, unknown>;
}

export async function getLatestRecapForCurrentUser(): Promise<LatestRecap | null> {
  const supabase = await createServerSupabaseClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) return null;

  // RLS lets the user read both solo and couple-keyed recaps; we
  // grab the most recent of either by week_starting.
  const { data: row } = await supabase
    .from("journey_weekly_recaps")
    .select("week_starting, summary_he, summary_en, notable_signals")
    .order("week_starting", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row) return null;
  const r = row as {
    week_starting:   string;
    summary_he:      string;
    summary_en:      string;
    notable_signals: Record<string, unknown> | null;
  };
  return {
    weekStarting:   r.week_starting,
    summaryHe:      r.summary_he,
    summaryEn:      r.summary_en,
    notableSignals: r.notable_signals ?? {},
  };
}
