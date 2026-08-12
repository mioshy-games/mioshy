"use client";

import { useEffect } from "react";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";
import { sanitizeUrl } from "@/lib/analytics/redact-url";
import { hasAnalyticsConsent, onConsentDecided } from "@/lib/analytics/consent";

/**
 * PostHog loader for Mioshy — product analytics + heatmaps + session replay.
 *
 * Tailored to this codebase rather than the `@posthog/wizard` scaffold so it
 * matches our existing GTM/perf conventions (prod-only, deferred load) and the
 * extra privacy care this site needs: Mioshy renders intimate couples content,
 * so the replay config below is deliberately the MOST aggressive masking
 * PostHog offers.
 *
 * ── Privacy posture (Itzik 2026-06-07) ───────────────────────────────────────
 *   • EU region. Ingestion is reverse-proxied through `/ingest` (see
 *     next.config.mjs rewrites) so requests are first-party — fewer ad-blocker
 *     drops AND no third-party PostHog domain in the network tab. The real
 *     data still lands in eu.posthog.com.
 *   • Session replay masks EVERYTHING: all inputs + ALL on-screen text
 *     (`maskTextSelector: "*"`). Recordings show layout/interaction shapes, not
 *     the actual game prompts or anything a couple typed. Relax per-element
 *     later with the `ph-no-mask` class if a non-sensitive area needs to be
 *     legible.
 *   • Anything wrapped in `[data-ph-no-capture]` is fully blocked from replay.
 *   • URLs are sanitised before send — the partner-share `?code=` token (and
 *     `token`/`email` params) are redacted so pairing links never reach PostHog.
 *   • `respect_dnt: true` — visitors with Do-Not-Track are not recorded.
 *   • `person_profiles: "identified_only"` — anonymous visitors don't get a
 *     stored person profile; we only create one after `identify()` on login.
 *
 * ── Load strategy ────────────────────────────────────────────────────────────
 *   Prod-only (mirrors GoogleTagManager — keeps dev console quiet and Fast
 *   Refresh fast), and GATED ON CONSENT: nothing here loads until the visitor
 *   has explicitly accepted. Init is deferred to the browser idle window on top
 *   of that, so it never sits on the first-paint critical path.
 *
 *   Session replay therefore starts at the moment of acceptance, NOT at page
 *   load — by design, and it is the reason replay never covers the pre-consent
 *   part of a session. This comment used to say replay should capture "from as
 *   early as possible"; that intent was retired with the consent gate (P6 in
 *   SECURITY-FIX-PLAN.md). Anyone tempted to move the init earlier to recover
 *   those first seconds would be reintroducing the gap, so: don't.
 *
 *   `dismissed` is a refusal, not an absence — see lib/analytics/consent.ts.
 *   No cookie at all is also not consent. Both mean nothing loads.
 *
 * NOTE: needs NEXT_PUBLIC_POSTHOG_KEY in the environment. If it's absent we
 * no-op silently, so missing-key never breaks a build or a page.
 */

const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
// Region must match the project the API key belongs to (the #1 cause of a stuck
// "waiting for events" is a US key proxied to EU, or vice-versa). Itzik's
// project is on the US cloud → US default; set NEXT_PUBLIC_POSTHOG_REGION=eu to
// switch. The /ingest proxy + CSP in next.config.mjs read the same env so all
// three stay in sync.
const PH_REGION =
  (process.env.NEXT_PUBLIC_POSTHOG_REGION || "us").toLowerCase() === "eu"
    ? "eu"
    : "us";
// UI host is the real dashboard origin; api_host is our first-party proxy.
const PH_UI_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || `https://${PH_REGION}.posthog.com`;

// URL redaction (sanitizeUrl + REDACT_QUERY_PARAMS) now lives in
// lib/analytics/redact-url.ts so the first-party analytics pipeline masks
// identically. See that file for the param list and rationale.

let initialised = false;

