"use client";

import { useEffect, useRef, useState } from "react";
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
import {
  AssessmentInterstitial,
  INTERSTITIALS,
  wasInterstitialShown,
  markInterstitialShown,
} from "./AssessmentInterstitial";
import { track } from "@/lib/analytics";
import { CmsText } from "@/components/cms/CmsText";

interface JourneyClientProps {
  locale: Locale;
  initialProgress?: {
    current_step: number;
    status: string;
    language: Locale;
  } | null;
  /** Map of question_id → prior AnswerValue, hydrated server-side from
   *  journey_responses. Used to pre-fill answers when the user navigates
   *  back to a previously-answered question. UX feedback 2026-05-05. The
   *  outer Record uses `unknown` because the server can't statically
   *  prove the JSONB column matches AnswerValue; we cast at the call
   *  site once before passing into the question components. */
  initialAnswers?: Record<string, unknown>;
  subscriptionActive?: boolean;
  authenticated?: boolean;
}

// ── Engagement reveal: per-question "X% of couples answered like you" ──
// Per product spec (2026-05-05), the assessment shows a brief social-proof
// reveal between questions to keep visitors curious enough to finish all 32.
// The percentage is DETERMINISTIC pseudo-random based on the question id +
// answer - NOT real aggregate data. Once we have enough actual responses
// the function gets swapped with one that reads from the DB; the calling
// site (submitAnswer) doesn't change.
//
// Range 25–84 keeps every reveal interesting: never the boring 50/50,
// never the suspicious 95%+. Spread is wide so consecutive questions
// surface meaningfully different numbers.
const REVEAL_DWELL_MS = 2500;
function computeMatchPercent(
  questionId: string,
  answer: AnswerValue,
): number {
  const answerStr =
    typeof answer === "object" ? JSON.stringify(answer) : String(answer);
  let seed = 0;
  const combined = `${questionId}|${answerStr}`;
  for (let i = 0; i < combined.length; i++) {
    seed = (seed * 31 + combined.charCodeAt(i)) | 0;
  }
  const positive = ((seed % 60) + 60) % 60; // 0..59
  return 25 + positive; // 25..84
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
  initialAnswers,
  subscriptionActive = false,
  authenticated = false,
}: JourneyClientProps) {
  const [index, setIndex] = useState(initialProgress?.current_step ?? 0);
  // In-memory map of answers, seeded with the server-hydrated set and
  // updated as the user submits new ones. Lookup by question_id when
  // we need an `initial` value for QuestionStep / PriorityRankingStep.
  const [answersById, setAnswersById] = useState<Record<string, AnswerValue>>(
    () => (initialAnswers ?? {}) as Record<string, AnswerValue>,
  );
  const [busy, setBusy] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  // Per-question social-proof reveal banner. Set on submit, cleared
  // 1.5s later when the next question loads. `qid` keys the
  // AnimatePresence so the panel re-animates between questions instead
  // of cross-fading on identical content.
  const [reveal, setReveal] = useState<{ percent: number; qid: string } | null>(
    null,
  );
  const confettiFiredRef = useRef(false);
  const analysisFetchAttemptedRef = useRef(false);
  // Layer-1 mid-flow interstitial. When set to a non-null index, the
  // questionnaire is paused and the matching reflection card renders
  // in place of the question. Continuing dismisses it (and stamps the
  // session-storage flag so it doesn't reappear on back-and-forth).
  const [interstitialIndex, setInterstitialIndex] = useState<number | null>(null);
  // Track the furthest question index the user has reached. When they go
  // back (via the back button) and re-submit a previously-answered question,
  // we skip the social-proof reveal - they've already seen one for this slot
  // and replaying it on every back-and-forth feels noisy. Per UX feedback
  // 2026-05-05.
  const highWaterRef = useRef<number>(initialProgress?.current_step ?? 0);

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

  // Layer-1 interstitial trigger. Runs after every index change.
  // Fires the interstitial if (a) the new index is a registered break
  // point, (b) we haven't shown it this session, and (c) we're not
  // already viewing one. Crucially: the user must have *reached* the
  // break point through forward motion; back-button revisits don't
  // re-trigger because of the sessionStorage flag.
  useEffect(() => {
    const def = INTERSTITIALS.find((i) => i.atIndex === index);
    if (!def) return;
    if (wasInterstitialShown(index)) return;
    if (interstitialIndex !== null) return;
    setInterstitialIndex(index);
  }, [index, interstitialIndex]);

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

  // 🎉 Confetti - fires ONCE EVER when the questionnaire is done.
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
    // it lands. We treat "anon" as a non-persistent placeholder - when
    // the deviceId arrives a re-render will happen and we'll recheck.
    const key = `${STORAGE_KEY_PREFIX}:${deviceId || "anon"}`;

    let alreadyFired = false;
    try {
      alreadyFired = window.localStorage.getItem(key) === "1";
    } catch {
      // Private mode / storage disabled - fall through and fire. The
      // user-experience cost of re-firing here is trivial; data loss is
      // worse than a redundant celebration.
    }

    if (alreadyFired) {
      console.log("[JourneyClient] confetti suppressed - already fired for this device", { key });
      confettiFiredRef.current = true;
      return;
    }

    confettiFiredRef.current = true;
    try {
      window.localStorage.setItem(key, "1");
    } catch {
      // ignored - see comment above
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
      console.log("[JourneyClient] analysis fetch skipped - not authenticated");
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
        // 1. Try GET first - fast path: an analysis row already exists from
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
          console.warn("[JourneyClient] GET 401 - auth lost between page load and fetch");
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

  // Submit handler: advances UI immediately for auto-advance types,
  // then saves to the server in the background.
  const submitAnswer = async (answer: AnswerValue) => {
    if (!question) return;
    setError(null);

    // Stash the answer locally so an immediate back-then-forward shows
    // the latest pick (not the stale server-hydrated value). This runs
    // BEFORE the API call returns - fine, because the local map is
    // disambiguated by question_id and is only used for `initial`
    // values, never for scoring.
    setAnswersById((prev) => ({ ...prev, [question.id]: answer }));

    // Auto-advance types (likert, single, forced_choice) feel instant:
    // we jump to the next question NOW and let the API call run async.
    const isAutoAdvance =
      question.type === "likert5" ||
      question.type === "forced_choice" ||
      question.type === "single_choice";

    const capturedIndex = index; // closure-safe snapshot
    const optimisticNext = capturedIndex + 1;

    // Skip the social-proof reveal when:
    //   1. The question is the priority ranking step (UX feedback: feels
    //      out of place at the ranking screen — the user is making a list,
    //      not picking one option), OR
    //   2. The user is re-answering a question they already moved past
    //      (highWater > current). The reveal is a "first impression" hint;
    //      replaying it on back-and-forth is noisy.
    //   3. (W2.4 / Itzik #6) The user is in the early part of the flow
    //      (before the auth gate). The percentage frames the question
    //      socially before we've even earned the right to do that.
    //   4. (W2.4 / Itzik #7) The question is an open-text reflection.
    //      A "% of couples answered like you" headline doesn't make sense
    //      after a free-text answer.
    const skipReveal =
      question.type === "ranking" ||
      question.type === "reflection" ||
      capturedIndex <= gating.auth_after_index ||
      capturedIndex < highWaterRef.current;

    // Effective dwell - keep zero when the reveal is skipped so the user
    // doesn't sit on a blank screen waiting for nothing.
    const dwellMs = skipReveal ? 0 : REVEAL_DWELL_MS;

    // Surface the social-proof reveal NOW (unless suppressed).
    // It's a UI hint only - does not block API or state machine.
    const matchPercent = computeMatchPercent(question.id, answer);
    const __revealStartTs = performance.now();
    // eslint-disable-next-line no-console
    console.log("[reveal] set", {
      ts: __revealStartTs,
      percent: matchPercent,
      qid: question.id,
      flow: isAutoAdvance ? "auto" : "manual",
      configuredDwellMs: REVEAL_DWELL_MS,
      skipReveal,
      reason: skipReveal
        ? question.type === "ranking"
          ? "ranking-step"
          : question.type === "reflection"
            ? "open-text"
            : capturedIndex <= gating.auth_after_index
              ? "early-flow"
              : "back-and-resubmit"
        : null,
    });
    if (!skipReveal) {
      setReveal({ percent: matchPercent, qid: question.id });
    }

    if (isAutoAdvance) {
      // Delay the jump by REVEAL_DWELL_MS so the user can read the reveal
      // before the next question slides in. The fetch keeps running async
      // alongside this timer (started further down) - typical API time is
      // well under the dwell, so this rarely lengthens total flow.
      window.setTimeout(() => {
        // eslint-disable-next-line no-console
        console.log("[reveal] cleared (auto-advance)", {
          qid: question.id,
          actualDwellMs: Math.round(performance.now() - __revealStartTs),
          configuredDwellMs: dwellMs,
        });
        setIndex(optimisticNext);
        // Bump the high-water mark so a future back-and-resubmit at this
        // slot is correctly classified as "already-seen".
        if (optimisticNext > highWaterRef.current) {
          highWaterRef.current = optimisticNext;
        }
        setReveal(null);
      }, dwellMs);
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
        // Hold the reveal on screen for at least dwellMs even if the API
        // responded faster than the dwell - keeps the social-proof feedback
        // consistent across question types. When skipReveal is true,
        // dwellMs is 0 so we advance immediately.
        if (dwellMs > 0) {
          await new Promise((r) => window.setTimeout(r, dwellMs));
        }
        // eslint-disable-next-line no-console
        console.log("[reveal] cleared (manual)", {
          qid: question.id,
          actualDwellMs: Math.round(performance.now() - __revealStartTs),
          configuredDwellMs: dwellMs,
        });
        setReveal(null);
        setIndex(serverNext);
        if (serverNext > highWaterRef.current) {
          highWaterRef.current = serverNext;
        }
      } else if (serverNext !== optimisticNext) {
        // Server corrected the index (e.g. skip logic) - let the dwell
        // timer running above still clear `reveal`; here we only need to
        // override the destination index.
        window.setTimeout(() => {
          setIndex(serverNext);
          if (serverNext > highWaterRef.current) {
            highWaterRef.current = serverNext;
          }
        }, dwellMs);
      }
    } catch (err) {
      // Clear reveal so the user isn't stuck reading a stale percent.
      setReveal(null);
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
  //
  // F8 (Itzik #15) — gate on `!authenticated` directly, not on
  // `needsAuth`. `needsAuth` keys off `gating.auth_after_index = 30`,
  // and the questionnaire only has 29 questions, so the mid-flow gate
  // never fired and anonymous users were dropped into AnalysisSummary
  // (which then 401'd on the analysis fetch). The gate now matches
  // the spec: finish all questions → register before seeing the
  // summary.
  if (isDone && !authenticated) {
    return (
      <div
        dir={locale === "he" ? "rtl" : "ltr"}
        className="mx-auto flex min-h-[80vh] w-full max-w-3xl flex-col gap-8 px-4 py-10"
      >
        <header className="flex flex-col gap-2 text-start">
          <CmsText
            cmsKey="journeyAssessment.client.title"
            as="h1"
            className="text-2xl font-bold text-white md:text-3xl"
          />
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
    // when the fetch actually failed - they'll know to retry/contact us.
    if (analysisError && !analysis) {
      return (
        <div
          dir={locale === "he" ? "rtl" : "ltr"}
          className="mx-auto max-w-2xl space-y-4 p-10 text-center"
        >
          <CmsText
            cmsKey="journeyAssessment.client.analysisError"
            as="p"
            className="text-white/80"
          />
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
            <CmsText cmsKey="journeyAssessment.client.tryAgain" />
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
      className="mx-auto flex min-h-[80vh] w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:gap-8 sm:py-10"
    >
      {/* W2.3 — progress bar pinned at the top so the percentage is
          always above the fold on mobile (Itzik #4).
          F3 (#13) — dropped the opaque #070b18/85 backdrop because it
          painted a black strip over the page bg. The bar floats on
          the page bg now; backdrop-blur with no fill keeps it readable
          against the questions sliding underneath. */}
      <div className="sticky top-2 z-20 -mx-4 px-4 pb-1 sm:static sm:px-0">
        <ProgressBar current={index} total={total} />
      </div>

      <header className="flex flex-col gap-2 text-start">
        <CmsText
          cmsKey="journeyAssessment.client.title"
          as="h1"
          className="text-2xl font-bold text-white md:text-3xl"
        />
      </header>

      <AnimatePresence mode="wait">
        {interstitialIndex !== null ? (
          // Layer-1 mid-flow reflection. Pauses the questionnaire
          // until the user clicks Continue.
          (() => {
            const def = INTERSTITIALS.find((i) => i.atIndex === interstitialIndex);
            if (!def) return null;
            return (
              <AssessmentInterstitial
                key={`interstitial-${def.atIndex}`}
                isHe={locale === "he"}
                def={def}
                onContinue={() => {
                  markInterstitialShown(def.atIndex);
                  setInterstitialIndex(null);
                }}
              />
            );
          })()
        ) : question ? (
          // Dispatch on question type. Ranking has its own drag-drop UI;
          // every other type goes through the legacy QuestionStep.
          question.type === "ranking" ? (
            <PriorityRankingStep
              key={question.id}
              question={question}
              locale={locale}
              onSubmit={submitAnswer}
              busy={busy}
              initial={answersById[question.id] ?? null}
            />
          ) : (
            <QuestionStep
              key={question.id}
              question={question}
              locale={locale}
              onSubmit={submitAnswer}
              busy={busy}
              initial={answersById[question.id] ?? null}
            />
          )
        ) : null}
      </AnimatePresence>

      {/* Per-question social-proof reveal banner. Sits BELOW the question
          so the percent surfaces directly under where the answer was
          (matches the user's eyeline after click). Keyed AnimatePresence
          slides cleanly between question transitions instead of cross-
          fading on identical content. */}
      <AnimatePresence mode="wait">
        {reveal ? (
          <motion.div
            key={`reveal-${reveal.qid}`}
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
            className="rounded-2xl border border-emerald-300/40 bg-emerald-400/15 p-4 text-center backdrop-blur-md"
          >
            <p className="text-[20px] font-semibold leading-snug text-white">
              {reveal.percent}%{" "}
              <CmsText cmsKey="journeyAssessment.client.revealSuffix" />
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {error ? <p className="text-sm text-rose-300">{error}</p> : null}

      {/* Back button - pinned to the bottom of the content flow per UX
          feedback 2026-05-05 ("כפתור חזרה צריך להיות בפינה למטה"). Hidden
          on the first question. Just decrements the local index; saved
          answers stay in the DB so going back-and-forth doesn't lose
          anything. mt-auto pushes it to the bottom of the flex column,
          even when the question above is short. justify-end keeps it on
          the inline-end side (left in RTL = where back-arrows naturally
          live in Hebrew UIs). */}
      {index > 0 ? (
        <div className="mt-auto flex justify-end pt-4">
          <button
            type="button"
            onClick={() => setIndex(Math.max(0, index - 1))}
            className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-sm text-white/75 transition hover:border-white/30 hover:bg-white/10 hover:text-white"
          >
            <CmsText cmsKey="journeyAssessment.client.back" />
          </button>
        </div>
      ) : null}

      <PaywallGateModal
        open={paywallOpen}
        locale={locale}
        onClose={() => setPaywallOpen(false)}
      />
    </div>
  );
}
