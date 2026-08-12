"use client";

import { useEffect, Suspense } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { metaTrack, flushMetaPixelQueue } from "@/lib/analytics/meta-pixel";
import { hasAnalyticsConsent, onConsentDecided } from "@/lib/analytics/consent";

/**
 * Meta (Facebook) browser Pixel loader — deliberately a near-clone of
 * PostHogProvider so it shares the same battle-tested posture:
 *
 *   • Prod-only (NODE_ENV === "production") — zero pixel requests in dev.
 *   • GATED ON CONSENT — nothing loads until the visitor explicitly accepts.
 *     `dismissed` is a refusal and no cookie at all is not an answer; both mean
 *     fbevents.js is never fetched and no PageView is sent. See
 *     lib/analytics/consent.ts and P6 in SECURITY-FIX-PLAN.md.
 *   • Idle-deferred (requestIdleCallback) — never on the first-paint path.
 *   • Respects Do-Not-Track — DNT users get no pixel at all.
 *   • No-op when NEXT_PUBLIC_FB_PIXEL_ID is absent — missing env never breaks a
 *     build or a page.
 *
 * The server Conversions API layer (lib/analytics/meta-capi.ts) sends the same
 * conversion events with a shared eventID for deduplication.
 */

const PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID;

let initialised = false;

function dntEnabled(): boolean {
  if (typeof navigator === "undefined") return false;
  const dnt =
    (navigator as Navigator & { msDoNotTrack?: string }).msDoNotTrack ??
    navigator.doNotTrack ??
    (window as Window & { doNotTrack?: string }).doNotTrack;
  return dnt === "1" || dnt === "yes";
}

function initMetaPixel() {
  if (initialised || typeof window === "undefined" || !PIXEL_ID) return;
  if (dntEnabled()) return;
  initialised = true;

  // Standard Meta Pixel bootstrap (fbevents.js): define window.fbq as a queue,
  // then async-load the real script which drains it. Rewritten from the verbatim
  // snippet into lint-clean form (spread instead of arguments/.apply).
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const w = window as any;
  if (!w.fbq) {
    const n: any = (w.fbq = function (...args: unknown[]) {
      if (n.callMethod) n.callMethod(...args);
      else n.queue.push(args);
    });
    if (!w._fbq) w._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://connect.facebook.net/en_US/fbevents.js";
    const first = document.getElementsByTagName("script")[0];
    first?.parentNode?.insertBefore(script, first);
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */

  const fbq = (window as unknown as { fbq: (...a: unknown[]) => void }).fbq;
  fbq("init", PIXEL_ID);
  // Pixel is ready — mark ready + drain any events that fired during the idle
  // window before init (e.g. CompleteAssessment on a post-login summary remount)
  // so they aren't lost to the load race.
  flushMetaPixelQueue();
  // Landing PageView (fires directly now). metaTrack guards sensitive URLs.
  metaTrack("PageView");
}

/** Fire PageView on every App-Router navigation (after init). */
function PageviewTracker() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!initialised || !PIXEL_ID) return;
    metaTrack("PageView");
    // pathname/searchParams are the navigation signal.
  }, [pathname, searchParams]);

  return null;
}

export function MetaPixelProvider() {
  useEffect(() => {
    // Prod-only, mirroring PostHog/GTM. Nothing loads in dev.
    if (process.env.NODE_ENV !== "production") return;
    if (!PIXEL_ID) return;

    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void) => number;
      cancelIdleCallback?: (handle: number) => void;
    };
    const w = window as IdleWindow;
    let handle: number | undefined;

    // The gate — same shape as PostHogProvider. Re-checked when a decision
    // lands so accepting starts the pixel in this page view; refusing (or not
    // answering) means initMetaPixel is never reached, fbevents.js is never
    // fetched, and no PageView is sent.
    const startIfConsented = () => {
      if (handle !== undefined) return; // already scheduled
      if (!hasAnalyticsConsent()) return;
      // Defer to idle so the pixel never blocks first paint. requestIdleCallback
      // where supported, else a short timeout (Safari < 16, etc.).
      const ric =
        w.requestIdleCallback ??
        ((cb: () => void) => setTimeout(cb, 2000) as unknown as number);
      handle = ric(() => initMetaPixel());
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
    <Suspense fallback={null}>
      <PageviewTracker />
    </Suspense>
  );
}
