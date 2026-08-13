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
import {
  buildVersionedQuestionResolver,
  loadJourneyQuestions,
  loadJourneyQuestionVersions,
} from "@/lib/journey/questions-db";
import { analyzeAssessment } from "@/lib/ai/analyze-assessment";
import { buildFallbackHero } from "@/lib/journey/hero-fallback";
import { buildShortNarrative } from "@/lib/journey/short-narrative";
import { getPriorityLabels } from "@/lib/journey-content/priority-categories";
import { resolveJourneyFlow } from "@/lib/journey/phase";
import { reportPhaseForMode } from "@/lib/journey/gating";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
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
    .select("question_id, answer, locale, created_at")
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
    // Carries the answer's own timestamp into scoring so the resolver can pick
    // the question version that was live when it was given.
    created_at: r.created_at as string | undefined,
  }));
  const priorityLabels = await getPriorityLabels();

  // F1 — resolve question definitions (axes/weights/options) from the DB
  // (journey_questions), falling back to questionnaire.json if the table is
  // empty or the read fails. This only changes the SOURCE of the defs; the
  // scoring math is unchanged. Loaded via the admin client (service-role).
  const journeyQuestions = await loadJourneyQuestions(admin);
  // Date-resolved scoring: each answer is scored against the axis that was
  // correct when it was given (journey_question_versions). Seven questions were
  // rewritten in July 2026 without their axes following, so resolving by slug
  // alone mis-scores one cohort or the other — see migrations 195-197.
  const questionVersions = await loadJourneyQuestionVersions(admin);
  const resolveQuestion = buildVersionedQuestionResolver(journeyQuestions, questionVersions);
  const analysis = analyze(responses, priorityLabels, resolveQuestion);

  // ── Flow phase (short vs full) — decides the narrative source ──
  // Phase 2 (spec pull/mioshy-narrative-spec-phase2.md): the SHORT (pre-purchase)
  // flow never serves q20c/q22a, so the AI can't ground its narrative. For short
  // we skip the AI call entirely and render the deterministic templated
  // paragraph (Part A). FULL keeps the AI narrative (Part B). Resolved with the
  // same helper the assessment/answer routes use, so the mode never drifts.
  let subscriptionActive = false;
  {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("status")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing"])
      .maybeSingle();
    const entitlements = await getUserEntitlements(user.id);
    subscriptionActive = !!sub || !!entitlements?.journey;
  }
  const answeredSlugs = new Set(responses.map((r) => r.question_id));
  const flow = await resolveJourneyFlow({ client: admin, subscriptionActive, answeredSlugs });
  const reportPhase = reportPhaseForMode(flow.mode); // 'short' | 'full'

  if (reportPhase === "short") {
    // Short flow: no AI. Templated paragraph from the weakest + strongest
    // category (Part A). ai_hero is a deterministic fallback so anything reading
    // it stays intact; the on-screen H1 is a fixed CMS string regardless.
    const nowIso = new Date().toISOString();
    const cs = analysis.summary.category_scores;
    if (cs) {
      analysis.summary.narrative_he = buildShortNarrative(cs, true);
      analysis.summary.narrative_en = buildShortNarrative(cs, false);
    }
    analysis.summary.ai_hero = buildFallbackHero(
      analysis.summary.category_scores?.lowest_key,
      responses,
      nowIso,
    );
    analysis.summary.ai_hero_status = {
      ok: true,
      reason: "short_template",
      source: "short_template",
      attempts: 0,
      latency_ms: 0,
      at: nowIso,
    };
    console.log("[api/journey/analyze POST] short flow — templated narrative (no AI)", {
      userId: user.id,
      lowest: analysis.summary.category_scores?.lowest_key,
    });
  } else {
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

    const aiResult = await analyzeAssessment({
      analysis,
      responses,
      user_name: firstName,
      gender: profile?.gender ?? null,
      relationship_years_label: yearsLabel,
      kids_count_label: kidsLabel,
    });

    const nowIso = new Date().toISOString();
    if (aiResult.ok) {
      analysis.summary.ai_hero = aiResult.hero;
      // Phase 3 (2026-06-29) — the same Claude call now also returns an
      // answer-grounded personal-feedback narrative. When present, it replaces
      // the deterministic summary.narrative_he/en that the results screen
      // renders. On AI failure (else branch) the deterministic narrative,
      // already built upstream, stays as the fallback.
      if (aiResult.hero.narrative_he) {
        analysis.summary.narrative_he = aiResult.hero.narrative_he;
      }
      if (aiResult.hero.narrative_en) {
        analysis.summary.narrative_en = aiResult.hero.narrative_en;
      }
      analysis.summary.ai_hero_status = {
        ok: true,
        reason: "ok",
        source: "ai",
        attempts: aiResult.attempts,
        latency_ms: aiResult.latency_ms,
        at: nowIso,
      };
    } else {
      // AI failed — render the deterministic fallback (templated hero +
      // recs + fairness-guarded reflection echo) so the page keeps a
      // strong hero. ai_hero_status records WHY for observability.
      analysis.summary.ai_hero = buildFallbackHero(
        analysis.summary.category_scores?.lowest_key,
        responses,
        nowIso,
      );
      analysis.summary.ai_hero_status = {
        ok: false,
        reason: aiResult.reason,
        source: "fallback_template",
        attempts: aiResult.attempts,
        latency_ms: aiResult.latency_ms,
        at: nowIso,
      };
    }
    console.log("[api/journey/analyze POST] ai_hero", {
      userId: user.id,
      source: analysis.summary.ai_hero_status.source,
      reason: analysis.summary.ai_hero_status.reason,
      attempts: analysis.summary.ai_hero_status.attempts,
      latency_ms: analysis.summary.ai_hero_status.latency_ms,
      signal: analysis.summary.ai_hero?.pain_signal ?? null,
    });
  } catch (e) {
    // Anything around the AI path threw (profile fetch, etc.) — still
    // give the page a fallback hero rather than nothing.
    console.warn("[api/journey/analyze POST] ai_hero threw, using fallback", {
      userId: user.id,
      err: e instanceof Error ? e.message : String(e),
    });
    const nowIso = new Date().toISOString();
    analysis.summary.ai_hero = buildFallbackHero(
      analysis.summary.category_scores?.lowest_key,
      responses,
      nowIso,
    );
    analysis.summary.ai_hero_status = {
      ok: false,
      reason: "threw",
      source: "fallback_template",
      attempts: 0,
      latency_ms: 0,
      at: nowIso,
    };
  }
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
    report_phase: reportPhase,
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
