"use client";

import { useEffect } from "react";

/**
 * BreadcrumbBackdropProbe — diagnostic for the "breadcrumb sits on
 * black" mystery on /games (2026-05-19).
 *
 * Itzik reported: on /games the breadcrumb strip reads as solid black,
 * while on /journey the identical-looking code shows a wine + violet
 * wash. The two pages have copy-pasted gradient divs (same classes,
 * same `top:0`, same z-indices, same colors after this fix). Visually
 * they should be identical — but they're not.
 *
 * This probe walks the DOM at mount and logs:
 *   1. The breadcrumb nav's bounding rect + computed bg/color
 *   2. The two gradient divs' bounding rects + computed bg
 *   3. Every ancestor of the breadcrumb up to <body>, with its
 *      computed background-color — to find the opaque surface
 *      that's hiding the wine.
 *   4. The element AT the breadcrumb's centre via
 *      document.elementsFromPoint — tells us exactly which DOM
 *      node is being painted under the breadcrumb text.
 *
 * Remove once we know what's eating the gradient.
 */
export function BreadcrumbBackdropProbe() {
  useEffect(() => {
    // Tiny delay so layout + Chrome wrapper are fully painted before
    // we measure. Fast Refresh sometimes runs effects before the
    // layout pass completes.
    const id = window.setTimeout(() => {
      const nav = document.querySelector<HTMLElement>(
        'nav[aria-label="breadcrumb"]',
      );
      if (!nav) {
        console.warn("[BreadcrumbBackdropProbe] breadcrumb nav NOT found");
        return;
      }

      const navRect = nav.getBoundingClientRect();
      const navStyles = window.getComputedStyle(nav);

      const gradientWine = document.querySelector<HTMLElement>(
        ".pointer-events-none.absolute.-z-20",
      );
      const gradientRadial = document.querySelector<HTMLElement>(
        ".pointer-events-none.absolute.-z-10",
      );

      console.groupCollapsed(
        "%c[BreadcrumbBackdropProbe] /games breadcrumb backdrop diag",
        "color:#E9C4CA;font-weight:bold",
      );

      console.log("breadcrumb nav:", {
        rect: {
          top: Math.round(navRect.top),
          left: Math.round(navRect.left),
          width: Math.round(navRect.width),
          height: Math.round(navRect.height),
        },
        computed: {
          backgroundColor: navStyles.backgroundColor,
          color: navStyles.color,
          zIndex: navStyles.zIndex,
          position: navStyles.position,
        },
      });

      console.log("wine gradient div (-z-20):", gradientWine
        ? {
            rect: gradientWine.getBoundingClientRect(),
            computed: {
              backgroundColor:
                window.getComputedStyle(gradientWine).backgroundColor,
              backgroundImage:
                window.getComputedStyle(gradientWine).backgroundImage,
              zIndex: window.getComputedStyle(gradientWine).zIndex,
              position: window.getComputedStyle(gradientWine).position,
            },
          }
        : "NOT FOUND");

      console.log("radial gradient div (-z-10):", gradientRadial
        ? {
            rect: gradientRadial.getBoundingClientRect(),
            computed: {
              backgroundColor:
                window.getComputedStyle(gradientRadial).backgroundColor,
              backgroundImage:
                window.getComputedStyle(gradientRadial)
                  .backgroundImage.slice(0, 220) + "…",
              zIndex: window.getComputedStyle(gradientRadial).zIndex,
              position: window.getComputedStyle(gradientRadial).position,
            },
          }
        : "NOT FOUND");

      // 2 — Walk ancestors, listing each one's background and z-index.
      // If something has a non-transparent bg between the breadcrumb
      // and the gradient divs, THAT is what's painting over the wine.
      console.log("--- Ancestor chain of breadcrumb (innermost → root) ---");
      let el: HTMLElement | null = nav;
      let depth = 0;
      while (el && depth < 20) {
        const cs = window.getComputedStyle(el);
        const tag = el.tagName.toLowerCase();
        const cls =
          typeof el.className === "string"
            ? el.className.slice(0, 80)
            : "(non-string className)";
        console.log(
          `  ${depth} <${tag}> bg=${cs.backgroundColor} bgImg=${cs.backgroundImage === "none" ? "none" : "(image)"} pos=${cs.position} z=${cs.zIndex} class="${cls}"`,
        );
        el = el.parentElement;
        depth++;
      }

      // 3 — elementsFromPoint at the breadcrumb's centre. The first
      // element is the one being painted "above" the wine; everything
      // beneath is what should be visible if the upper ones were
      // transparent. The first non-transparent paint is the culprit.
      const probeX = navRect.left + navRect.width / 2;
      const probeY = navRect.top + navRect.height / 2;
      const stack = document.elementsFromPoint(probeX, probeY);
      console.log(`--- elementsFromPoint(${Math.round(probeX)},${Math.round(probeY)}) — top-down paint stack at breadcrumb centre ---`);
      stack.slice(0, 15).forEach((node, i) => {
        const cs = window.getComputedStyle(node as HTMLElement);
        const tag = node.tagName.toLowerCase();
        const cls =
          typeof (node as HTMLElement).className === "string"
            ? (node as HTMLElement).className.slice(0, 80)
            : "(non-string)";
        console.log(
          `  ${i} <${tag}> bg=${cs.backgroundColor} bgImg=${cs.backgroundImage === "none" ? "none" : "(image)"} class="${cls}"`,
        );
      });

      console.groupEnd();
    }, 120);
    return () => window.clearTimeout(id);
  }, []);

  return null;
}
