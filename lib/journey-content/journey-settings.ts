// ============================================================
// Journey settings - singleton row in journey_settings (id=1) holding
// platform-wide defaults for cadence, random rate, delivery days,
// priority weights, and the auto-skip threshold.
//
// These defaults are read by:
//   * Slice 3 cadence engine - to know how often to materialize items.
//   * /my/journey banner - to render the user's effective schedule
//     when they haven't customized.
//   * Group cadence resolution - group overrides shadow these defaults.
//   * Per-user profile overrides - NULL on profiles means "use these".
//
// Server-only fetcher. RLS allows any authenticated read.
// ============================================================

import "server-only";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export interface JourneySettings {
  /** Default = 1. Platform-wide cadence (curated items per week). */
  defaultCuratedPerWeek: number;
  /** Default = 0. Platform-wide random/discovery items per week. */
  defaultRandomPerWeek: number;
  /** Default = [1] (Monday). Days of week, 0=Sun..6=Sat. */
  defaultDeliveryDays: number[];
  /** Default = 9. Hour of day in user's local timezone. */
  defaultDeliveryLocalHour: number;
  /** Default = [0.50, 0.25, 0.15, 0.07, 0.03]. Weights across ranking
   *  slots #1..#N. Sum should be ~1 but isn't enforced. */
  defaultPriorityWeights: number[];
  /** Default = 14. Days after which an unresponded item auto-marks skipped. */
  autoSkipAfterDays: number;
  updatedAt: string;
}

const DEFAULT_FALLBACK: JourneySettings = {
  defaultCuratedPerWeek: 1,
  defaultRandomPerWeek: 0,
  defaultDeliveryDays: [1],
  defaultDeliveryLocalHour: 9,
  defaultPriorityWeights: [0.5, 0.25, 0.15, 0.07, 0.03],
  autoSkipAfterDays: 14,
  updatedAt: new Date(0).toISOString(),
};

/**
 * Returns the singleton journey_settings row. If the row is missing
 * (which would mean migration 055 didn't run / seed didn't insert),
 * returns the in-code defaults rather than throwing - the cadence
 * engine should still function with sane defaults during a deploy
 * window where the migration ran but the seed somehow failed.
 *
 * Logs a warning when falling back so the issue surfaces in
 * observability without breaking user-facing pages.
 */
export async function getJourneySettings(): Promise<JourneySettings> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("journey_settings")
    .select(
      "default_curated_per_week, default_random_per_week, default_delivery_days, default_delivery_local_hour, default_priority_weights, auto_skip_after_days, updated_at",
    )
    .eq("id", 1)
    .maybeSingle();

  if (error) {
    console.warn(
      `[journey-settings] read failed (${error.code}): ${error.message} - using fallback defaults`,
    );
    return DEFAULT_FALLBACK;
  }
  if (!data) {
    console.warn(
      "[journey-settings] singleton row missing - using fallback defaults. Run migration 055.",
    );
    return DEFAULT_FALLBACK;
  }
  return {
    defaultCuratedPerWeek: data.default_curated_per_week as number,
    defaultRandomPerWeek: data.default_random_per_week as number,
    defaultDeliveryDays: (data.default_delivery_days as number[]) ?? [1],
    defaultDeliveryLocalHour: data.default_delivery_local_hour as number,
    defaultPriorityWeights:
      (data.default_priority_weights as number[]) ??
      DEFAULT_FALLBACK.defaultPriorityWeights,
    autoSkipAfterDays: data.auto_skip_after_days as number,
    updatedAt: data.updated_at as string,
  };
}

/**
 * Resolve a user's effective delivery days by overlaying their profile
 * override on top of the platform default. NULL on the profile means
 * "use the platform default".
 */
export function effectiveDeliveryDays(
  settings: JourneySettings,
  profileOverride: number[] | null,
): number[] {
  if (profileOverride && profileOverride.length > 0) return profileOverride;
  return settings.defaultDeliveryDays;
}

export function effectiveDeliveryLocalHour(
  settings: JourneySettings,
  profileOverride: number | null,
): number {
  if (profileOverride !== null && profileOverride !== undefined) {
    return profileOverride;
  }
  return settings.defaultDeliveryLocalHour;
}
