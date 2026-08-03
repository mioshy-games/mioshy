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
const PH_CLICK_EVENT = "survey_link_clicked";

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
