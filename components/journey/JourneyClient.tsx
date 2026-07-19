"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getOrCreateDeviceId } from "@/lib/device-id";
import type { AnswerValue, Analysis, Locale, Question } from "@/lib/journey/types";
import { ProgressBar } from "./ProgressBar";
import { QuestionStep } from "./QuestionStep";
import { PriorityRankingStep } from "./PriorityRankingStep";
import { InlineAuthStep } from "./InlineAuthStep";
import { PaywallGateModal } from "./PaywallGateModal";
import { AnalysisSummary, type JourneyPromoSummary } from "./AnalysisSummary";
import { ReconsentPrompt } from "./ReconsentPrompt";
import type { CadenceOption } from "@/lib/billing/pricing-validations";
import {
  AssessmentInterstitial,
  INTERSTITIALS,
  wasInterstitialShown,
  markInterstitialShown,
} from "./AssessmentInterstitial";
import { track } from "@/lib/analytics";
import { useDwellTracking } from "@/hooks/useDwellTracking";
import { metaTrackCustom } from "@/lib/analytics/meta-pixel";
import { pushToDataLayer } from "@/lib/analytics/gtm";
import { CmsText } from "@/components/cms/CmsText";

/**
 * Mioshy logo strip shown above the funnel on the question / auth / error
 * screens. Relocated here from the assessment page wrapper (2026-06-29,
 * results redesign Phase 2) so the redesigned results screen can carry its
 * own logo on the hero (AnalysisSummary), while every other funnel screen
 * stays branded. 150px wide, centered, links back to the locale home.
 */
function FunnelLogo({ locale, theme = "dark" }: { locale: Locale; theme?: "light" | "dark" }) {
  // Journey light-theme redesign (2026-07-01): the question flow is light
  // (#fffffc), so it uses the BLACK wordmark on the light body with a ~100px
  // gap below it (spec §4). The dark auth/results screens keep the white logo.
  const isLight = theme === "light";
  return (
    <div
      className={
        isLight
          ? "relative z-10 flex justify-center pt-[clamp(22px,4vw,32px)]"
          : "relative z-10 flex justify-center pt-6 pb-2"
      }
      style={isLight ? { marginBottom: "clamp(54px,6.6vh,62px)" } : undefined}
    >
      <a
        href={`/${locale}`}
        aria-label="Mioshy home"
        className="inline-flex transition-opacity hover:opacity-80"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={isLight ? "/images/mioshy-b.svg" : "/mioshy-white.svg"}
          alt="Mioshy"
          width={150}
          height={48}
          className="h-auto w-[150px]"
        />
      </a>
    </div>
  );
}

// Vertical-rhythm token shared with QuestionStep / PriorityRankingStep so the
// gaps progress → question → answer → nav match the v6 mockup (spec §5).
const GAP = "clamp(38px,7.5vh,78px)";

