"use client";

/**
 * Diagnostic-only probe for /journey/assessment. Renders nothing - only
 * logs once on mount so we can confirm the wrapper actually renders with
 * the expected bg + child structure. Remove once Phase 1 ambience is
 * verified visually.
 */

import { useEffect } from "react";

export function AssessmentDiagProbe() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const wrapper = document.querySelector<HTMLElement>(
      '[data-testid="assessment-bg-base"]',
    );
    const ambience = document.querySelector<HTMLElement>(
      '[data-testid="journey-ambience"]',
    );
    const wrapperCs = wrapper ? window.getComputedStyle(wrapper) : null;
    // eslint-disable-next-line no-console
    console.log("[AssessmentPage] wrapper rendered", {
      wrapperFound: !!wrapper,
      wrapperRect: wrapper?.getBoundingClientRect(),
      wrapperOffsetHeight: wrapper?.offsetHeight,
      wrapperScrollHeight: wrapper?.scrollHeight,
      wrapperBg: wrapperCs?.backgroundColor,
      wrapperPosition: wrapperCs?.position,
      wrapperZIndex: wrapperCs?.zIndex,
      ambienceChildExists: !!ambience,
      ambienceIsDescendant:
        wrapper && ambience ? wrapper.contains(ambience) : null,
      childCount: wrapper?.children.length,
    });
  }, []);

  return null;
}
