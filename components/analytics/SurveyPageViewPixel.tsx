"use client";

import { useEffect, useRef } from "react";
import { trackSurveyPageView } from "@/lib/analytics/survey-link";

/**
 * Fires the custom Meta `SurveyPageView` on the survey page, completing the
 * funnel SurveyLinkClick → SurveyPageView → (later) survey completion.
 *
 * This is IN ADDITION to the site-wide Pixel `PageView` that MetaPixelProvider
 * sends on every navigation — that one is untouched here, and must keep firing
 * exactly once per page.
 *
 * The ref guard keeps a React 18 StrictMode double-mount (dev) or a re-render
 * from sending it twice. Mount-once by design: the survey page is a single
 * route, so there is no navigation to re-fire on.
 */
export function SurveyPageViewPixel({ locale }: { locale: "he" | "en" }) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackSurveyPageView(locale);
  }, [locale]);

  return null;
}