interface JourneyClientProps {
  locale: Locale;
  /** Unified OTP consent copy for the post-assessment register (server-resolved). */
  consent: import("@/lib/auth/otp-consent").OtpConsentCopy;
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
  /** F3.3 — journey-specific entitlement (active|grace). Drives whether the
   *  AnalysisSummary pre-purchase selling sections render. Distinct from
   *  `subscriptionActive` (product-agnostic) so a journey subscriber who is
   *  still in report_phase 'short' is correctly treated as a subscriber. */
  journeySubscribed?: boolean;
  authenticated?: boolean;
  /** Item 12 — server-resolved "finished the short assessment" flag (passed only
   *  for non-subscribed users). When true the user lands on the results page
   *  (AnalysisSummary), never the questionnaire — robust to a completed journey
   *  whose status/answers didn't resolve exactly as "complete". */
  initialCompleted?: boolean;
  journeyCadences?: CadenceOption[];
  /** Task 21 — personal 48h offer deadline (personal_window mode), for the
   *  "מחיר ההיכרות שלכם שמור עד …" line on the results page. Null = none. */
  offerExpiresAt?: string | null;
  /** Task 21 — urgency mode; gates the campaign countdown (only campaign_timer)
   *  vs the personal-window line so only ONE urgency indicator shows. */
  promoMode?: "off" | "personal_window" | "campaign_timer";
  /** Admin-controlled personal-window display ('text' | 'clock', migration 184),
   *  forwarded to AnalysisSummary. */
  personalWindowDisplay?: "text" | "clock";
  /** Active journey marketing promo (server-computed), forwarded to
   *  AnalysisSummary for the discount banner. null → no banner. */
  activePromo?: JourneyPromoSummary | null;
  /** F3.1 — render source. Questions are loaded from the DB
   *  (journey_questions, JSON fallback) server-side and passed in, replacing
   *  the static questionnaire.json import for RENDER. likertLabels + gating
   *  are still JSON-sourced this step, carried as props. Flow/gating logic is
   *  unchanged (F3.2). */
  questions: Question[];
  likertLabels: Record<Locale, string[]>;
  gating: { auth_after_index: number; paywall_after_index: number };
  /** F3.2 — `questions` is the UNANSWERED remainder of the active phase;
   *  phaseTotal/phaseAnsweredBefore drive the honest progress bar across the
   *  whole phase (completion + the auth/paywall gate are server-authoritative,
   *  adopted from the answer response's `gate`). */
  phaseTotal: number;
  phaseAnsweredBefore: number;
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
  consent,
  initialProgress,
  initialAnswers,
  subscriptionActive = false,
  journeySubscribed = false,
  authenticated: authenticatedProp = false,
  initialCompleted = false,
  journeyCadences = [],
  activePromo = null,
  offerExpiresAt = null,
  promoMode = "personal_window",
  personalWindowDisplay = "text",
  questions,
  likertLabels,
  gating,
  phaseTotal,
  phaseAnsweredBefore,
}: JourneyClientProps) {
  // Snapshot auth at mount. The OTP verify action sets the session cookie, which
  // triggers a Next soft route-refresh that flips this server prop true MID-FLOW
  // — that would unmount the inline registration (killing OtpFlow's phone step)
  // before the user finishes. We only leave the gate on a real reload
  // (InlineAuthStep.onAuthenticated → window.location.reload()), so a mid-flow
  // refresh is intentionally ignored.
  const [authenticated] = useState(authenticatedProp);
  // Task 3 (single price source): live monthly (without-coaching) price for the
  // PaywallGateModal safety net, promo-aware, from journeyCadences + activePromo
  // — replaces the stale static "₪98 / $33" so this surface can't drift.
  const paywallPrice = (() => {
    const isHe = locale === "he";
    const monthly = journeyCadences.find((c) => c.cadence === "monthly");
    if (!monthly) return { label: null as string | null, original: null as string | null };
    const promo = activePromo?.withoutCoaching ?? null;
    const pf = promo?.firstChargeByCadence?.monthly;
    const po = promo?.originalByCadence?.monthly;
    const firstIls = pf ? pf.ils : monthly.price_ils;
    const firstUsd = pf ? pf.usd : monthly.price_usd;
    const origIls = po ? po.ils : monthly.price_ils;
    const origUsd = po ? po.usd : monthly.price_usd;
    const money = (ils: number, usd: number) =>
      isHe ? `${ils} ₪ לחודש` : `$${usd} per month`;
    const hasPromo = !!(pf && po && (isHe ? firstIls < origIls : firstUsd < origUsd));
    return {
      label: money(firstIls, firstUsd),
      original: hasPromo ? money(origIls, origUsd) : null,
    };
  })();

  // F3.2 — `questions` is the UNANSWERED remainder of the active phase, so we
  // always start at its index 0 (resume = first unanswered, computed server-
  // side). `current_step` is no longer trusted for positioning.
  const [index, setIndex] = useState(0);
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
  // Diagnostic: count how many times the isDone branch re-renders. If
  // this climbs into the dozens within a few seconds we have a render
  // storm (likely the cause of the "Chrome → whole machine slows"
  // symptom Itzik reported 2026-05-18). Logged inline so it's visible
  // in DevTools without expanding an Object.
  const isDoneRenderCountRef = useRef(0);
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
      totalQuestions: questions.length,
      authGateAt: gating.auth_after_index,
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setDeviceId(getOrCreateDeviceId());
  }, []);

  // ── Dwell on the journey-assessment surface (brief §A.3). Dedicated refId
  // "journey_assessment" (NOT a chapter itemId) so the funnel lib can filter
  // item_id="journey_assessment" and never swallow content-chapter dwell. ────
  useDwellTracking("journey", "journey_assessment");

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

  // F3.1 — `total` is the rendered set length (full DB set, JSON fallback).
  // Stays GLOBAL this step (not phase-aware — that's F3.2). With DB == seed
  // this equals the old totalQuestions(). `gating` is now a prop (JSON-sourced).
  const total = questions.length;

  // Whether we've passed the auth gate and the user is not yet authenticated.
  const needsAuth = !authenticated && index > gating.auth_after_index;

  // Track auth gate shown (must be after needsAuth declaration)
  useEffect(() => {
    if (needsAuth) track("journey_auth_gate_shown", { step: index, locale });
  }, [needsAuth]); // eslint-disable-line react-hooks/exhaustive-deps

  // Whether we've completed all questions.
  //
  // 2026-06-02 (Itzik): legacy users whose `current_step` is below the
  // CURRENT totalQuestions() (because the schema grew after they took
  // the assessment) used to be dumped back into the questionnaire when
  // they re-visited /journey/assessment. The durable signal is the
  // `journey.status === "complete"` flag written by /api/journey/answer
  // on submit — once true, the user has finished and should see the
  // summary forever. We honour both: step count for in-flight users,
  // status for finished ones. An admin pushing a NEW assessment in the
  // future will create a fresh row whose status is in_progress, so
  // this doesn't lock anyone out of a re-do.
  const wasCompleted =
    initialProgress?.status === "complete" ||
    initialProgress?.status === "completed";
  // Item 12 — `initialCompleted` (server-resolved, non-subscribed users only)
  // forces the results page for anyone who finished the short assessment, so an
  // existing unpaid user is never dumped back into the questionnaire.
  const isDone = initialCompleted || wasCompleted || index >= total;

  // ── Journey-assessment funnel markers (brief §A.2). Constant
  // assessment_id:"journey" so the funnel lib's
  // .eq("properties->>assessment_id","journey") catches all four. Refs guard
  // Strict Mode double-fire; wasInitiallyDoneRef stops a returning, already-
  // finished visitor counting as a fresh completion. ─────────────────────────
  const introFiredRef = useRef(false);
  const startedFiredRef = useRef(false);
  const completedFiredRef = useRef(false);
  // Snapshot "already done at mount" from isDone (not just wasCompleted): a
  // returning visitor can be done via index>=total too — e.g. a 'paywall'
  // journey whose remaining-questions set is empty (total=0) — and must NOT
  // re-fire completed on every revisit. isDone is evaluated above before this
  // ref initialises.
  const wasInitiallyDoneRef = useRef(isDone);

  // "Entered" — fires on mount (the /intro route is only a redirect; there is
  // no separate intro screen, so mounting the questionnaire is "entered").
  useEffect(() => {
    if (introFiredRef.current) return;
    introFiredRef.current = true;
    track("journey_assessment_intro_viewed", { assessment_id: "journey" });
  }, []);

  // "Completed the short assessment" — fires once when the user reaches done
  // during THIS visit (not for a returning, already-finished visitor).
  useEffect(() => {
    if (!isDone || completedFiredRef.current || wasInitiallyDoneRef.current) return;
    completedFiredRef.current = true;
    track("journey_assessment_completed", { assessment_id: "journey" });
  }, [isDone]);

  // Meta CompleteAssessment (custom, browser) — the SHORT-assessment campaign
  // optimization event. Fires once when the user reaches the AUTHENTICATED
  // summary/analysis screen (isDone && authenticated) — the same condition that
  // renders the summary (see `isDone && !authenticated` → registration gate
  // below). Gating on `authenticated` avoids firing at the anonymous gate and
  // avoids the inconsistent double-fire across the anon→login→remount
  // transition. Delivery is race-safe regardless: metaTrackCustom buffers until
  // the idle-loaded pixel is ready (lib/analytics/meta-pixel.ts). Neutral
  // assessment_type; browser-only (no CAPI). Ref guards re-render double-fires.
  const completeAssessmentFiredRef = useRef(false);
  useEffect(() => {
    if (isDone && authenticated && !completeAssessmentFiredRef.current) {
      completeAssessmentFiredRef.current = true;
      metaTrackCustom("CompleteAssessment", { assessment_type: "journey_short" });
    }
  }, [isDone, authenticated]);

  // Meta StartAssessment (custom, browser) — the mid-funnel "began the short
  // assessment" signal that sits between Landing Page View and
  // CompleteAssessment. Fires once when the user actually ENGAGES — i.e. has
  // answered at least the first question (`index >= 1`) while not yet done —
  // NOT on mere page load, so it is distinct from LPV/PageView. Returning
  // in-flight users (index already >= 1 at mount) correctly count as "started"
  // and still fire only once. Browser-only (no CAPI), neutral assessment_type;
  // metaTrackCustom handles URL redaction, DNT and pre-init buffering. Ref guard
  // prevents re-render double-fires. See docs/facebook-pixel-start-assessment-brief.md.
  const startAssessmentFiredRef = useRef(false);
  useEffect(() => {
    if (!isDone && index >= 1 && !startAssessmentFiredRef.current) {
      startAssessmentFiredRef.current = true;
      metaTrackCustom("StartAssessment", { assessment_type: "journey_short" });
      // GTM remarketing signal — user actually began the assessment (answered
      // Q1). Shares the same one-fire ref as the Meta beacon, so it's emitted
      // exactly once per session.
      pushToDataLayer({ event: "begin_assessment", assessment: "couples_assessment" });
    }
  }, [isDone, index]);

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

        // 2. Fallback: GET returned no row (or non-OK). Force a recompute via
        //    POST, which reads the user's responses, runs analyze(), inserts into
        //    journey_analysis, and returns the fresh result.
        //    RETRY with backoff: immediately after an OTP registration+reload the
        //    journey→user link (finalizeJourneySignup + the page self-heal) can
        //    lag this client POST, so the first attempt can hit a transient
        //    `no_journey` (404). We must NOT surface that as a permanent
        //    "couldn't load" screen — retry a few times and only error if the
        //    recompute is genuinely unavailable, so the user reliably lands on
        //    their results.
        const MAX_POST_ATTEMPTS = 4;
        let lastMsg = "analysis_unavailable";
        for (let attempt = 1; attempt <= MAX_POST_ATTEMPTS; attempt++) {
          const postRes = await fetch("/api/journey/analyze", {
            method: "POST",
            credentials: "include",
          });
          console.log(
            "[JourneyClient] POST attempt",
            `n=${attempt}/${MAX_POST_ATTEMPTS}`,
            `status=${postRes.status}`,
            `ok=${postRes.ok}`,
          );

          // Auth genuinely lost → no point retrying.
          if (postRes.status === 401) {
            setAnalysisError("unauthorized");
            return;
          }

          if (postRes.ok) {
            const postData = await postRes.json().catch(() => null);
            if (postData?.analysis) {
              setAnalysis(postData.analysis as Analysis);
              console.log("[JourneyClient] analysis SET from POST ✓", `attempt=${attempt}`);
              return;
            }
            lastMsg = "server returned no analysis";
          } else {
            const cloned = postRes.clone();
            let body: unknown = null;
            try { body = await postRes.json(); } catch { body = await cloned.text().catch(() => ""); }
            lastMsg =
              typeof body === "object" && body && "error" in body
                ? String((body as { error: unknown }).error)
                : typeof body === "string" && body
                  ? body
                  : `POST failed: ${postRes.status}`;
            console.warn("[JourneyClient] POST attempt failed", `n=${attempt}`, `msg=${lastMsg}`);
          }

          // Backoff before the next attempt (skip the wait after the last one).
          if (attempt < MAX_POST_ATTEMPTS) {
            await new Promise((r) => setTimeout(r, 700 * attempt));
          }
        }

        // All recompute attempts exhausted → surface the error, but let a later
        // state change / manual retry try again (don't latch the attempt ref).
        console.error("[JourneyClient] analysis recompute exhausted", `lastMsg=${lastMsg}`);
        setAnalysisError(lastMsg);
        analysisFetchAttemptedRef.current = false;
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

  const question = questions[Math.min(index, total - 1)];

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

      // F3.2 — positioning is LOCAL to the active phase's `remaining` set; the
      // server's next_index is phase/global and is no longer used for the
      // client index. The server's `gate.phaseComplete` is AUTHORITATIVE for
      // "done" (reconciles any is_active skew between load and submit).
      const serverPhaseComplete: boolean = !!data.gate?.phaseComplete;
      // eslint-disable-next-line no-console
      console.log(
        "[answer] server response",
        `qid=${question.id}`,
        `captured=${capturedIndex}`,
        `optimistic=${optimisticNext}`,
        `phaseComplete=${serverPhaseComplete}`,
        `mode=${data.gate?.mode ?? "?"}`,
        `dataKeys=${Object.keys(data).join(",")}`,
      );
      track("journey_question_answered", {
        step: capturedIndex,
        question_id: question.id,
        locale,
      });
      // "Started the short assessment" — first answer saved successfully. Once
      // per visit (brief §A.2).
      if (capturedIndex === 0 && !startedFiredRef.current) {
        startedFiredRef.current = true;
        track("journey_assessment_started", { assessment_id: "journey" });
      }
      if (serverPhaseComplete || optimisticNext >= total)
        track("journey_completed", { total_steps: total, locale });

      if (!isAutoAdvance) {
        // Hold the reveal on screen for at least dwellMs even if the API
        // responded faster than the dwell. When skipReveal, dwellMs is 0.
        if (dwellMs > 0) {
          await new Promise((r) => window.setTimeout(r, dwellMs));
        }
        setReveal(null);
        const dest = serverPhaseComplete ? total : optimisticNext;
        setIndex(dest);
        if (dest > highWaterRef.current) highWaterRef.current = dest;
      } else if (serverPhaseComplete && optimisticNext < total) {
        // Skew: server says the phase is complete before the client's
        // remaining set is exhausted — jump to done after the dwell.
        window.setTimeout(() => {
          setIndex(total);
          if (total > highWaterRef.current) highWaterRef.current = total;
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
    // (GTM `generate_lead` fires upstream in InlineAuthStep's onNewSignup — only
    // for a genuinely NEW lead, at account creation. See InlineAuthStep.)
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
    // Itzik 2026-06-02: removed the "מסע הזוגיות שלכם" title + 100%
    // progress bar from this screen. Once the assessment is done and
    // the user is on the registration step, the focus is on completing
    // signup, not on celebrating progress. The InlineAuthStep below
    // renders its own centered celebration headline + badges.
    return (
      <div
        dir={locale === "he" ? "rtl" : "ltr"}
        className="relative z-10 mx-auto flex min-h-screen w-full max-w-[720px] flex-col px-4 py-[34px]"
      >
        {/* Light-theme signup (2026-07-01, docs/signup-light-mockup-approved.html):
            full-bleed cream surface + a soft brand-gradient wash, painted over
            the page's dark backdrop. Confetti (fired on isDone in JourneyClient)
            is canvas-based and stays bg-agnostic. */}
        <div
          aria-hidden
          className="fixed inset-0 z-[1]"
          style={{
            background:
              "radial-gradient(70% 55% at 50% 0%, rgba(214,64,159,.10), transparent 60%)," +
              "radial-gradient(60% 50% at 90% 20%, rgba(247,145,84,.10), transparent 55%)," +
              "#fcfaf7",
          }}
        />
        <div className="relative z-10 flex w-full flex-col items-center">
          <FunnelLogo locale={locale} theme="light" />
          <AnimatePresence mode="wait">
            <InlineAuthStep
              key="inline-auth"
              locale={locale}
              deviceId={deviceId}
              consent={consent}
              onAuthenticated={onAuthenticated}
            />
          </AnimatePresence>
        </div>
      </div>
    );
  }

  // ── Render: Analysis summary (authenticated + done) ──────────────────────
  if (isDone) {
    isDoneRenderCountRef.current += 1;
    console.log(
      "[JourneyClient] render isDone branch",
      `#${isDoneRenderCountRef.current}`,
      `hasAnalysis=${!!analysis}`,
      `analysisLoading=${analysisLoading}`,
      `analysisError=${analysisError ?? "(none)"}`,
      `authenticated=${authenticated}`,
      `subscriptionActive=${subscriptionActive}`,
    );

    // Surface error so the user isn't stuck on a generic loading message
    // when the fetch actually failed - they'll know to retry/contact us.
    if (analysisError && !analysis) {
      return (
        <div
          dir={locale === "he" ? "rtl" : "ltr"}
          className="relative mx-auto max-w-2xl space-y-4 p-10 text-center"
        >
          <JourneyOutroBackdrop />
          <FunnelLogo locale={locale} />
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

    // Wrap AnalysisSummary so the backdrop sits behind it without
    // changing the summary's own layout. `relative` on the wrapper
    // gives the backdrop's `inset-0` a containing block.
    return (
      <div className="relative">
        <JourneyOutroBackdrop />
        <AnalysisSummary
          analysis={analysis}
          locale={locale}
          journeySubscribed={journeySubscribed}
          journeyCadences={journeyCadences}
          activePromo={activePromo}
          offerExpiresAt={offerExpiresAt}
          promoMode={promoMode}
          personalWindowDisplay={personalWindowDisplay}
        />
        {/* Re-consent popup — self-gating (only shows for signed-in users who
            didn't opt in and haven't answered it yet). Results page only. */}
        <ReconsentPrompt />
      </div>
    );
  }

  // ── Render: Regular question (light theme — journey redesign 2026-07-01) ────
  const isHe = locale === "he";
  const isLast = index >= total - 1;
  return (
    <div
      dir={isHe ? "rtl" : "ltr"}
      className="relative z-10 mx-auto flex min-h-screen w-full max-w-[640px] flex-col px-[clamp(22px,5vw,40px)] pb-[clamp(22px,4vw,32px)] md:max-w-[1160px]"
    >
      {/* Full-bleed warm light surface for the question flow, painted OVER the
          page's dark backdrop + ambient orbs. Those stay in place for the dark
          auth-gate / analysis-summary screens (out of scope, unchanged); only
          the question flow renders this light layer. */}
      <div aria-hidden className="fixed inset-0 z-[1] bg-[#fffffc]" />

      <div className="relative z-10 flex w-full flex-1 flex-col items-center">
        <FunnelLogo locale={locale} theme="light" />

        {/* Progress: count centered ABOVE the bar (spec §5). */}
        <div className="w-full" style={{ marginBottom: GAP }}>
          <ProgressBar
            variant="light"
            locale={locale}
            current={phaseAnsweredBefore + index}
            total={phaseTotal}
          />
        </div>

        <div className="flex w-full flex-1 flex-col items-center">
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
                    isHe={isHe}
                    def={def}
                    onContinue={() => {
                      markInterstitialShown(def.atIndex);
                      setInterstitialIndex(null);
                    }}
                  />
                );
              })()
            ) : question ? (
              // Dispatch on question type. Ranking has its own drag UI;
              // every other type goes through QuestionStep.
              question.type === "ranking" ? (
                <PriorityRankingStep
                  key={question.id}
                  question={question}
                  locale={locale}
                  onSubmit={submitAnswer}
                  busy={busy}
                  initial={answersById[question.id] ?? null}
                  isLast={isLast}
                />
              ) : (
                <QuestionStep
                  key={question.id}
                  question={question}
                  locale={locale}
                  likertLabels={likertLabels}
                  onSubmit={submitAnswer}
                  busy={busy}
                  initial={answersById[question.id] ?? null}
                  variant="light"
                  isLast={isLast}
                />
              )
            ) : null}
          </AnimatePresence>

          {/* Per-question social-proof reveal banner (light). Sits BELOW the
              question so the percent surfaces under where the answer was. */}
          <AnimatePresence mode="wait">
            {reveal ? (
              <motion.div
                key={`reveal-${reveal.qid}`}
                initial={{ opacity: 0, y: -8, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.98 }}
                transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
                className="mt-8 w-full max-w-[440px] rounded-2xl border-[1.5px] border-[#efe7da] bg-white p-4 text-center shadow-[0_4px_16px_-12px_rgba(80,50,35,.35)] md:max-w-[560px]"
              >
                <p className="text-[18px] font-bold leading-snug text-[#2E2622]">
                  {reveal.percent}%{" "}
                  <CmsText cmsKey="journeyAssessment.client.revealSuffix" />
                </p>
              </motion.div>
            ) : null}
          </AnimatePresence>

          {error ? <p className="mt-4 text-sm font-semibold text-rose-600">{error}</p> : null}
        </div>

        {/* Back — subtle "חזרה ›" text link pinned bottom-left (inline-end in
            RTL), hidden on Q1. Stays in normal flow so it's visible on mobile
            (spec §5). No "דלג". */}
        {index > 0 ? (
          <div className="mt-auto flex w-full" style={{ marginTop: GAP }}>
            <button
              type="button"
              onClick={() => setIndex(Math.max(0, index - 1))}
              className="ms-auto inline-flex items-center gap-1.5 rounded-lg px-1.5 py-2.5 text-[15.5px] font-bold text-[#4a4441] transition hover:text-[#2E2622]"
              style={{ fontFamily: "var(--font-assistant), sans-serif" }}
            >
              {/* Word rendered directly (not CmsText): the seeded CMS row for
                  journeyAssessment.client.back carries a leading "← " arrow
                  that would clash with the "חזרה ›" chevron layout of the
                  light theme (spec §5). */}
              <span>{isHe ? "חזרה" : "Back"}</span>
              <span aria-hidden className="text-[18px] leading-none opacity-70">›</span>
            </button>
          </div>
        ) : null}
      </div>

      <PaywallGateModal
        open={paywallOpen}
        locale={locale}
        onClose={() => setPaywallOpen(false)}
        priceLabel={paywallPrice.label}
        originalLabel={paywallPrice.original}
      />
    </div>
  );
}

