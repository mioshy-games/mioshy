"use client";

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { pushToDataLayer } from "@/lib/analytics/gtm";

/**
 * GtmSpaPageView — pushes a `spa_page_view` event to the GTM dataLayer on every
 * client-side route change, so GA4 / Ads triggers can count each SPA navigation
 * (not just the initial gtm.js load).
 *
 * Skips the FIRST mount on purpose: the initial page view is already covered by
 * gtm.js's own init trigger, so pushing here too would double-count the landing
 * page. Subsequent navigations each fire once.
 *
 * Mirrors FirstPartyPageView's usePathname/useSearchParams + Suspense pattern
 * (useSearchParams requires a Suspense boundary in the App Router).
 */
function SpaPageView() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const firstRun = useRef(true);
  // Last URL we emitted for. Doubles as the React Strict-Mode / re-render guard:
  // the dev double-invoked effect sees the same URL and dedupes, so the initial
  // load never leaks a spa_page_view (in prod the firstRun skip alone suffices,
  // but this keeps dev honest too).
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    const search = searchParams?.toString();
    const pagePath = pathname + (search ? `?${search}` : "");

    // Initial load → gtm.js's own init already reports it; only emit on
    // subsequent client-side navigations. Record the URL so the Strict-Mode
    // second effect run dedupes instead of firing.
    if (firstRun.current) {
      firstRun.current = false;
      lastUrl.current = pagePath;
      return;
    }
    if (pagePath === lastUrl.current) return; // same URL (re-render / Strict Mode)
    lastUrl.current = pagePath;

    pushToDataLayer({
      event: "spa_page_view",
      page_path: pagePath,
      page_title: typeof document !== "undefined" ? document.title : "",
    });
  }, [pathname, searchParams]);

  return null;
}

export function GtmSpaPageView() {
  return (
    <Suspense fallback={null}>
      <SpaPageView />
    </Suspense>
  );
}
