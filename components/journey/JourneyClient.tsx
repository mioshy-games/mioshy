"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { QUESTIONS, QUESTIONNAIRE, totalQuestions } from "@/lib/journey/questions";
import type { AnswerValue, Analysis, Locale } from "@/lib/journey/types";
import { ProgressBar } from "./ProgressBar";
import { QuestionStep } from "./QuestionStep";
import { PriorityRankingStep } from "./PriorityRankingStep";
import { InlineAuthStep } from "./InlineAuthStep";
import { PaywallGateModal } from "./PaywallGateModal";
import { AnalysisSummary } from "./AnalysisSummary";
import { track } from "@/lib/analytics";

interface JourneyClientProps {
  locale: Locale;
  initialProgress?: {
    current_step: number;
    status: string;
    language: Locale;
  } | null;
  subscriptionActive?: boolean;
  authenticated?: boolean;
}

/**
 * Journey orchestrator - updated flow:
 *
 * Step 1: Q1–Q5  (unauthenticated)
 * Step 2: Inline registration form (auth gate at index 4 → shown as "Q6")
 * Step 3: Q6–Q28 (authenticated, no mid-flow paywall)
 * Step 4: AnalysisSummary with subscription CTA
 *
 * PaywallGateModal is kept as a safety net for edge-cases only.
 */
