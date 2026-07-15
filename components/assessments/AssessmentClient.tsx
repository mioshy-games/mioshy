"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { track } from "@/lib/analytics";
import { useDwellTracking } from "@/hooks/useDwellTracking";
import type { Question } from "@/lib/journey/types";
import { QuestionStep } from "@/components/journey/QuestionStep";
import { ProgressBar } from "@/components/journey/ProgressBar";
import type { AnswerValue, AssessmentQuestion, Locale } from "@/lib/assessments/types";
import { AssessmentInlineAuthStep } from "./AssessmentInlineAuthStep";
import { AssessmentSummary, type AssessmentResult } from "./AssessmentSummary";
import type { CadenceOption } from "@/lib/billing/pricing-validations";

interface Props {
  locale: Locale;
  assessmentId: string;
  assessmentTitleHe: string;
  assessmentTitleEn: string;
  questions: AssessmentQuestion[];
  total: number;
  authenticated: boolean;
  subscriptionActive?: boolean;
  initialStep?: number;
  initialAnswers?: Record<string, AnswerValue>;
  journeyCadences?: CadenceOption[];
  /** Unified OTP consent copy for the post-assessment register (server-resolved). */
  consent: import("@/lib/auth/otp-consent").OtpConsentCopy;
}

/**
 * Orchestrator for a single assessment. Mirrors JourneyClient's proven shape
 * (optimistic auto-advance, anon-by-device, register-at-end, fetch result on
 * completion) but is prop-driven and isolated to the assessments product.
 */
