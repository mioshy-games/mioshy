/**
 * POST /api/journey/answer
 *
 * Body: { question_id, answer: {kind,...}, locale, language?, device_id? }
 *
 *  - Creates (or reuses) the caller's in-progress journey row.
 *  - Validates the answer shape matches the question type in the static bank.
 *  - Upserts into journey_responses.
 *  - Advances `current_step` and enforces gating (auth, paywall).
 *  - If the final question is answered, kicks off analysis and returns the
 *    Analysis object.
 *
 * Hardening (2026-04):
 *  - Auth is resolved with the session-scoped client, but every write goes
 *    through the service-role admin client. Reason: @supabase/ssr cookies
 *    occasionally land in a state where `getUser()` returns the correct
 *    user but the JWT isn't propagated to PostgREST in the same request,
 *    so `auth.uid()` is null during RLS checks. That was showing up as a
 *    `journey_create_failed` on the very first Q1 answer. Using admin
 *    client also sidesteps the `journey_responses_by_owner` policy, which
 *    doesn't allow the anonymous (device_id-only) write path - a real bug
 *    for Q1-Q5 that no user would hit through RLS.
 *  - `trusted_user_id` is authoritative (from the session cookie) - we
 *    never read `user_id` from the request body.
 *  - Per-(ip + device_id) sliding-window rate limit guards against script
 *    floods answering every question in a tight loop.
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase-admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import {
  QUESTIONNAIRE,
  requiresAuthAt,
  requiresPaywallAt,
} from "@/lib/journey/questions";
import { analyze } from "@/lib/journey/analysis";
import {
  buildQuestionResolver,
  loadJourneyQuestions,
} from "@/lib/journey/questions-db";
import { resolveJourneyFlow } from "@/lib/journey/phase";
import { computeGate, reportPhaseForMode } from "@/lib/journey/gating";
import { isValidOrder } from "@/lib/journey/priorities";
import { getPriorityLabels } from "@/lib/journey-content/priority-categories";
import { onPriorityRankingSubmitted } from "@/lib/journey-content/cadence-trigger";
import { getUserEntitlements } from "@/lib/entitlements/getUserEntitlements";
import type { AnswerValue, Locale, Response } from "@/lib/journey/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AnswerPayload {
  question_id: string;
  answer: AnswerValue;
  locale: Locale;
  language?: Locale;
  device_id?: string;
}

function isValidAnswer(qType: string, answer: AnswerValue): boolean {
  switch (qType) {
    case "likert5":
      return answer.kind === "likert" && [1, 2, 3, 4, 5].includes(answer.value);
    case "forced_choice":
    case "single_choice":
      return answer.kind === "single" && typeof answer.option === "string";
    case "multi_choice":
      return answer.kind === "multi" && Array.isArray(answer.options);
    case "reflection":
      return answer.kind === "text" && typeof answer.text === "string";
    case "ranking":
      // Must be an exact permutation of PRIORITY_KEYS - no missing slug,
      // no extras, no duplicates. isValidOrder is the same helper the
      // client uses pre-submit, so client and server agree on the shape.
      return answer.kind === "ranking" && isValidOrder(answer.order);
    default:
      return false;
  }
}

export async function POST(req: Request) {
  let body: AnswerPayload;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const { question_id, answer, locale } = body;

  // F2 — resolve question definitions from the DB (journey_questions), so
  // admin-added / edited questions are accepted by validation and scored on
  // completion. loadJourneyQuestions falls back to questionnaire.json when the
  // table is empty or the read fails. Built once here (service-role client) and
  // reused for the completion analyze() call below.
  const admin = await createAdminClient();
  const resolveQuestion = buildQuestionResolver(await loadJourneyQuestions(admin));
  const q = resolveQuestion(question_id);
  if (!q) return NextResponse.json({ error: "unknown_question" }, { status: 400 });
  if (!isValidAnswer(q.type, answer))
    return NextResponse.json({ error: "invalid_answer_shape", expected: q.type }, { status: 400 });

  // ── Auth resolution (session client) ────────────────────────────────────────
  // We use the session-scoped client ONLY to resolve who the caller is. All
  // writes happen through the admin client below so we aren't subject to any
  // transient RLS / JWT-propagation flakes.
  let trusted_user_id: string | null = null;
  try {
    const supa = await createServerSupabaseClient();
    const { data: { user } } = await supa.auth.getUser();
    trusted_user_id = user?.id ?? null;
  } catch {
    trusted_user_id = null;
  }

  const deviceId =
    (typeof body.device_id === "string" && body.device_id.length > 8
      ? body.device_id
      : null) ??
    req.headers.get("x-device-id") ??
    null;

  if (!trusted_user_id && (!deviceId || deviceId.length < 9)) {
    return NextResponse.json({ error: "missing_identity" }, { status: 400 });
  }

  // ── Rate limit: 120 answers / 10 min per (ip + identity) ───────────────────
  const ip       = getClientIp(req);
  const rateKey  = `journey:answer:${ip}:${trusted_user_id ?? deviceId}`;
  const rl       = checkRateLimit(rateKey, 120, 600);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  // ── Question index + gating ─────────────────────────────────────────────────
  const index = QUESTIONNAIRE.questions.findIndex((x) => x.id === question_id);
  if (index < 0) return NextResponse.json({ error: "unknown_question_index" }, { status: 400 });

  // If the index requires auth and caller is anon → reject.
  if (requiresAuthAt(index - 1) && !trusted_user_id) {
    return NextResponse.json(
      { error: "auth_required", at: QUESTIONNAIRE.gating.auth_after_index },
      { status: 401 },
    );
  }

  // Paywall: check active subscription if the index requires it.
  if (requiresPaywallAt(index - 1) && trusted_user_id) {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("status")
      .eq("user_id", trusted_user_id)
      .eq("status", "active")
      .maybeSingle();
    if (!sub) {
      return NextResponse.json(
        { error: "paywall_required", at: QUESTIONNAIRE.gating.paywall_after_index },
        { status: 402 },
      );
    }
  }

  // ── Find or create journey ─────────────────────────────────────────────────
  // Prefer the authed journey if present. If the user just signed up mid-flow
  // we also claim any prior anon-by-device row by linking it to their user_id
  // (mirrors link_journey_to_user's intent without a round-trip RPC).
  let journeyId: string | undefined;

  if (trusted_user_id) {
    const { data: existingAuthed } = await admin
      .from("journeys")
      .select("id")
      .eq("user_id", trusted_user_id)
      .in("status", ["in_progress", "paywall"])
      .order("last_activity_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    journeyId = existingAuthed?.id;

    // Claim anon journey by device_id, if any, once the user signs in.
    // Status filter includes terminal rows (complete/completed) too: a user
    // who finished the anon assessment and only then signs in must REUSE that
    // row — not spawn a fresh in_progress journey below, which would drop the
    // prior answers and re-ask the questions (funnel regression).
    if (!journeyId && deviceId) {
      const { data: anonJourney } = await admin
        .from("journeys")
        .select("id")
        .eq("device_id", deviceId)
        .is("user_id", null)
        .in("status", ["in_progress", "paywall", "complete", "completed"])
        .order("last_activity_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (anonJourney?.id) {
        await admin
          .from("journeys")
          .update({ user_id: trusted_user_id, device_id: null })
          .eq("id", anonJourney.id);
        journeyId = anonJourney.id;

        // Backfill profile.gender from a previously-anon q_gender answer.
        // The user just claimed their journey, so any answers stored against
        // it (including q_gender from earlier in the assessment) should be
        // mirrored onto their fresh profile row. Idempotent - a no-op if
        // the user never answered q_gender.
        const { data: genderRow } = await admin
          .from("journey_responses")
          .select("answer")
          .eq("journey_id", anonJourney.id)
          .eq("question_id", "q_gender")
          .maybeSingle();
        const ans = genderRow?.answer as AnswerValue | undefined;
        if (
          ans &&
          ans.kind === "single" &&
          typeof ans.option === "string" &&
          ["male", "female", "other"].includes(ans.option)
        ) {
          const { error: gErr } = await admin
            .from("profiles")
            .update({ gender: ans.option })
            .eq("id", trusted_user_id);
          if (gErr) {
            console.warn(
              "[journey/answer] anon-claim gender backfill failed",
              gErr.message,
            );
          }
        }
      }
    }
  } else if (deviceId) {
    const { data: existingAnon } = await admin
      .from("journeys")
      .select("id")
      .eq("device_id", deviceId)
      .is("user_id", null)
      .in("status", ["in_progress", "paywall"])
      .order("last_activity_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    journeyId = existingAnon?.id;
  }

  if (!journeyId) {
    const { data: newJourney, error: insertErr } = await admin
      .from("journeys")
      .insert({
        user_id: trusted_user_id,
        device_id: trusted_user_id ? null : deviceId,
        language: body.language ?? locale ?? "he",
        status: "in_progress",
        current_step: 0,
      })
      .select("id")
      .single();
    if (insertErr) {
      console.error("[journey/answer] journey insert failed", insertErr);
      return NextResponse.json(
        { error: "journey_create_failed", detail: insertErr.message },
        { status: 500 },
      );
    }
    journeyId = newJourney.id;
  }

  // ── Persist the answer (upsert by (journey_id, question_id)) ───────────────
  const { error: upsertErr } = await admin
    .from("journey_responses")
    .upsert(
      { journey_id: journeyId, question_id, answer, locale },
      { onConflict: "journey_id,question_id" },
    );
  if (upsertErr) {
    console.error("[journey/answer] answer upsert failed", upsertErr);
    return NextResponse.json(
      { error: "answer_save_failed", detail: upsertErr.message },
      { status: 500 },
    );
  }

  // ── Side-effect: v3 cadence engine day-1 trigger ───────────────────────────
  // When the priority ranking is submitted, persist it into
  // journey_user_priorities and (if the user is journey-entitled)
  // materialize the first item so it shows up immediately on /my/journey.
  // Best-effort - failures are logged but don't block the answer save.
  if (
    question_id === "q_priorities" &&
    trusted_user_id &&
    answer.kind === "ranking"
  ) {
    try {
      const dayOne = await onPriorityRankingSubmitted(
        trusted_user_id,
        answer.order,
      );
      console.log("[journey/answer] day-1 cadence trigger", {
        user_id: trusted_user_id,
        prioritiesSaved: dayOne.prioritiesSaved,
        materialized: dayOne.materialized?.ok ?? null,
        skipReason: dayOne.skipReason,
        error: dayOne.error,
      });
    } catch (e) {
      console.warn(
        "[journey/answer] day-1 cadence trigger threw - non-fatal",
        e,
      );
    }
  }

  // ── Side-effect: persist gender to profiles when q_gender is answered ──────
  // The questionnaire's q_gender is a forced_choice with option ids that
  // match profiles.gender values ('male' | 'female' | 'other'). If the user
  // is already authed at answer time, mirror it onto the profile row right
  // away. Anon flows are caught by the backfill below (after journey claim).
  if (
    question_id === "q_gender" &&
    trusted_user_id &&
    answer.kind === "single" &&
    typeof answer.option === "string" &&
    ["male", "female", "other"].includes(answer.option)
  ) {
    const { error: gErr } = await admin
      .from("profiles")
      .update({ gender: answer.option })
      .eq("id", trusted_user_id);
    if (gErr) {
      console.warn("[journey/answer] gender update failed", gErr.message);
    }
  }

  // ── F3.2 — phase-aware completion + gating ───────────────────────────────────
  const nextStep = index + 1; // kept for back-compat logging (client uses its
                              // own local index over the served `remaining`).

  // Subscription drives the active phase (short pre-purchase / full post).
  let subscriptionActive = false;
  if (trusted_user_id) {
    const { data: sub } = await admin
      .from("subscriptions")
      .select("status")
      .eq("user_id", trusted_user_id)
      .eq("status", "active")
      .maybeSingle();
    // Partner fix (funnel): journey access can come via the couple entitlement
    // (owner-swapped inside getUserEntitlements) with NO direct subscription
    // row. Reading the phase mode from the direct sub alone left a deferred
    // partner stuck in 'short' and bounced to the paywall mid-flow. Fold the
    // entitlement in so the mode + gate treat partner access as subscribed.
    const entitlements = await getUserEntitlements(trusted_user_id);
    subscriptionActive = !!sub || !!entitlements?.journey;
  }

  // All answers for this journey (includes the one just upserted) → drives the
  // answer-driven active set + completion.
  const { data: allResponses } = await admin
    .from("journey_responses")
    .select("question_id, answer, locale")
    .eq("journey_id", journeyId);
  const parsed: Response[] = (allResponses ?? []).map((r) => ({
    question_id: r.question_id,
    answer:      r.answer as AnswerValue,
    locale:      r.locale as Locale,
  }));
  const answeredSlugs = new Set(parsed.map((r) => r.question_id));

  // SAME helper + SAME gate the client uses → no client/server boundary drift.
  const flow = await resolveJourneyFlow({ client: admin, subscriptionActive, answeredSlugs });
  const gate = computeGate({
    mode: flow.mode,
    phaseTotal: flow.phaseTotal,
    answeredInPhaseCount: flow.answeredInPhaseCount,
    authenticated: !!trusted_user_id,
    subscriptionActive,
  });
  const reportPhase = reportPhaseForMode(flow.mode); // 'short' | 'full'
  const isComplete  = gate.phaseComplete;
  // short complete → 'paywall' (awaiting purchase); full/single complete → 'complete'.
  const newStatus = isComplete
    ? (reportPhase === "full" ? "complete" : "paywall")
    : "in_progress";

  await admin
    .from("journeys")
    .update({
      current_step:     flow.answeredInPhaseCount, // phase-relative cache
      status:           newStatus,
      last_activity_at: new Date().toISOString(),
      completed_at:     isComplete && reportPhase === "full" ? new Date().toISOString() : null,
    })
    .eq("id", journeyId);

  // Task 20 (personal_window) — stamp the 48h intro-offer deadline the FIRST
  // time the SHORT assessment completes. `.is(offer_expires_at, null)` makes it
  // set-once (re-submits / later full completion never extend or reset it).
  if (isComplete && reportPhase === "short") {
    await admin
      .from("journeys")
      .update({
        offer_expires_at: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      })
      .eq("id", journeyId)
      .is("offer_expires_at", null);
  }

  // ── Audit ───────────────────────────────────────────────────────────────────
  await admin.from("activity_logs").insert({
    user_id:  trusted_user_id,
    actor_id: trusted_user_id,
    action:   "answer_saved",
    metadata: { question_id, index, journey_id: journeyId, mode: flow.mode },
  });

  // ── Compute analysis eagerly on PHASE completion ───────────────────────────
  // Short report = analyze over short answers only; full report = short ∪ full.
  // (For full/single modes phaseSet is the whole set, so the filter is a no-op.)
  let analysis = null;
  if (isComplete) {
    const phaseSlugs = new Set(flow.phaseSet.map((qd) => qd.id));
    const phaseResponses = parsed.filter((r) => phaseSlugs.has(r.question_id));
    const priorityLabels = await getPriorityLabels();
    analysis = analyze(phaseResponses, priorityLabels, resolveQuestion);

    await admin.from("journey_analysis").insert({
      journey_id:              journeyId,
      user_id:                 trusted_user_id,
      axis_scores:             analysis.axis_scores,
      friendship_score:        analysis.friendship_score,
      conflict_health:         analysis.conflict_health,
      passion_risk:            analysis.passion_risk,
      primary_love_language:   analysis.primary_love_language,
      secondary_love_language: analysis.secondary_love_language,
      top_gap:                 analysis.top_gap,
      four_horsemen_flag:      analysis.four_horsemen_flag,
      summary:                 analysis.summary,
      report_phase:            reportPhase, // F1 column 119; 'short' | 'full'
    });
  }

  return NextResponse.json({
    ok:         true,
    journey_id: journeyId,
    next_index: nextStep,
    status:     newStatus,
    // F3.2 — authoritative gate the client adopts.
    gate: {
      mode:          flow.mode,
      phaseComplete: gate.phaseComplete,
      needsAuth:     gate.needsAuth,
      needsPaywall:  gate.needsPaywall,
    },
    analysis,
  });
}