export function JourneyClient({
  locale,
  initialProgress,
  subscriptionActive = false,
  authenticated = false,
}: JourneyClientProps) {
  const [index, setIndex] = useState(initialProgress?.current_step ?? 0);
  const [busy, setBusy] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const confettiFiredRef = useRef(false);
  const analysisFetchAttemptedRef = useRef(false);

  // Diagnostic: log what we received from the server and what state the
  // client just initialized to. If "initialProgress" is null but the user
  // already finished questions, we'll see them stuck at index=0.
  useEffect(() => {
    console.log("[JourneyClient] mount", {
      authenticated,
      subscriptionActive,
      initialProgress,
      initialIndex: initialProgress?.current_step ?? 0,
      totalQuestions: totalQuestions(),
      authGateAt: QUESTIONNAIRE.gating.auth_after_index,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  // Track journey start (once, on first question)
  useEffect(() => {
    if (index === 0) track("journey_started", { locale });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const total = totalQuestions();
  const gating = QUESTIONNAIRE.gating;

  // Whether we've passed the auth gate and the user is not yet authenticated.
  const needsAuth = !authenticated && index > gating.auth_after_index;

  // Track auth gate shown (must be after needsAuth declaration)
  useEffect(() => {
    if (needsAuth) track("journey_auth_gate_shown", { step: index, locale });
  }, [needsAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Whether we've completed all questions.
  const isDone = index >= total;

  // 🎉 Confetti — fires ONCE EVER when the questionnaire is done.
  //
  // Earlier this used only `useRef` which resets on every mount, so every
  // refresh of /journey/assessment would re-fire the burst. Per user
  // feedback we now persist the "fired" state in localStorage so that:
  //   - the celebration plays exactly once for the user's lifetime on
  //     this device
  //   - reloading the result page (or coming back to it tomorrow) does
  //     NOT re-trigger the animation
  // The key is suffixed with the deviceId so different anon sessions on
  // the same browser still get their own celebration the first time.
  useEffect(() => {
    if (!isDone || confettiFiredRef.current) return;
    if (typeof window === "undefined") return;

    const STORAGE_KEY_PREFIX = "mioshy_journey_confetti_fired";
    // deviceId is set by an earlier useEffect; falls back to "anon" until
    // it lands. We treat "anon" as a non-persistent placeholder — when
    // the deviceId arrives a re-render will happen and we'll recheck.
    const key = `${STORAGE_KEY_PREFIX}:${deviceId || "anon"}`;

    let alreadyFired = false;
    try {
      alreadyFired = window.localStorage.getItem(key) === "1";
    } catch {
      // Private mode / storage disabled — fall through and fire. The
      // user-experience cost of re-firing here is trivial; data loss is
      // worse than a redundant celebration.
    }

    if (alreadyFired) {
      console.log("[JourneyClient] confetti suppressed — already fired for this device", { key });
      confettiFiredRef.current = true;
      return;
    }

    confettiFiredRef.current = true;
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // ignored — see comment above
    }

    void import("canvas-confetti").then((m) => {
      void m.default({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.55 },
        colors: ["#e879f9", "#f43f5e", "#fb923c", "#fbbf24", "#a855f7", "#38bdf8"],
        disableForReducedMotion: true,
      });
    });
  }, [isDone, deviceId]);

  // ── Analysis fetch on completion ─────────────────────────────────────────────
  // Bug being fixed: `setAnalysis` previously only ran as a side effect of
  // `submitAnswer` for the LAST question (line ~176). When a user lands on
  // /journey/assessment with progress already at total (e.g. they reloaded
  // after finishing), no new answer is submitted → `analysis` stays `null`
  // → AnalysisSummary renders the "מכינים את הניתוח שלכם…" loading state
  // forever. We now explicitly fetch the persisted analysis on mount.
  useEffect(() => {
    // Only run when:
    //   - questionnaire is complete (isDone)
    //   - user is authenticated (otherwise GET returns 401)
    //   - we don't already have an analysis loaded
    //   - we haven't already attempted the fetch this mount
    //   - we're not currently fetching
    if (!isDone) return;
    if (!authenticated) {
      console.log("[JourneyClient] analysis fetch skipped — not authenticated");
      return;
    }
    if (analysis) {
      console.log("[JourneyClient] analysis already loaded, skip fetch");
      return;
    }
    if (analysisFetchAttemptedRef.current) {
      console.log("[JourneyClient] analysis fetch already attempted, skip");
      return;
    }
    if (analysisLoading) return;

    analysisFetchAttemptedRef.current = true;

    const run = async () => {
      console.log("[JourneyClient] analysis fetch START", {
        isDone,
        authenticated,
        index,
        total,
      });
      setAnalysisLoading(true);
      setAnalysisError(null);

      try {
        // 1. Try GET first — fast path: an analysis row already exists from
        //    the last question's submitAnswer write.
        console.log("[JourneyClient] GET /api/journey/analyze");
        const getRes = await fetch("/api/journey/analyze", {
          method: "GET",
          credentials: "include",
        });
        console.log("[JourneyClient] GET response", {
          status: getRes.status,
          ok: getRes.ok,
        });

        if (getRes.status === 401) {
          setAnalysisError("unauthorized");
          console.warn("[JourneyClient] GET 401 — auth lost between page load and fetch");
          return;
        }

        if (getRes.ok) {
          const getData = await getRes.json();
          console.log("[JourneyClient] GET payload", {
            hasAnalysis: !!getData?.analysis,
            keys: getData?.analysis ? Object.keys(getData.analysis) : [],
            analysisPreview: getData?.analysis,
          });

          if (getData?.analysis) {
            setAnalysis(getData.analysis as Analysis);
            console.log("[JourneyClient] analysis SET from GET ✓");
            return;
          }
        }

        // 2. Fallback: GET returned no row (or non-OK). Force a recompute
        //    via POST, which reads the user's responses, runs analyze(),
        //    inserts into journey_analysis, and returns the fresh result.
        console.log("[JourneyClient] no analysis on GET → POST /api/journey/analyze (recompute)");
        const postRes = await fetch("/api/journey/analyze", {
          method: "POST",
          credentials: "include",
        });
        console.log("[JourneyClient] POST response", {
          status: postRes.status,
          ok: postRes.ok,
        });

        if (!postRes.ok) {
          const txt = await postRes.text().catch(() => "");
          console.error("[JourneyClient] POST failed", {
            status: postRes.status,
            body: txt,
          });
          setAnalysisError(txt || `POST failed: ${postRes.status}`);
          return;
        }

        const postData = await postRes.json();
        console.log("[JourneyClient] POST payload", {
          hasAnalysis: !!postData?.analysis,
          keys: postData?.analysis ? Object.keys(postData.analysis) : [],
        });

        if (postData?.analysis) {
          setAnalysis(postData.analysis as Analysis);
          console.log("[JourneyClient] analysis SET from POST ✓");
        } else {
          setAnalysisError("server returned no analysis");
          console.error("[JourneyClient] POST returned 200 but no analysis in body", postData);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[JourneyClient] analysis fetch THREW", err);
        setAnalysisError(msg);
        // Allow retry on next mount/state change
        analysisFetchAttemptedRef.current = false;
      } finally {
        setAnalysisLoading(false);
        console.log("[JourneyClient] analysis fetch DONE");
      }
    };

    void run();
  }, [isDone, authenticated, analysis, analysisLoading, index, total]);

  const question = QUESTIONS[Math.min(index, total - 1)];

  const headerText = useMemo(
    () =>
      locale === "he"
        ? {
            title: "מסע הזוגיות שלכם",
            subtitle: "לוקח כ-7 דקות • כל תשובה נשמרת אוטומטית",
            warmup: "נתחיל בחמש שאלות קצרות - ואז נעצור ונכין עבורכם ניתוח אישי.",
          }
        : {
            title: "Your relationship journey",
            subtitle: "~7 minutes • every answer auto-saves",
            warmup: "We'll start with five quick questions - then we'll prepare your personal analysis.",
          },
    [locale],
  );

  // Submit handler: advances UI immediately for auto-advance types,
  // then saves to the server in the background.
  const submitAnswer = async (answer: AnswerValue) => {
    if (!question) return;
    setError(null);

    // Auto-advance types (likert, single, forced_choice) feel instant:
    // we jump to the next question NOW and let the API call run async.
    const isAutoAdvance =
      question.type === "likert5" ||
      question.type === "forced_choice" ||
      question.type === "single_choice";

    const capturedIndex = index; // closure-safe snapshot
    const optimisticNext = capturedIndex + 1;

    if (isAutoAdvance) {
      setIndex(optimisticNext); // jump immediately - no spinner
    } else {
      setBusy(true); // multi_choice / reflection: block until saved
    }

    try {
      const res = await fetch("/api/journey/answer", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-device-id": deviceId,
        },
        body: JSON.stringify({
          question_id: question.id,
          answer,
          locale,
          language: locale,
          device_id: deviceId,
        }),
      });

      if (res.status === 401) {
        if (isAutoAdvance) setIndex(capturedIndex); // revert
        return;
      }
      if (res.status === 402) {
        if (isAutoAdvance) setIndex(capturedIndex); // revert
        track("paywall_shown", { source: "journey", step: capturedIndex });
        setPaywallOpen(true);
        return;
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        if (isAutoAdvance) setIndex(capturedIndex); // revert
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.analysis) setAnalysis(data.analysis);

      const serverNext = data.next_index ?? optimisticNext;
      track("journey_question_answered", {
        step: capturedIndex,
        question_id: question.id,
        locale,
      });
      if (serverNext >= total)
        track("journey_completed", { total_steps: total, locale });

      if (!isAutoAdvance) {
        setIndex(serverNext);
      } else if (serverNext !== optimisticNext) {
        // Server corrected the index (e.g. skip logic)
        setIndex(serverNext);
      }
    } catch (err) {
      if (!isAutoAdvance) {
        setError(err instanceof Error ? err.message : "Unexpected error");
      }
      // For auto-advance: silently log - the answer will retry on reload
      // (progress is restored from device_id cookie on next visit)
    } finally {
      setBusy(false);
    }
  };

  // Called after successful inline registration / login.
  const onAuthenticated = () => {
    // Soft reload: server re-fetches auth state and subscription status.
    window.setTimeout(() => window.location.reload(), 200);
  };

  // ── Render: Completed + not authenticated → registration gate ───────────────
  // Must come BEFORE the isDone→AnalysisSummary check so auth happens first.
  if (isDone && needsAuth) {
    return (
      <div
        dir={locale === "he" ? "rtl" : "ltr"}
        className="mx-auto flex min-h-[80vh] w-full max-w-3xl flex-col gap-8 px-4 py-10"
      >
        <header className="flex flex-col gap-2 text-start">
          <h1 className="text-2xl font-bold text-white md:text-3xl">{headerText.title}</h1>
          <p className="text-sm text-white/70">{headerText.subtitle}</p>
        </header>

        {/* Show 100% progress - no lock, all questions are done */}
        <ProgressBar current={total} total={total} />

        <AnimatePresence mode="wait">
          <InlineAuthStep
            key="inline-auth"
            locale={locale}
            deviceId={deviceId}
            onAuthenticated={onAuthenticated}
          />
        </AnimatePresence>
      </div>
    );
  }

  // ── Render: Analysis summary (authenticated + done) ──────────────────────
  if (isDone) {
    console.log("[JourneyClient] render isDone branch", {
      hasAnalysis: !!analysis,
      analysisLoading,
      analysisError,
      authenticated,
      subscriptionActive,
    });

    // Surface error so the user isn't stuck on a generic loading message
    // when the fetch actually failed — they'll know to retry/contact us.
    if (analysisError && !analysis) {
      return (
        <div
          dir={locale === "he" ? "rtl" : "ltr"}
          className="mx-auto max-w-2xl space-y-4 p-10 text-center"
        >
          <p className="text-white/80">
            {locale === "he"
              ? "לא הצלחנו לטעון את הניתוח שלכם."
              : "We couldn't load your analysis."}
          </p>
          <p className="text-xs text-white/40">{analysisError}</p>
          <button
            type="button"
            onClick={() => {
              analysisFetchAttemptedRef.current = false;
              setAnalysisError(null);
              // Force re-eval of the effect by toggling state
              setAnalysisLoading(false);
              window.location.reload();
            }}
            className="rounded-full bg-white/10 px-5 py-2 text-sm text-white hover:bg-white/20"
          >
            {locale === "he" ? "נסו שוב" : "Try again"}
          </button>
        </div>
      );
    }

    return (
      <AnalysisSummary
        analysis={analysis}
        locale={locale}
        subscriptionActive={subscriptionActive}
      />
    );
  }

  // ── Render: Regular question ────────────────────────────────────────────────
  return (
    <div
      dir={locale === "he" ? "rtl" : "ltr"}
      className="mx-auto flex min-h-[80vh] w-full max-w-3xl flex-col gap-8 px-4 py-10"
    >
      <header className="flex flex-col gap-2 text-start">
        <h1 className="text-2xl font-bold text-white md:text-3xl">{headerText.title}</h1>
        <p className="text-sm text-white/70">{headerText.subtitle}</p>
      </header>

      {/* No lock - user can see the full bar at all times */}
      <ProgressBar current={index} total={total} />

      {index === 0 ? (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="rounded-2xl bg-white/5 p-4 text-sm text-white/80"
        >
          {headerText.warmup}
        </motion.p>
      ) : null}

      <AnimatePresence mode="wait">
        {question ? (
          // Dispatch on question type. Ranking has its own drag-drop UI;
          // every other type goes through the legacy QuestionStep.
          question.type === "ranking" ? (
            <PriorityRankingStep
              key={question.id}
              question={question}
              locale={locale}
              onSubmit={submitAnswer}
              busy={busy}
            />
          ) : (
            <QuestionStep
              key={question.id}
              question={question}
              locale={locale}
              onSubmit={submitAnswer}
              busy={busy}
            />
          )
        ) : null}
      </AnimatePresence>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      <PaywallGateModal
        open={paywallOpen}
        locale={locale}
        onClose={() => setPaywallOpen(false)}
      />
    </div>
  );
}