/**
 * JourneyOutroBackdrop — static, CSS-only gradient wash for the
 * post-questions stages (signup gate + analysis summary).
 *
 * 2026-05-19 — replaces the heavy `JourneyAmbience` (21 particles
 * × per-frame animation) that previously covered all of /assessment.
 * That component was the prime suspect for the Chrome-eats-the-machine
 * pattern Itzik reported. This backdrop renders the same warmth-cue
 * the user expected after finishing the assessment, but at literally
 * zero runtime cost: a stack of three radial gradients painted once,
 * pointer-events-none, z-0 behind the content. No JS, no framer-motion,
 * no animation loop.
 *
 * Palette deliberately mirrors `/journey` marketing hero (emerald +
 * amber + sky) so finishing the assessment lands the user back inside
 * the same "voyage" identity, not into the wine palette of `/games`.
 *
 * Sits absolute / inset-0 inside its parent. Parent should be
 * `relative` (the JSX trees that include this backdrop are wrapped
 * in containers; we add `relative` if not already present).
 */
function JourneyOutroBackdrop() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        // Wine/burgundy palette matching the Mioshy brand
        // (--accent #FCCA65 + magenta + violet). Replaces the earlier
        // voyage palette (emerald/amber/sky) per Itzik 2026-05-19 —
        // the green didn't fit the brand identity.
        background:
          "radial-gradient(1100px 640px at 14% 0%, rgba(252,202,101,0.32), transparent 62%), " +
          "radial-gradient(900px 520px at 88% 12%, rgba(217,70,239,0.22), transparent 60%), " +
          "radial-gradient(700px 460px at 50% 40%, rgba(139,38,56,0.20), transparent 65%)",
      }}
    />
  );
}