export function AssessmentClient({
  locale,
  assessmentId,
  assessmentTitleHe,
  assessmentTitleEn,
  questions,
  total,
  authenticated: authenticatedProp,
  subscriptionActive = false,
  initialStep = 0,
  initialAnswers = {},
  journeyCadences = [],
  consent,
}: Props) {
  const isHe = locale === "he";
  // Snapshot auth at mount. Setting the session cookie inside the OTP verify
  // action triggers a Next soft route-refresh that flips this server prop to
  // true MID-FLOW — which would unmount the inline OTP flow (killing the
  // phone step) before the user finishes. We only leave the registration UI on
  // a real reload (OtpFlow.onAuthenticated → window.location.reload()), so a
  // mid-flow refresh is intentionally ignored.
  const [authenticated] = useState(authenticatedProp);
  const [index, setIndex] = useState(initialStep);
  const [answersById, setAnswersById] = useState<Record<string, AnswerValue>>(initialAnswers);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState("");

  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [resultError, setResultError] = useState<string | null>(null);
  const resultFetchedRef = useRef(false);

  // ── Funnel markers (brief §0.3) — explicit head-of-funnel events so the
  // funnel lives in analytics_events, not split between events and DB. Each
  // carries { assessment_id }; assessment_sessions stays source-of-truth for
  // per-question drop-off. Refs guard against double-fire (Strict Mode).
  const introFiredRef = useRef(false);
  const startedFiredRef = useRef(false);
  const completedFiredRef = useRef(false);
  // Don't count a returning, already-finished visitor as a fresh completion.
  const wasInitiallyDoneRef = useRef(initialStep >= total);

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  // ── Dwell time on the assessment surface (brief §0.4). ─────────────────────
  useDwellTracking("assessment", assessmentId);

  const isDone = index >= total;
  const question = questions[Math.min(index, total - 1)];

  // "Entered the assessment" — fires on mount (there is no separate intro
  // screen; the component opens on question 1).
  useEffect(() => {
    if (introFiredRef.current) return;
    introFiredRef.current = true;
    track("assessment_intro_viewed", { assessment_id: assessmentId });
  }, [assessmentId]);

  // "Completed" — fires once when the user reaches the end during THIS visit.
  useEffect(() => {
    if (!isDone || completedFiredRef.current || wasInitiallyDoneRef.current) return;
    completedFiredRef.current = true;
    track("assessment_completed", { assessment_id: assessmentId });
  }, [isDone, assessmentId]);

  // ── Fetch / compute the result once the user is done AND authenticated ──────
  useEffect(() => {
    if (!isDone || !authenticated || result || resultFetchedRef.current) return;
    resultFetchedRef.current = true;

    (async () => {
      try {
        const getRes = await fetch(`/api/assessments/analyze?assessment_id=${encodeURIComponent(assessmentId)}`, {
          method: "GET",
          credentials: "include",
        });
        if (getRes.ok) {
          const data = await getRes.json();
          if (data?.result) {
            setResult(data.result as AssessmentResult);
            return;
          }
        }
        const postRes = await fetch("/api/assessments/analyze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ assessment_id: assessmentId }),
        });
        if (!postRes.ok) {
          setResultError(`analyze failed: ${postRes.status}`);
          resultFetchedRef.current = false;
          return;
        }
        const postData = await postRes.json();
        if (postData?.result) setResult(postData.result as AssessmentResult);
        else {
          setResultError("no result");
          resultFetchedRef.current = false;
        }
      } catch (e) {
        setResultError(e instanceof Error ? e.message : String(e));
        resultFetchedRef.current = false;
      }
    })();
  }, [isDone, authenticated, result, assessmentId]);

  const submitAnswer = async (answer: AnswerValue) => {
    if (!question) return;
    setError(null);
    setAnswersById((prev) => ({ ...prev, [question.id]: answer }));

    const isAutoAdvance = question.type === "likert5";
    const captured = index;
    const next = captured + 1;

    if (isAutoAdvance) setIndex(next);
    else setBusy(true);

    try {
      const res = await fetch("/api/assessments/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-device-id": deviceId },
        body: JSON.stringify({
          assessment_id: assessmentId,
          question_id: question.id,
          answer,
          locale,
          device_id: deviceId,
        }),
      });
      if (!res.ok) {
        // Read the server's structured error so the failure is visible
        // instead of a silent advance-then-revert "loop".
        let detail = `HTTP ${res.status}`;
        try {
          const body = await res.json();
          detail = body?.error
            ? `${body.error}${body.detail ? `: ${body.detail}` : ""}`
            : detail;
        } catch {
          /* non-JSON body */
        }
        if (isAutoAdvance) setIndex(captured); // revert the optimistic jump
        setError(
          isHe
            ? `לא הצלחנו לשמור את התשובה (${detail}). רעננו ונסו שוב.`
            : `Couldn't save your answer (${detail}). Refresh and try again.`,
        );
        return;
      }
      const data = await res.json();

      // "Started" — the first answer was saved successfully. Once per visit.
      if (captured === 0 && !startedFiredRef.current) {
        startedFiredRef.current = true;
        track("assessment_started", { assessment_id: assessmentId });
      }

      const serverNext = data.next_index ?? next;
      if (!isAutoAdvance) setIndex(serverNext);
    } catch (err) {
      if (isAutoAdvance) setIndex(captured);
      setError(
        isHe
          ? `שגיאת רשת בשמירת התשובה. נסו שוב.`
          : `Network error saving your answer. Please try again.`,
      );
      console.error("[AssessmentClient] save failed", err);
    } finally {
      setBusy(false);
    }
  };

  const onAuthenticated = () => {
    window.setTimeout(() => window.location.reload(), 200);
  };

  // ── Render: done + not authenticated → registration gate ────────────────────
  if (isDone && !authenticated) {
    return (
      <div dir={isHe ? "rtl" : "ltr"} className="relative mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col gap-6 px-4 py-10">
        <AnimatePresence mode="wait">
          <AssessmentInlineAuthStep
            key="assess-auth"
            locale={locale}
            deviceId={deviceId}
            assessmentId={assessmentId}
            consent={consent}
            onAuthenticated={onAuthenticated}
          />
        </AnimatePresence>
      </div>
    );
  }

  // ── Render: done + authenticated → result ───────────────────────────────────
  if (isDone) {
    if (resultError && !result) {
      return (
        <div dir={isHe ? "rtl" : "ltr"} className="mx-auto max-w-2xl space-y-4 p-10 text-center">
          <p className="text-white/80">{isHe ? "לא הצלחנו לטעון את התוצאות." : "We couldn't load your results."}</p>
          <p className="text-xs text-white/40">{resultError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-white/10 px-5 py-2 text-sm text-white hover:bg-white/20"
          >
            {isHe ? "נסו שוב" : "Try again"}
          </button>
        </div>
      );
    }
    return (
      <AssessmentSummary
        locale={locale}
        assessmentId={assessmentId}
        assessmentTitleHe={assessmentTitleHe}
        assessmentTitleEn={assessmentTitleEn}
        result={result}
        subscriptionActive={subscriptionActive}
        journeyCadences={journeyCadences}
      />
    );
  }

  // ── Render: question ────────────────────────────────────────────────────────
  return (
    <div dir={isHe ? "rtl" : "ltr"} className="mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:py-10">
      <div className="sticky top-2 z-20 -mx-4 px-4 pb-6 sm:static sm:px-0 sm:pb-8">
        <ProgressBar current={index} total={total} />
      </div>

      <AnimatePresence mode="wait">
        {question ? (
          <QuestionStep
            key={question.id}
            question={question as Question}
            locale={locale}
            onSubmit={submitAnswer}
            busy={busy}
            initial={answersById[question.id] ?? null}
          />
        ) : null}
      </AnimatePresence>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {index > 0 ? (
        <div className="mt-auto flex justify-end pt-4">
          <button
            type="button"
            onClick={() => setIndex(Math.max(0, index - 1))}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/75 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            {isHe ? "חזרה" : "Back"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
