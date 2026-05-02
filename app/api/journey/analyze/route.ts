/**
 * GET /api/journey/analyze
 *
 * Returns the latest Analysis for the authenticated user.
 * Also supports POST to force recompute (used after admin editing answers).
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { analyze } from "@/lib/journey/analysis";
import { getPriorityLabels } from "@/lib/journey-content/priority-categories";
import type { AnswerValue, Locale, Response } from "@/lib/journey/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: analysis } = await supabase
    .from("journey_analysis")
    .select("*")
    .eq("user_id", user.id)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ analysis });
}

export async function POST() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: journey } = await supabase
    .from("journeys")
    .select("id")
    .eq("user_id", user.id)
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!journey) return NextResponse.json({ error: "no_journey" }, { status: 404 });

  const { data: rows } = await supabase
    .from("journey_responses")
    .select("question_id, answer, locale")
    .eq("journey_id", journey.id);

  const responses: Response[] = (rows ?? []).map((r) => ({
    question_id: r.question_id,
    answer: r.answer as AnswerValue,
    locale: r.locale as Locale,
  }));
  const priorityLabels = await getPriorityLabels();
  const analysis = analyze(responses, priorityLabels);

  await supabase.from("journey_analysis").insert({
    journey_id: journey.id,
    user_id: user.id,
    axis_scores: analysis.axis_scores,
    friendship_score: analysis.friendship_score,
    conflict_health: analysis.conflict_health,
    passion_risk: analysis.passion_risk,
    primary_love_language: analysis.primary_love_language,
    secondary_love_language: analysis.secondary_love_language,
    top_gap: analysis.top_gap,
    four_horsemen_flag: analysis.four_horsemen_flag,
    summary: analysis.summary,
  });

  return NextResponse.json({ analysis });
}
