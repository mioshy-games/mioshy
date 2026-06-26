"use client";

/**
 * First-party global page_view (assessment-funnel-analytics-brief §0.2).
 *
 * Emits a `page_view` to /api/analytics/event on every App-Router navigation so
 * the page path, referrer and exit target are queryable in Supabase
 * (`analytics_events`) — not just in PostHog. Modeled after PostHogProvider's
 * PageviewTracker, but targets our first-party route and reuses the existing
 * `track()` → `buildPayload()` pipeline (no new transport).
 *
 * Unlike PostHog (prod-only), this runs in every environment so the funnel can
 * be verified locally. `path` and `referrer` are masked inside buildPayload, so
 * a partner-share `?code=` token never lands in analytics_events.
 */

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { trackPageView } from "@/lib/analytics";
import { getOrCreateDeviceId } from "@/lib/device-id";

function PageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    // Guarantee an anonymous device id exists so logged-out visitors are still
    // attributable by device_id (privacy approach A — metadata only). Writing
    // the cookie is synchronous, so buildPayload's readDeviceId sees it below.
    getOrCreateDeviceId();

    const search = searchParams?.toString();
    const url = pathname + (search ? `?${search}` : "");
    // Dedupe identical consecutive URLs (e.g. React Strict Mode's double effect
    // in dev) so one navigation logs exactly one page_view.
    if (lastUrl.current === url) return;
    lastUrl.current = url;

    // path is added (and masked) inside buildPayload; referrer is masked there.
    trackPageView({ referrer: document.referrer || null });
  }, [pathname, searchParams]);

  return null;
}

export function FirstPartyPageView() {
  // useSearchParams needs a Suspense boundary to keep the rest of the tree
  // statically renderable.
  return (
    <Suspense fallback={null}>
      <PageView />
    </Suspense>
  );
}