function initPostHog() {
  if (initialised || typeof window === "undefined" || !PH_KEY) return;
  initialised = true;

  posthog.init(PH_KEY, {
    api_host: "/ingest",
    ui_host: PH_UI_HOST,

    // We create person profiles only for logged-in users (see PostHogIdentify).
    person_profiles: "identified_only",

    // App-Router SPA navigations are captured manually below, so turn off the
    // built-in pageview/leave auto-capture to avoid double counting.
    capture_pageview: false,
    capture_pageleave: true,

    // Honour Do-Not-Track — no recording for those visitors.
    respect_dnt: true,

    // Don't ship console logs into replay; they can contain data we'd rather
    // not store for an intimate-content product.
    enable_recording_console_log: false,

    session_recording: {
      // The two switches that make replay safe for this site:
      maskAllInputs: true,
      // "*" masks ALL text nodes — the strongest setting. Reviewers see
      // structure/interaction, never the actual words on screen.
      maskTextSelector: "*",
      maskInputOptions: {
        password: true,
        email: true,
      },
      // Fully blocked regions (rendered as a placeholder box in replay).
      blockSelector: "[data-ph-no-capture]",
      // Don't pull web-font files into the recording payload.
      collectFonts: false,
      recordCrossOriginIframes: false,
    },

    // Redact sensitive query params from every event property that carries a URL.
    sanitize_properties: (props) => {
      const next = { ...props };
      for (const key of [
        "$current_url",
        "$referrer",
        "$pathname",
        "$initial_current_url",
        "$initial_referrer",
      ]) {
        if (key in next) next[key] = sanitizeUrl(next[key]);
      }
      return next;
    },

    loaded: (ph) => {
      // Belt-and-suspenders: if a future env flips this off, honour it.
      if (process.env.NEXT_PUBLIC_POSTHOG_DEBUG === "true") ph.debug();
      // Capture the LANDING pageview here. Init is deferred to browser idle,
      // but PageviewTracker's first effect already ran (with initialised=false)
      // and won't re-fire until a route change — so without this the very first
      // page of a session never sent a $pageview (and a bounce sent nothing,
      // which reads as "no events"). Subsequent SPA navigations still flow
      // through PageviewTracker.
      const url = sanitizeUrl(
        window.location.pathname + window.location.search,
      );
      ph.capture("$pageview", { $current_url: url });
    },
  });
}

/** Fire a $pageview on every App-Router navigation, with the URL sanitised. */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!initialised || !PH_KEY) return;
    const search = searchParams?.toString();
    const url = sanitizeUrl(pathname + (search ? `?${search}` : ""));
    posthog.capture("$pageview", { $current_url: url });
  }, [pathname, searchParams]);

  return null;
}

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Prod-only, mirroring GoogleTagManager. Nothing loads in dev.
    if (process.env.NODE_ENV !== "production") return;
    if (!PH_KEY) return;

    // requestIdleCallback isn't in the standard lib.dom types, so we
    // narrow window to a shape that optionally exposes it. Fallback to
    // setTimeout when the browser doesn't have it (Safari < 16, etc.).
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const w = window as IdleWindow;
    let handle: number | undefined;

    // The gate. Called on mount and again when a decision lands, so accepting
    // starts PostHog in the same page view instead of the next one. Refusing —
    // or never answering — leaves this a no-op forever: `initPostHog` is never
    // reached, so posthog.init() never runs and not a single request is made.
    const startIfConsented = () => {
      if (handle !== undefined) return; // already scheduled
      if (!hasAnalyticsConsent()) return;
      // Defer to idle so init never blocks first paint.
      const ric =
        w.requestIdleCallback ??
        ((cb: () => void) => setTimeout(cb, 2000) as unknown as number);
      handle = ric(() => initPostHog());
    };

    startIfConsented();
    const off = onConsentDecided(startIfConsented);

    return () => {
      off();
      const cancel = w.cancelIdleCallback;
      if (cancel && typeof handle === "number") cancel(handle);
    };
  }, []);

  return (
    <PHProvider client={posthog}>
      <Suspense fallback={null}>
        <PageviewTracker />
      </Suspense>
      {children}
    </PHProvider>
  );
}
