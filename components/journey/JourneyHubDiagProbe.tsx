"use client";

/**
 * Diagnostic probe for /[locale]/journey marketing.
 *
 * Renders nothing — only logs once on mount. Use it to confirm the
 * aurora wash, journey-orbit dots, and other ambient elements are
 * actually painted in the DOM with the expected computed styles.
 * Itzik reported 2026-05-19 that the gradient and orbits weren't
 * visible on his screen, so this probe surfaces:
 *
 *   - whether each layer exists in the DOM
 *   - its computed opacity / animation-name / transform
 *   - whether `prefers-reduced-motion` is on (would freeze the orbits)
 *   - the page-level viewport size (so we know if some layer was
 *     clipped by an unusual aspect ratio)
 *
 * Remove once the visibility is confirmed.
 */

import { useEffect } from "react";

export function JourneyHubDiagProbe() {
  useEffect(() => {
    if (typeof window === "undefined") return;

    const aurora = document.querySelector<HTMLElement>(
      '[data-testid="journey-aurora"]',
    );
    const orbits = Array.from(
      document.querySelectorAll<HTMLElement>(".journey-orbit"),
    );
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const auroraCS = aurora ? window.getComputedStyle(aurora) : null;

    console.log(
      "[/journey diag]",
      `vw=${window.innerWidth}×${window.innerHeight}`,
      `prefersReducedMotion=${reducedMotion}`,
      `auroraFound=${!!aurora}`,
      `auroraAnimation=${auroraCS?.animationName ?? "(n/a)"}`,
      `auroraOpacity=${auroraCS?.opacity ?? "(n/a)"}`,
      `auroraDisplay=${auroraCS?.display ?? "(n/a)"}`,
      `auroraZIndex=${auroraCS?.zIndex ?? "(n/a)"}`,
      `orbitsFound=${orbits.length}`,
    );

    if (orbits.length > 0) {
      const firstOrbitCS = window.getComputedStyle(orbits[0]!);
      console.log(
        "[/journey diag orbit-1]",
        `display=${firstOrbitCS.display}`,
        `position=${firstOrbitCS.position}`,
        `width=${firstOrbitCS.width}`,
        `height=${firstOrbitCS.height}`,
        `opacity=${firstOrbitCS.opacity}`,
        `animationName=${firstOrbitCS.animationName}`,
        `animationDuration=${firstOrbitCS.animationDuration}`,
        `animationPlayState=${firstOrbitCS.animationPlayState}`,
      );
    }
  }, []);

  return null;
}
