"use client";

/**
 * Survey funnel — link-click + landing tracking, one call per event, two tools.
 * ────────────────────────────────────────────────────────────────────────────
 * The Pixel's `PageView` already tells us who ARRIVED at /he/survey. It cannot
 * tell us who CLICKED, and that's the number that measures a link's placement
 * and creative. `SurveyLinkClick` closes that gap, and it's fired to Meta AND
 * PostHog from the same function so the two tools can never drift apart.
 *
 * Funnel: SurveyLinkClick → SurveyPageView → (later) survey completion.
 *
 * Everything here is a quiet no-op when the underlying tool isn't there — SSR,
 * dev (both providers are prod-only), Do-Not-Track, or an ad blocker. A click
 * must never be blocked and the console must stay clean.
 *
 * Callers should use <SurveyLink> / <SurveyNavLink> / <SurveyLinkRaw>
 * (components/analytics/SurveyLink.tsx) rather than calling this directly, so
 * there is exactly one place that knows the event shape.
 */

import posthog from "posthog-js";
import { metaTrackCustom } from "./meta-pixel";

/**
 * Where on the page the clicked link sits. A closed vocabulary on purpose:
 * Meta breakdowns and PostHog `link_location` filters are only comparable if
 * both sides spell the values identically.
 */
export type SurveyLinkLocation =
  | "nav"
  | "hero"
  | "footer"
  | "inline"
  | "banner";

export type SurveyLocale = "he" | "en";

/** Shared identity for the whole survey funnel, so `SurveyLinkClick` and
 *  `SurveyPageView` join up in Events Manager. */
const CONTENT_NAME = "israel_couples_survey";

// `trackCustom`, never `track` — these are not standard Meta events, and a
// non-standard name sent through `track` raises warnings in Events Manager.
const META_CLICK_EVENT = "SurveyLinkClick";
const META_PAGEVIEW_EVENT = "SurveyPageView";
const META_FIRST_ANSWER_EVENT = "SurveyFirstAnswer";
const PH_CLICK_EVENT = "survey_link_clicked";
const PH_FIRST_ANSWER_EVENT = "survey_first_answer";
const PH_ANSWERED_EVENT = "survey_answered";
const PH_COMPLETED_EVENT = "survey_completed";

/** sessionStorage keys — see the dedup notes on each tracker below. */
const SS_COMPLETED = "_mioshy_survey_completed";
const SS_STARTED_AT = "_mioshy_survey_started_at";

/**
 * Dedup id shared between the Pixel event (`eventID`) and the PostHog event
 * (`event_id`). Nothing consumes it yet — it exists so that adding a server
 * Conversions API twin later needs no client change and no back-fill.
 *
 * `crypto.randomUUID` requires a secure context, so fall back rather than throw
 * on a plain-http origin (local network testing, previews behind a proxy).
 */
