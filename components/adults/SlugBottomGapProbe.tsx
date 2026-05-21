"use client";

import { useEffect } from "react";

/**
 * SlugBottomGapProbe — 2026-05-20 diagnostic for the persistent
 * "dark band at the bottom of the product page" symptom. Removing
 * `min-h-[100dvh]` from the page wrapper didn't fix it, so this
 * probe measures the actual rendered positions of every relevant
 * ancestor and dumps them to the console — letting us see exactly
 * which container has the extra height contribution.
 *
 * Reads:
 *   - the page wrapper bottom Y
 *   - the Chrome flex-1 container bottom Y
 *   - the SiteFooter top Y
 *   - the viewport height + scroll height
 *
 * Logs once on mount + once per resize.
 */

export function SlugBottomGapProbe() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const tag = "[slug-gap]";

    const log = (label: string) => {
      const main = document.querySelector("main");
      const mainRect = main?.getBoundingClientRect();
      const wrapper = main?.parentElement;
      const wrapperRect = wrapper?.getBoundingClientRect();
      const flex1 = wrapper?.parentElement;
      const flex1Rect = flex1?.getBoundingClientRect();
      const chrome = flex1?.parentElement;
      const chromeRect = chrome?.getBoundingClientRect();
      const footer = document.querySelector("footer");
      const footerRect = footer?.getBoundingClientRect();

      // eslint-disable-next-line no-console
      console.log(`${tag} ${label}`, {
        viewport: { w: window.innerWidth, h: window.innerHeight },
        documentScrollHeight: document.documentElement.scrollHeight,
        bodyScrollHeight: document.body.scrollHeight,
        main: mainRect && {
          top: Math.round(mainRect.top),
          bottom: Math.round(mainRect.bottom),
          height: Math.round(mainRect.height),
        },
        wrapper: wrapperRect && {
          tag: wrapper?.tagName.toLowerCase(),
          classes: wrapper?.className.slice(0, 80),
          top: Math.round(wrapperRect.top),
          bottom: Math.round(wrapperRect.bottom),
          height: Math.round(wrapperRect.height),
        },
        flex1: flex1Rect && {
          classes: flex1?.className.slice(0, 80),
          top: Math.round(flex1Rect.top),
          bottom: Math.round(flex1Rect.bottom),
          height: Math.round(flex1Rect.height),
        },
        chrome: chromeRect && {
          classes: chrome?.className.slice(0, 80),
          top: Math.round(chromeRect.top),
          bottom: Math.round(chromeRect.bottom),
          height: Math.round(chromeRect.height),
        },
        footer: footerRect && {
          top: Math.round(footerRect.top),
          bottom: Math.round(footerRect.bottom),
          height: Math.round(footerRect.height),
        },
        // The crucial number — the visible gap between the bottom of
        // the dark wrapper and the top of whatever sits below it.
        gapWrapperToFooter:
          wrapperRect && footerRect
            ? Math.round(footerRect.top - wrapperRect.bottom)
            : null,
        gapWrapperToFlex1Bottom:
          wrapperRect && flex1Rect
            ? Math.round(flex1Rect.bottom - wrapperRect.bottom)
            : null,
      });
    };

    // Two reads — once right after layout, once after fonts/images
    // settle. Use a microtask + a 500ms timeout.
    queueMicrotask(() => log("first-paint"));
    const t = window.setTimeout(() => log("settled-500ms"), 500);
    const onResize = () => log("resize");
    window.addEventListener("resize", onResize);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return null;
}
