"use client";

import { useEffect } from "react";
import { Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import posthog from "posthog-js";
import { PostHogProvider as PHProvider } from "posthog-js/react";

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
 *   Refresh fast). Init is deferred to the browser idle window so it never sits
 *   on the first-paint critical path; unlike GTM it does NOT wait for an
 *   interaction, because session replay should capture the session from as
 *   early as possible.
 *
 * NOTE: needs NEXT_PUBLIC_POSTHOG_KEY in the environment. If it's absent we
 * no-op silently, so missing-key never breaks a build or a page.
 */

const PH_KEY = process.env.NEXT_PUBLIC_POSTHOG_KEY;
// Region must match the project the API key belongs to (the #1 cause of a stuck
// "waiting for events" is a US key proxied to EU, or vice-versa). Defaults to
// EU; set NEXT_PUBLIC_POSTHOG_REGION=us to switch. The /ingest proxy + CSP in
// next.config.mjs read the same env so all three stay in sync.
const PH_REGION =
  (process.env.NEXT_PUBLIC_POSTHOG_REGION || "eu").toLowerCase() === "us"
    ? "us"
    : "eu";
// UI host is the real dashboard origin; api_host is our first-party proxy.
const PH_UI_HOST =
  process.env.NEXT_PUBLIC_POSTHOG_HOST || `https://${PH_REGION}.posthog.com`;

// Query params we never want to leave the browser, even inside a URL string.
const REDACT_QUERY_PARAMS = ["code", "token", "email", "invite", "ref_code"];

function sanitizeUrl(raw: unknown): unknown {
  if (typeof raw !== "string" || !raw) return raw;
  try {
    // raw can be absolute or path-only; give the URL ctor a base either way.
    const u = new URL(raw, "https://mioshy.com");
    let touched = false;
    for (const p of REDACT_QUERY_PARAMS) {
      if (u.searchParams.has(p)) {
        u.searchParams.set(p, "redacted");
        touched = true;
      }
    }
    if (!touched) return raw;
    // Return in the same shape we got it (path-only vs absolute).
    return raw.startsWith("http") ? u.toString() : u.pathname + u.search + u.hash;
  } catch {
    return raw;
  }
}

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

    // Defer to idle so init never blocks first paint. requestIdleCallback
    // where supported, otherwise a short timeout.
    // requestIdleCallback isn't in the standard lib.dom types, so we
    // narrow window to a shape that optionally exposes it. Fallback to
    // setTimeout when the browser doesn't have it (Safari < 16, etc.).
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const w = window as IdleWindow;
    const ric =
      w.requestIdleCallback ??
      ((cb: () => void) => setTimeout(cb, 2000) as unknown as number);
    const handle = ric(() => initPostHog());

    return () => {
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
