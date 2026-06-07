/**
 * POST /api/assessments/answer
 *
 * Body: { assessment_id, question_id, answer:{kind,...}, locale, device_id? }
 *
 *  - Validates the answer shape matches the question type in the static bank.
 *  - Creates (or reuses) the caller's in-progress session for THIS assessment.
 *  - Claims an anonymous (device-only) session once the user signs in.
 *  - Upserts into assessment_responses, advances current_step.
 *  - Whole assessment is free; there is no mid-flow paywall. Registration
 *    happens client-side after the last question (the analyze route requires
 *    auth). So this route allows the full anonymous answer path.
 *
 * Isolation: touches ONLY assessment_* tables. Auth via session client,
 * writes via admin client (project_supabase_ssr_rls_pattern).
 */

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { getAssessment, getAssessmentQuestion, totalQuestions } from "@/lib/assessments/catalog";
import type { AnswerValue, Locale } from "@/lib/assessments/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AnswerPayload {
  assessment_id: string;
  question_id: string;
  answer: AnswerValue;
  locale: Locale;
  device_id?: string;
}

function isValidAnswer(qType: string, answer: AnswerValue): boolean {
  switch (qType) {
    case "likert5":
      return answer.kind === "likert" && [1, 2, 3, 4, 5].includes(answer.value);
    case "reflection":
      return answer.kind === "text" && typeof answer.text === "string";
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

  const { assessment_id, question_id, answer, locale } = body;

  const def = getAssessment(assessment_id);
  if (!def) return NextResponse.json({ error: "unknown_assessment" }, { status: 400 });

  const q = getAssessmentQuestion(assessment_id, question_id);
  if (!q) return NextResponse.json({ error: "unknown_question" }, { status: 400 });
  if (!isValidAnswer(q.type, answer))
    return NextResponse.json({ error: "invalid_answer_shape", expected: q.type }, { status: 400 });

  // ── Identity ──────────────────────────────────────────────────────────────
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

  // ── Rate limit: 120 answers / 10 min per (ip + identity + assessment) ──────
  const ip = getClientIp(req);
  const rl = checkRateLimit(
    `assessments:answer:${ip}:${trusted_user_id ?? deviceId}:${assessment_id}`,
    120,
    600,
  );
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", message: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    );
  }

  const index = def.questions.findIndex((x) => x.id === question_id);
  if (index < 0) return NextResponse.json({ error: "unknown_question_index" }, { status: 400 });

  const admin = createAdminSupabaseClient();

  // ── Find or create the session for THIS assessment ─────────────────────────
  let sessionId: string | undefined;

  if (trusted_user_id) {
    const { data: existing } = await admin
      .from("assessment_sessions")
      .select("id")
      .eq("user_id", trusted_user_id)
      .eq("assessment_id", assessment_id)
      .eq("status", "in_progress")
      .order("last_activity_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    sessionId = existing?.id;

    // Claim an anonymous session by device once the user signs in.
    if (!sessionId && deviceId) {
      const { data: anon } = await admin
        .from("assessment_sessions")
        .select("id")
        .eq("device_id", deviceId)
        .eq("assessment_id", assessment_id)
        .is("user_id", null)
        .order("last_activity_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (anon?.id) {
        await admin
          .from("assessment_sessions")
          .update({ user_id: trusted_user_id, device_id: null })
          .eq("id", anon.id);
        sessionId = anon.id;
      }
    }
  } else if (deviceId) {
    const { data: anon } = await admin
      .from("assessment_sessions")
      .select("id")
      .eq("device_id", deviceId)
      .eq("assessment_id", assessment_id)
      .is("user_id", null)
      .order("last_activity_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    sessionId = anon?.id;
  }

  if (!sessionId) {
    const { data: created, error: insErr } = await admin
      .from("assessment_sessions")
      .insert({
        assessment_id,
        user_id: trusted_user_id,
        device_id: trusted_user_id ? null : deviceId,
        language: locale ?? "he",
        status: "in_progress",
        current_step: 0,
      })
      .select("id")
      .single();
    if (insErr) {
      console.error("[assessments/answer] session insert failed", insErr);
      return NextResponse.json(
        { error: "session_create_failed", detail: insErr.message },
        { status: 500 },
      );
    }
    sessionId = created.id;
  }

  // ── Persist the answer (upsert by (session_id, question_id)) ───────────────
  const { error: upErr } = await admin
    .from("assessment_responses")
    .upsert(
      { session_id: sessionId, question_id, answer, locale },
      { onConflict: "session_id,question_id" },
    );
  if (upErr) {
    console.error("[assessments/answer] response upsert failed", upErr);
    return NextResponse.json(
      { error: "answer_save_failed", detail: upErr.message },
      { status: 500 },
    );
  }

  // ── Advance step ────────────────────────────────────────────────────────────
  const nextStep = index + 1;
  const isComplete = nextStep >= totalQuestions(assessment_id);

  await admin
    .from("assessment_sessions")
    .update({
      current_step: nextStep,
      status: isComplete ? "complete" : "in_progress",
      last_activity_at: new Date().toISOString(),
      completed_at: isComplete ? new Date().toISOString() : null,
    })
    .eq("id", sessionId);

  return NextResponse.json({
    ok: true,
    session_id: sessionId,
    next_index: nextStep,
    complete: isComplete,
  });
}
