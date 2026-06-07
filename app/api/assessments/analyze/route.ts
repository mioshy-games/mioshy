/**
 * /api/assessments/analyze
 *
 * GET  ?assessment_id=intimacy  → latest stored result for the authed user.
 * POST { assessment_id }        → recompute: dimension scores + AI hero, then
 *                                 insert an assessment_results row.
 *
 * Auth via session client, CRUD via admin client (project_supabase_ssr_rls_pattern).
 * Touches ONLY assessment_* tables (+ a read of profiles for name/gender).
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { getAssessment } from "@/lib/assessments/catalog";
import { scoreAssessment } from "@/lib/assessments/scoring";
import { generateAssessmentHero } from "@/lib/assessments/ai-hero";
import type { AnswerValue, AssessmentResponse, Locale } from "@/lib/assessments/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const assessmentId = url.searchParams.get("assessment_id") ?? "";
  if (!getAssessment(assessmentId))
    return NextResponse.json({ error: "unknown_assessment" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminSupabaseClient();
  const { data: result } = await admin
    .from("assessment_results")
    .select("*")
    .eq("user_id", user.id)
    .eq("assessment_id", assessmentId)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({ result });
}

export async function POST(req: Request) {
  let assessmentId = "";
  try {
    const body = await req.json();
    assessmentId = typeof body?.assessment_id === "string" ? body.assessment_id : "";
  } catch {
    assessmentId = "";
  }

  const def = getAssessment(assessmentId);
  if (!def) return NextResponse.json({ error: "unknown_assessment" }, { status: 400 });

  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const admin = createAdminSupabaseClient();

  // Resolve the user's session for this assessment (most recent).
  const { data: session } = await admin
    .from("assessment_sessions")
    .select("id, status, current_step")
    .eq("user_id", user.id)
    .eq("assessment_id", assessmentId)
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!session) {
    return NextResponse.json({ error: "no_session", userId: user.id }, { status: 404 });
  }

  const { data: rows } = await admin
    .from("assessment_responses")
    .select("question_id, answer, locale")
    .eq("session_id", session.id);

  const responses: AssessmentResponse[] = (rows ?? []).map((r) => ({
    question_id: r.question_id,
    answer: r.answer as AnswerValue,
    locale: r.locale as Locale,
  }));

  const analysis = scoreAssessment(def, responses);

  // ── AI hero (best-effort; never blocks persistence) ────────────────────────
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, gender")
      .eq("id", user.id)
      .maybeSingle();

    const firstName = (() => {
      const full = (profile?.full_name ?? "").trim();
      return full ? full.split(/\s+/)[0].slice(0, 30) : null;
    })();

    const aiHero = await generateAssessmentHero({
      def,
      analysis,
      user_name: firstName,
      gender: profile?.gender ?? null,
    });
    analysis.summary.ai_hero = aiHero;
  } catch (e) {
    console.warn("[assessments/analyze] ai_hero threw, falling back", {
      err: e instanceof Error ? e.message : String(e),
    });
    analysis.summary.ai_hero = null;
  }

  const { error: insErr } = await admin.from("assessment_results").insert({
    session_id: session.id,
    assessment_id: assessmentId,
    user_id: user.id,
    dimension_scores: analysis.dimension_scores,
    weakest_dimensions: analysis.weakest_keys,
    open_answer: analysis.open_answer,
    summary: analysis.summary,
  });
  if (insErr) {
    console.warn("[assessments/analyze] result insert error", {
      message: insErr.message,
      code: insErr.code,
    });
  }

  return NextResponse.json({
    result: {
      assessment_id: assessmentId,
      dimension_scores: analysis.dimension_scores,
      weakest_dimensions: analysis.weakest_keys,
      open_answer: analysis.open_answer,
      summary: analysis.summary,
    },
  });
}
