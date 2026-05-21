"use client";

/**
 * MioshySexPerfProbe — DISABLED 2026-05-20.
 *
 * The PerformanceObserver inside this probe was keeping a perpetual
 * `longtask` subscription open AND console.log'ing every single
 * long task forever. With DevTools open, the console buffer grew
 * unbounded, and after a few minutes of page time the user's
 * machine slowed visibly — exactly the "more and more slow over
 * time" pattern Itzik reported. The observer also accumulated
 * cumulative-duration state on `window.__mioshyLongtaskTotal`
 * which prevented GC of related closures.
 *
 * The probe served its purpose (it identified GTM as the main
 * culprit, and the static `console.groupCollapsed` snapshot was
 * useful one-shot data). Disabled now to stop the leak. To
 * re-enable, see the git history for the full implementation.
 */
export function MioshySexPerfProbe() {
  return null;
}
