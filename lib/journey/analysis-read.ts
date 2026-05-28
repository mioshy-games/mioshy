// ============================================================
// lib/journey/analysis-read.ts
//
// Server-side helper that loads the latest computed
// `journey_analysis` row for a user, shaped as the public
// `Analysis` type so it can drop straight into
// AnalysisSummary / JourneyAnalysisCard.
//
// 2026-05-28 — added per Itzik. Before this, the assessment
// analysis row was written on completion (api/journey/answer →
// journey_analysis INSERT) but **no user-facing page read it**.
// `/my/journey` showed the dashboard chrome and `/journey/timeline`
// showed an empty list — neither surfaced the actual numbers/
// narrative the user had just generated. This helper closes that
// gap.
//
// Reads via service-role to bypass RLS — the caller is responsible
// for having already authenticated the user (we trust the userId
// argument to be the resolved effective user). The `journey_analysis`
// RLS policy `journey_analysis_self_select` would also allow this
// read under the user's own JWT, but the calling pages already use
// the admin client for adjacent reads so this stays consistent.
// ============================================================

import "server-only";
import { createServiceRoleClient } from "@/lib/supabase-admin";
import type {
  Analysis,
  AnalysisSummaryBilingual,
  AxisScoreMap,
  LoveLanguage,
  Axis,
} from "@/lib/journey/types";

/**
 * Loads the most recent `journey_analysis` row for the user and
 * returns it shaped as `Analysis`. Returns `null` when:
 *   - the user has no analysis row yet (never finished the assessment
 *     OR finished anonymously and the row never linked).
 *   - the service-role client isn't available (env misconfig).
 *   - the row exists but its `summary` JSONB is malformed.
 *
 * Never throws — read errors fall through as `null` so the caller
 * (a server component) can render an empty/skeleton state.
 */
export async function getLatestAnalysisForUser(
  userId: string,
): Promise<Analysis | null> {
  const admin = createServiceRoleClient();
  if (!admin) return null;

  const { data, error } = await admin
    .from("journey_analysis")
    .select(
      "axis_scores, friendship_score, conflict_health, passion_risk, primary_love_language, secondary_love_language, top_gap, four_horsemen_flag, summary",
    )
    .eq("user_id", userId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  // Defensive shape coercion. The DB columns are nullable / loosely
  // typed (numeric, text, jsonb), and `summary` is JSONB that the
  // analyze() pipeline owns. We validate the load-bearing fields
  // and let optional ones fall through.
  const row = data as {
    axis_scores: AxisScoreMap | null;
    friendship_score: number | string | null;
    conflict_health: number | string | null;
    passion_risk: number | string | null;
    primary_love_language: string | null;
    secondary_love_language: string | null;
    top_gap: string | null;
    four_horsemen_flag: boolean | null;
    summary: AnalysisSummaryBilingual | null;
  };

  if (!row.summary || typeof row.summary !== "object") return null;

  const toNumber = (v: number | string | null): number => {
    if (v === null) return 0;
    if (typeof v === "number") return v;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return {
    axis_scores: (row.axis_scores ?? {}) as AxisScoreMap,
    friendship_score: toNumber(row.friendship_score),
    conflict_health: toNumber(row.conflict_health),
    passion_risk: toNumber(row.passion_risk),
    primary_love_language: (row.primary_love_language ?? null) as LoveLanguage | null,
    secondary_love_language: (row.secondary_love_language ?? null) as LoveLanguage | null,
    top_gap: (row.top_gap ?? null) as Axis | null,
    four_horsemen_flag: !!row.four_horsemen_flag,
    summary: row.summary,
  };
}
