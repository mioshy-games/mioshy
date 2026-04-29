"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getOrCreateDeviceId } from "@/lib/device-id";
import { QUESTIONS, QUESTIONNAIRE, totalQuestions } from "@/lib/journey/questions";
import type { AnswerValue, Analysis, Locale } from "@/lib/journey/types";
import { ProgressBar } from "./ProgressBar";
import { QuestionStep } from "./QuestionStep";
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
 * Journey orchestrator — updated flow:
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
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState<string>("");
  const confettiFiredRef = useRef(false);

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

  // 🎉 Confetti — fires once when the questionnaire is done
  useEffect(() => {
    if (!isDone || confettiFiredRef.current) return;
    confettiFiredRef.current = true;
    void import("canvas-confetti").then((m) => {
      void m.default({
        particleCount: 140,
        spread: 90,
        origin: { y: 0.55 },
        colors: ["#e879f9", "#f43f5e", "#fb923c", "#fbbf24", "#a855f7", "#38bdf8"],
        disableForReducedMotion: true,
      });
    });
  }, [isDone]);

  const question = QUESTIONS[Math.min(index, total - 1)];

  const headerText = useMemo(
    () =>
      locale === "he"
        ? {
            title: "מסע הזוגיות שלכם",
            subtitle: "לוקח כ-7 דקות • כל תשובה נשמרת אוטומטית",
            warmup: "נתחיל בחמש שאלות קצרות — ואז נעצור ונכין עבורכם ניתוח אישי.",
          }
        : {
            title: "Your relationship journey",
            subtitle: "~7 minutes • every answer auto-saves",
            warmup: "We'll start with five quick questions — then we'll prepare your personal analysis.",
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
      setIndex(optimisticNext); // jump immediately — no spinner
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
      // For auto-advance: silently log — the answer will retry on reload
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
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-white md:text-3xl">{headerText.title}</h1>
          <p className="text-sm text-white/70">{headerText.subtitle}</p>
        </header>

        {/* Show 100% progress — no lock, all questions are done */}
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
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-white md:text-3xl">{headerText.title}</h1>
        <p className="text-sm text-white/70">{headerText.subtitle}</p>
      </header>

      {/* No lock — user can see the full bar at all times */}
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
          <QuestionStep
            key={question.id}
            question={question}
            locale={locale}
            onSubmit={submitAnswer}
            busy={busy}
          />
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