function newEventId(): string {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") return c.randomUUID();
  } catch {
    /* fall through to the non-crypto id */
  }
  return `survey-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** PostHog is initialised at browser idle and only in production. Capturing
 *  before that logs a warning, so check first and stay silent otherwise. */
function capture(event: string, props: Record<string, unknown>): void {
  try {
    if (!posthog.__loaded) return;
    posthog.capture(event, props);
  } catch {
    /* analytics must never break a click */
  }
}

/**
 * Fire the click event to Meta and PostHog with identical properties.
 *
 * Called from an `onClick` on an internal `<Link>`: navigation is client-side,
 * there is no unload, and the beacon leaves normally. Nothing here delays the
 * navigation — no `setTimeout`, no `preventDefault`.
 */
export function trackSurveyLinkClick(
  location: SurveyLinkLocation,
  locale: SurveyLocale,
): void {
  if (typeof window === "undefined") return;

  const eventId = newEventId();
  const sourcePage = window.location.pathname;

  metaTrackCustom(
    META_CLICK_EVENT,
    {
      content_name: CONTENT_NAME,
      source_page: sourcePage,
      link_location: location,
      locale,
    },
    eventId,
  );

  capture(PH_CLICK_EVENT, {
    source_page: sourcePage,
    link_location: location,
    locale,
    event_id: eventId,
  });
}

/**
 * Fire the survey landing event. This is IN ADDITION to the site-wide Pixel
 * `PageView` that MetaPixelProvider already sends on every navigation — that
 * one is not touched, removed or duplicated here.
 */
export function trackSurveyPageView(locale: SurveyLocale): void {
  if (typeof window === "undefined") return;
  metaTrackCustom(META_PAGEVIEW_EVENT, {
    content_name: CONTENT_NAME,
    locale,
  });
}

// ─── Answering ───────────────────────────────────────────────────────────────
// Everything below is called from the handler for a SUCCESSFUL vote response —
// never from the button's onClick. The server decides what happened
// (`recordVote` → `{ ok, isFirstAnswer, totalAnswers }`, brief §3); this file
// only reports it. Firing on the click, or on a bare 200, would attribute
// campaign conversions to writes that never landed.

/** Stamp the start of this session's survey, once, so `survey_completed` can
 *  report a duration. Safe to call on every answer. */
function markSurveyStarted(): void {
  try {
    if (!window.sessionStorage.getItem(SS_STARTED_AT)) {
      window.sessionStorage.setItem(SS_STARTED_AT, String(Date.now()));
    }
  } catch {
    /* storage blocked — duration is simply reported as null */
  }
}

/**
 * A successful, verified answer.
 *
 * Fires `survey_answered` every time, and `SurveyFirstAnswer` +
 * `survey_first_answer` only when the SERVER says this was the person's first
 * ever — the Pixel event is the campaign conversion, so it must never fire
 * twice for the same person. Both halves of the first-answer pair share one
 * `event_id`/`eventID` so a server-side CAPI twin can dedupe later without a
 * client change.
 *
 * `answerIndex` is the server's `totalAnswers` — the person's own running count
 * — not a client tally, for the same reason "first" is decided server-side.
 */
export function trackSurveyAnswer(args: {
  locale: SurveyLocale;
  questionId: string;
  isFirstAnswer: boolean;
  totalAnswers: number;
}): void {
  if (typeof window === "undefined") return;
  markSurveyStarted();

  capture(PH_ANSWERED_EVENT, {
    locale: args.locale,
    question_id: args.questionId,
    answer_index: args.totalAnswers,
  });

  if (!args.isFirstAnswer) return;

  const eventId = newEventId();
  metaTrackCustom(
    META_FIRST_ANSWER_EVENT,
    { content_name: CONTENT_NAME, locale: args.locale },
    eventId,
  );
  capture(PH_FIRST_ANSWER_EVENT, {
    locale: args.locale,
    question_id: args.questionId,
    event_id: eventId,
  });
}

/**
 * The survey ran out of questions — `SurveyFlow` reached `status === "done"`.
 * See docs/survey-answer-event-brief.md §2.3 for why that is the terminal, and
 * why there is no count-based threshold.
 *
 * Once per SESSION, not once per lifetime: someone who returns after new
 * questions land and exhausts them again is a real completion. The guard is in
 * sessionStorage, so re-rendering or refreshing the end screen cannot re-fire.
 *
 * PostHog only — this describes exhausting the question stock, not purchase
 * intent, so it has no business in campaign optimisation.
 */
export function trackSurveyCompleted(args: {
  locale: SurveyLocale;
  questionsAnswered: number;
}): void {
  if (typeof window === "undefined") return;

  let durationMs: number | null = null;
  try {
    if (window.sessionStorage.getItem(SS_COMPLETED)) return; // already fired
    window.sessionStorage.setItem(SS_COMPLETED, "1");
    const startedAt = Number(window.sessionStorage.getItem(SS_STARTED_AT));
    if (Number.isFinite(startedAt) && startedAt > 0) durationMs = Date.now() - startedAt;
  } catch {
    // Storage blocked: we cannot dedupe, and a survey end screen that re-mounts
    // would fire twice. Staying silent is the safer failure — a missing event
    // is recoverable, an inflated completion count quietly is not.
    return;
  }

  capture(PH_COMPLETED_EVENT, {
    locale: args.locale,
    questions_answered: args.questionsAnswered,
    session_duration_ms: durationMs,
  });
}
