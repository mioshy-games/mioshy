"use client";

/**
 * AmbienceDebugProbe — DISABLED (2026-05-20).
 *
 * Used to run a 100ms-deferred audit that called getComputedStyle,
 * getBoundingClientRect, and elementFromPoint on every fog blob,
 * its ancestors, and the viewport centre — dozens of layout reads
 * inside the page's input-delay window. Diagnostic value is spent
 * and Itzik reports periodic full freezes on /mioshy-sex/[slug];
 * removing every client-side cost we can.
 *
 * Component now no-ops so existing call-sites keep compiling.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function AmbienceDebugProbe({ label: _label }: { label: string }) {
  return null;
}
