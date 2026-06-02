/**
 * GET /api/journey/analyze
 *
 * Returns the latest Analysis for the authenticated user.
 * Also supports POST to force recompute (used after admin editing answers).
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { analyze } from "@/lib/journey/analysis";
import { analyzeAssessment } from "@/lib/ai/analyze-assessment";
import { getPriorityLabels } from "@/lib/journey-content/priority-categories";
import type { AnswerValue, Locale, Response } from "@/lib/journey/types";

export const dynamic = "force-dynamic";

export async function GET() {
  // Auth via session client, CRUD via admin client — same flaky-JWT
  // workaround as POST below. See `project_supabase_ssr_rls_pattern`
  // memory + the comment block at the top of POST.
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn("[api/journey/analyze GET] 401 — no user from session");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  console.log("[api/journey/analyze GET] user resolved", { userId: user.id });

  const admin = createAdminSupabaseClient();
  const { data: analysis, error } = await admin
    .from("journey_analysis")
    .select("*")
    .eq("user_id", user.id)
    .order("computed_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[api/journey/analyze GET] select error", {
      message: error.message,
      code: error.code,
    });
  }
  console.log("[api/journey/analyze GET] result", {
    userId: user.id,
    hasAnalysis: !!analysis,
    analysisId: analysis?.id ?? null,
    computedAt: analysis?.computed_at ?? null,
  });

  return NextResponse.json({ analysis });
}

export async function POST() {
  // ── Auth resolution via SESSION client ──
  // The @supabase/ssr JWT→PostgREST handshake is flaky on subsequent
  // queries (auth.uid() randomly returns NULL inside RLS), so we only
  // use the session client to identify the user and then switch to the
  // admin client for the actual CRUD. Documented pattern across this
  // project — see `project_supabase_ssr_rls_pattern` memory and other
  // routes that follow this same shape.
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.warn("[api/journey/analyze POST] 401 — no user from session");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  console.log("[api/journey/analyze POST] user resolved", { userId: user.id });

  // ── CRUD via ADMIN client (bypasses RLS) ──
  // `auth.uid()`-based RLS on `journeys`/`journey_responses`/
  // `journey_analysis` was returning 0 rows for the legitimately-
  // signed-in user (2026-05-19 incident: session client saw 0 rows,
  // admin probe saw 1 row for the same user_id). All filtering is
  // scoped by `user.id` we just resolved, so dropping RLS is safe.
  const admin = createAdminSupabaseClient();

  const { data: journey, error: journeyErr } = await admin
    .from("journeys")
    .select("id, device_id, user_id, status, current_step, last_activity_at")
    .eq("user_id", user.id)
    .order("last_activity_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (journeyErr) {
    console.warn("[api/journey/analyze POST] journey select error", {
      message: journeyErr.message,
      code: journeyErr.code,
    });
  }

  if (!journey) {
    // ── DIAGNOSTIC PROBE ──
    // Admin client returned 0 journeys for this user — but the user
    // just completed an assessment, so a journey MUST exist somewhere.
    // Two scenarios to distinguish:
    //   (a) Anon journey was created (device_id, user_id=NULL) and
    //       the signup→link step in `journey-inline-signup` failed
    //       silently — journey is orphaned.
    //   (b) The journey was linked but to a DIFFERENT user_id (e.g.
    //       race condition where the signed-in user is not the one
    //       that holds the journey).
    let probe:
      | {
          recentAnonJourneys: Array<{
            id: string;
            device_id: string | null;
            status: string;
            current_step: number;
            last_activity_at: string | null;
          }>;
          recentAnonResponseCounts: Record<string, number>;
          anyJourneyForUserAcrossStatuses: number;
        }
      | { error: string } = {
      recentAnonJourneys: [],
      recentAnonResponseCounts: {},
      anyJourneyForUserAcrossStatuses: 0,
    };
    try {
      const [{ data: anonRows }, { count: userAnyCount }] = await Promise.all([
        admin
          .from("journeys")
          .select("id, device_id, status, current_step, last_activity_at")
          .is("user_id", null)
          .order("last_activity_at", { ascending: false })
          .limit(10),
        // sanity-check: confirm we really see 0 for this user across
        // ALL statuses, no filter at all.
        admin
          .from("journeys")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id),
      ]);

      // For each anon journey, count its responses — that tells us
      // which one the user actually filled out. The signup link
      // should have grabbed the one with the most responses.
      const anonRowsList = (anonRows ?? []) as Array<{
        id: string;
        device_id: string | null;
        status: string;
        current_step: number;
        last_activity_at: string | null;
      }>;
      const responseCounts: Record<string, number> = {};
      for (const j of anonRowsList) {
        const { count } = await admin
          .from("journey_responses")
          .select("question_id", { count: "exact", head: true })
          .eq("journey_id", j.id);
        responseCounts[j.id] = count ?? 0;
      }

      probe = {
        recentAnonJourneys: anonRowsList,
        recentAnonResponseCounts: responseCounts,
        anyJourneyForUserAcrossStatuses: userAnyCount ?? 0,
      };
    } catch (e) {
      probe = { error: e instanceof Error ? e.message : String(e) };
    }
    console.warn("[api/journey/analyze POST] 404 no_journey for user", {
      userId: user.id,
      adminClientSawError: journeyErr?.message ?? null,
      probe,
    });
    return NextResponse.json(
      { error: "no_journey", userId: user.id, probe },
      { status: 404 },
    );
  }

  console.log("[api/journey/analyze POST] journey resolved", {
    journeyId: journey.id,
    journeyUserId: journey.user_id,
    journeyDeviceId: journey.device_id,
    status: journey.status,
    currentStep: journey.current_step,
    lastActivity: journey.last_activity_at,
  });

  const { data: rows, error: rowsErr } = await admin
    .from("journey_responses")
    .select("question_id, answer, locale")
    .eq("journey_id", journey.id);

  if (rowsErr) {
    console.warn("[api/journey/analyze POST] journey_responses select error", {
      journeyId: journey.id,
      message: rowsErr.message,
      code: rowsErr.code,
    });
  }
  console.log("[api/journey/analyze POST] responses loaded", {
    journeyId: journey.id,
    responseCount: rows?.length ?? 0,
  });

  const responses: Response[] = (rows ?? []).map((r) => ({
    question_id: r.question_id,
    answer: r.answer as AnswerValue,
    locale: r.locale as Locale,
  }));
  const priorityLabels = await getPriorityLabels();
  const analysis = analyze(responses, priorityLabels);

  // ── AI hero generation (2026-06-02) ──
  // Best-effort enrichment. We fetch the user's profile name + gender +
  // demographic answers, hand them to Claude Sonnet 4.6 along with the
  // deterministic Analysis, and stamp the returned AiHeroBlock into
  // summary.ai_hero. On any failure (rate-limit, parse error, missing
  // key, network) we log and continue with summary.ai_hero=null - the
  // UI falls back to the deterministic narrative. The AI call NEVER
  // blocks the persistence of the assessment.
  try {
    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, gender")
      .eq("id", user.id)
      .maybeSingle();

    const firstName = (() => {
      const full = (profile?.full_name ?? "").trim();
      if (!full) return null;
      // Heuristic: first whitespace-separated token, capped at 30 chars.
      // Hebrew names tend to be a single word in this field; English may
      // be "First Last".
      return full.split(/\s+/)[0].slice(0, 30);
    })();

    // Demographic labels - pull HE labels off the matching question option.
    const yearsAnswer = responses.find((r) => r.question_id === "q_relationship_years");
    const kidsAnswer = responses.find((r) => r.question_id === "q_kids_count");
    const yearsLabel = yearsAnswer && yearsAnswer.answer.kind === "single"
      ? yearsAnswer.answer.option
      : null;
    const kidsLabel = kidsAnswer && kidsAnswer.answer.kind === "single"
      ? kidsAnswer.answer.option
      : null;

    const aiHero = await analyzeAssessment({
      analysis,
      responses,
      user_name: firstName,
      gender: profile?.gender ?? null,
      relationship_years_label: yearsLabel,
      kids_count_label: kidsLabel,
    });
    analysis.summary.ai_hero = aiHero;
    console.log("[api/journey/analyze POST] ai_hero", {
      userId: user.id,
      generated: !!aiHero,
      expert: aiHero?.expert_mentioned ?? null,
      signal: aiHero?.pain_signal ?? null,
    });
  } catch (e) {
    console.warn("[api/journey/analyze POST] ai_hero threw, falling back", {
      userId: user.id,
      err: e instanceof Error ? e.message : String(e),
    });
    analysis.summary.ai_hero = null;
  }

  const { error: insertErr } = await admin.from("journey_analysis").insert({
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

  if (insertErr) {
    console.warn("[api/journey/analyze POST] journey_analysis insert error", {
      journeyId: journey.id,
      userId: user.id,
      message: insertErr.message,
      code: insertErr.code,
    });
  }

  console.log("[api/journey/analyze POST] success", {
    userId: user.id,
    journeyId: journey.id,
    responseCount: responses.length,
    summaryPresent: !!analysis.summary,
  });

  return NextResponse.json({ analysis });
}
