"use client";

/**
 * Diagnostic probe for /games — added 2026-05-19 because Itzik reported
 * the new single-layer `.games-orbs-field` didn't appear visually while
 * yellow/amber-tinted dots WERE visible on the page. That doesn't match
 * the new rose/fuchsia/violet palette, so something else is painting
 * orbs alongside (or instead of) the new field.
 *
 * On mount, walks the DOM and logs every element that looks like an orb
 * source (the new field, the legacy `.games-orbit-*` spans, the live-
 * demo `.hero-orbs-field`, and any other particle-shaped class we know
 * about). For each found element we log:
 *   • presence (is it in the DOM at all)
 *   • computed opacity / display / position / z-index
 *   • bounding rect
 *   • whether its background-image actually contains paint info
 *
 * Remove after the source is identified.
 */

import { useEffect } from "react";

const CANDIDATES = [
  ".games-orbs-field",
  ".games-orbit",
  ".catalogue-orbs-field",
  ".catalogue-orbit",
  ".hero-orbs-field",
  ".journey-orbs-field",
  ".mio-particle-field",
  ".mio-particle",
  ".hero-spark",
  ".hero-orbit",
];

export function GamesOrbsDiagProbe() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const log = (phase: string) => {
      console.log(`[/games orbs diag ${phase}] vw=${window.innerWidth}`);
      for (const sel of CANDIDATES) {
        const list = document.querySelectorAll<HTMLElement>(sel);
        if (list.length === 0) {
          console.log(`  ${sel}: NOT FOUND`);
          continue;
        }
        const first = list[0]!;
        const cs = getComputedStyle(first);
        const r = first.getBoundingClientRect();
        const bgImg = cs.backgroundImage;
        const bgImgPreview = bgImg && bgImg !== "none"
          ? `${bgImg.slice(0, 80)}…`
          : "(none)";
        console.log(
          `  ${sel}: count=${list.length}`,
          `display=${cs.display}`,
          `opacity=${cs.opacity}`,
          `position=${cs.position}`,
          `zIndex=${cs.zIndex}`,
          `size=${Math.round(r.width)}x${Math.round(r.height)}`,
          `top=${Math.round(r.top)}`,
          `bgImage=${bgImgPreview}`,
        );
      }
    };
    log("mount");
    const t = setTimeout(() => log("settled"), 600);
    return () => clearTimeout(t);
  }, []);

  return null;
}
