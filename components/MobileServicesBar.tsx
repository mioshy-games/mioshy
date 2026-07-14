"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/navigation";
import { Gamepad2, Sparkles, Heart, Target } from "@/components/icons/Icons";
import { ClipboardList } from "lucide-react";

/**
 * MobileServicesBar
 * ─────────────────
 * Persistent bottom tab-bar for mobile, anonymous visitors only.
 *
 * Design (per Itzik 2026-05-06):
 *   • Visible on every page, mobile only (`lg:hidden`, <1024px)
 *   • Mounted in <Chrome> behind `!isAuthed` — same gate as <SiteFooter>
 *   • 3 product pillars: /games, /journey, /adults
 *   • Full HE/EN labels (2-line wrap) — no abbreviated forms
 *   • Dark ink ground (#170E14) + wine accent (#B83C4D) for active item,
 *     to read clearly over both the dark hero and the cream sections
 *   • Hides itself when the <footer> enters the viewport, so the user
 *     can see the full footer at the bottom of the page
 *
 * Why this exists:
 *   The header (SiteHeader) auto-hides on scroll-down on mobile. Without
 *   a persistent surface, the 3 pillars would be 2 taps away (open
 *   hamburger → tap pillar). The bottom bar keeps them 1 tap away at all
 *   times — like a native mobile app.
 *
 * Routes are MARKETING ones (/games, /journey, /adults) because the bar
 * is only rendered for anonymous visitors. Authed users get the full
 * dashboard nav inside the header drawer.
 */

const PILLARS = [
  {
    href: "/games",
    tKey: "games",
    Icon: Gamepad2,
    // F9 — per-pillar accent so each tap target reads as its own button
    // (not just an icon on a coloured strip).
    accent: "linear-gradient(135deg, #F59E0B 0%, #F97316 100%)",
  },
  {
    href: "/journey",
    tKey: "journey",
    Icon: Sparkles,
    accent: "linear-gradient(135deg, #A855F7 0%, #6366F1 100%)",
  },
  {
    href: "/mioshy-sex",
    tKey: "adults",
    Icon: Heart,
    accent: "linear-gradient(135deg, #F43F5E 0%, #B83C4D 100%)",
  },
  {
    href: "/couples-assessment",
    tKey: "couplesAssessment",
    Icon: Target,
    accent: "linear-gradient(135deg, #8B5CF6 0%, #D6409F 100%)",
  },
  {
    href: "/survey",
    tKey: "surveyShort",
    Icon: ClipboardList,
    accent: "linear-gradient(135deg, #B83C4D 0%, #EC4899 55%, #F59E0B 100%)",
  },
] as const;

export function MobileServicesBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [footerVisible, setFooterVisible] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);
  // 2026-05-29 — visible on-screen debug overlay. Enable with
  // `?mbar=debug` in the URL on mobile (no DevTools / remote-inspect
  // needed). Shows live visualViewport values + the computed translate
  // so we can diagnose the floating-bar bug straight from the phone.
  // Reads the URL once on mount, no re-renders.
  const [debugInfo, setDebugInfo] = useState<string | null>(null);

  // W2.1 — hide on the assessment flow. The bottom bar sits on top of
  // the submit CTA + competing pillar links during a focused diagnostic
  // (#2). Path check covers /[locale]/journey/assessment and its nested
  // /intro route. We early-return null AFTER all hooks have been declared
  // to keep the hook order stable.
  const isAssessment =
    pathname === "/journey/assessment" ||
    pathname.startsWith("/journey/assessment/");

  // ── Footer occlusion guard ──────────────────────────────────────────
  // When the user scrolls all the way down, the page footer comes into
  // view. We slide the bar off-screen so the footer is fully visible —
  // otherwise the bar would permanently cover the bottom rows of the
  // footer's columns (Services / Explore / Info).
  useEffect(() => {
    const footer = document.querySelector("footer");
    if (!footer) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Any sliver of the footer means we should retract.
        const visible = entries.some((e) => e.isIntersecting);
        setFooterVisible(visible);
      },
      {
        // Trigger as soon as the top edge of the footer crosses into view.
        // No top margin — we don't want the bar to vanish prematurely
        // while the user is still reading the last content section.
        rootMargin: "0px 0px 0px 0px",
        threshold: 0,
      },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, [pathname]);

  // ── Chrome mobile URL-bar tracker (2026-05-18 + 2026-05-23, Itzik) ───
  //
  // Symptom A (fixed 2026-05-18): on the hero the bar is flush with the
  // screen bottom, but after scrolling UP (URL bar reappears) a gap
  // appeared between the bar and the bottom edge of the viewport.
  //
  // Symptom B (this fix, 2026-05-23): the inverse — when scrolling DOWN
  // in Chrome iOS the URL bar AND the bottom Chrome toolbar collapse
  // together; the visual viewport GROWS downward beyond the layout
  // viewport's bottom. The bar (anchored at `bottom: 0`, which references
  // the layout viewport's bottom) stays put and ends up ABOVE the new
  // visible bottom — creating a visible gap below the bar before the
  // screen edge.
  //
  // Cause: Chrome mobile distinguishes the *layout viewport* (what
  // `position: fixed; bottom: 0` anchors to) from the *visual viewport*
  // (what the user actually sees, which shrinks/grows as the URL bar
  // appears/collapses).
  //
  // Fix: read the live delta between layout-bottom and visual-bottom
  // from `window.visualViewport` (Chrome 61+, Safari 13+) and translate
  // the bar in EITHER direction. The previous version capped the offset
  // at 0 via `Math.max(0, …)`, which fixed symptom A but left symptom B
  // unhandled. Removing the cap means:
  //   • bottomGap > 0  (visual-bottom is ABOVE layout-bottom — URL bar
  //                     just appeared) → translate UP by bottomGap.
  //   • bottomGap < 0  (visual-bottom is BELOW layout-bottom — chrome
  //                     just collapsed)  → translate DOWN by |bottomGap|.
  //   • bottomGap = 0  → no offset needed.
  // In both cases `translate = -bottomGap` gives the right sign.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    const nav = navRef.current;
    // Debug overlay gate — read once. URL param ?mbar=debug shows live
    // values on screen for mobile diagnosis.
    const debugOn =
      new URLSearchParams(window.location.search).get("mbar") === "debug";
    if (!vv || !nav) {
      if (debugOn) setDebugInfo("vv=NULL or nav=NULL");
      return;
    }

    // 2026-05-20 — diagnostic console.log removed. Was throttled to
    // 200ms but the visualViewport resize event still fires on
    // every scroll tick on iOS Safari (URL-bar show/hide), so the
    // log appeared 50+ times in a single page load and showed up
    // as a measurable main-thread drag in Lighthouse runs.
    //
    // 2026-05-29 — CLAMP added after Itzik reported the bar floating
    // ~600-800px above the screen bottom in iOS Chrome. Root cause is
    // most likely an outlier visualViewport reading during pinch-zoom
    // or a layout-engine transient where vv.height temporarily reports
    // 0 / vv.offsetTop reports a large value, producing a huge
    // bottomGap and a catastrophic upward translate. The legitimate
    // drift between layout and visual viewports on mobile Chrome/Safari
    // is bounded by the height of the address bar + the home-indicator
    // zone — practically ≤ 120px. Anything larger is a glitch, so we
    // clamp and let the next animation frame self-correct. If a real
    // larger gap appears, raise MAX_VV_OFFSET; don't remove the clamp.
    const MAX_VV_OFFSET = 120;
    function update() {
      if (!vv || !nav) return;
      const vvH = vv.height;
      const vvT = vv.offsetTop;
      const winH = window.innerHeight;
      const docH = document.documentElement.clientHeight;
      // Sanity guard: a vv.height under half of innerHeight almost
      // always indicates a transient measurement (keyboard open,
      // pinch-zoom in progress). Skip rather than apply nonsense.
      const skip = vvH > 0 && vvH < winH * 0.5;
      const bottomGap = winH - (vvH + vvT);
      let translate = -Math.round(bottomGap * 2) / 2;
      const preClamp = translate;
      // Hard clamp — see 2026-05-29 note above.
      if (translate > MAX_VV_OFFSET) translate = MAX_VV_OFFSET;
      if (translate < -MAX_VV_OFFSET) translate = -MAX_VV_OFFSET;
      if (!skip) {
        nav.style.setProperty("--mobile-bar-vv-offset", `${translate}px`);
      }
      if (debugOn) {
        setDebugInfo(
          `winH=${winH} docH=${docH} vvH=${Math.round(vvH)} vvT=${Math.round(vvT)} gap=${Math.round(bottomGap)} pre=${preClamp} → tr=${translate}${skip ? " SKIP" : ""}`,
        );
      }
    }

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("orientationchange", update);

    // 2026-05-23 — Itzik flagged: bar leaves a gap below itself when
    // scrolling DOWN actively on iOS Chrome. Confirmed cause: neither
    // `visualViewport.scroll` nor `window.scroll` fire fast enough
    // during the active scroll gesture when the bottom toolbar
    // animates out. The bar lags behind the viewport bottom until
    // the gesture ends.
    //
    // Workaround: while a finger is on the screen, drive `update`
    // from a requestAnimationFrame loop so we recompute every frame
    // (≈16ms). Loop is started on `touchstart` and torn down on
    // `touchend` / `touchcancel`, so it costs nothing during static
    // viewing. Touch events are mobile-only by definition; desktop
    // mouse scrolling is unaffected.
    let rafId = 0;
    let touchActive = false;
    function frame() {
      if (!touchActive) return;
      update();
      rafId = requestAnimationFrame(frame);
    }
    function onTouchStart() {
      touchActive = true;
      if (!rafId) rafId = requestAnimationFrame(frame);
    }
    function onTouchEnd() {
      touchActive = false;
      // Two final updates after the gesture ends — one immediate,
      // one delayed past the chrome animation (Chrome iOS takes
      // ~250ms to finish the toolbar-collapse animation). Catches
      // the steady-state position so we don't leave a stale offset.
      update();
      window.setTimeout(update, 300);
      if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }
    window.addEventListener("touchstart", onTouchStart, { passive: true });
    window.addEventListener("touchend", onTouchEnd, { passive: true });
    window.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
      window.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  if (isAssessment) return null;

  return (
    <>
      {/* 2026-05-29 debug overlay — only renders when URL has
          ?mbar=debug. Sits top-center, monospace, semi-transparent;
          a tap dismisses it. Used to read live visualViewport values
          on the phone without remote-inspect. */}
      {debugInfo ? (
        <div
          onClick={() => setDebugInfo(null)}
          style={{
            position: "fixed",
            top: 8,
            left: 8,
            right: 8,
            zIndex: 99999,
            background: "rgba(0,0,0,0.85)",
            color: "#9eff9e",
            fontFamily: "ui-monospace, Menlo, monospace",
            fontSize: 11,
            lineHeight: 1.35,
            padding: "8px 10px",
            borderRadius: 8,
            pointerEvents: "auto",
            whiteSpace: "pre-wrap",
          }}
        >
          {debugInfo}
          <div style={{ marginTop: 4, color: "#888" }}>
            tap to dismiss · ?mbar=debug
          </div>
        </div>
      ) : null}
    <nav
      ref={navRef}
      aria-label={t("menu")}
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden transition-transform duration-300 ease-out"
      style={{
        // 2026-05-23 — Itzik reproduced "gap under bar on scroll-down"
        // bug. Diagnostic logs revealed: when iOS Chrome's bottom
        // toolbar collapses, `safe-area-inset-bottom` jumps from 0 to
        // 34px (home-indicator zone is exposed). Before, the
        // `padding-bottom: env(safe-area-inset-bottom)` lived HERE
        // on the outer nav, but the coloured gradient lived on the
        // inner <div>, so the 34px padding zone was transparent and
        // page content peeked through it → the perceived "gap".
        // Moved padding into the inner gradient div so the colour
        // extends THROUGH the home-indicator zone. The outer nav now
        // only handles positioning + the transform animation.
        // Transform composes TWO pieces:
        //   1. `--mobile-bar-vv-offset` — the visualViewport tracker
        //      (set in the useEffect above) handles edge cases where
        //      the visual and layout viewports drift apart during
        //      URL-bar collapse on Chrome iOS. Defaults to 0px when
        //      the two viewports match (the common case per the
        //      Vercel diagnostic — both viewports moved together).
        //   2. `100%` when the footer is visible — slides the bar off
        //      screen so the footer's bottom rows are readable.
        // We compute the transform inline rather than using Tailwind's
        // `translate-y-full` because Tailwind's class would clobber
        // the visualViewport offset.
        transform: footerVisible
          ? "translateY(100%)"
          : "translateY(var(--mobile-bar-vv-offset, 0px))",
        willChange: "transform",
      }}
    >
      {/* F9 — bar background uses the same fuchsia → purple → pink
          gradient as the header CTA so the strip pulls the eye and
          immediately reads as "an action surface". Each pillar is
          wrapped in a translucent card with a coloured icon plate so
          users can tell each item is independently clickable.
          2026-05-23 — `padding-bottom: env(safe-area-inset-bottom)`
          moved HERE from the outer <nav> so the gradient extends
          through the iPhone home-indicator zone. See the long
          comment on <nav> above. */}
      <div
        className="border-t border-white/20"
        style={{
          background:
            "linear-gradient(110deg, #d946ef 0%, #a855f7 35%, #ec4899 70%, #f59e0b 100%)",
          boxShadow:
            "0 -14px 36px -10px rgba(217,70,239,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <ul className="mx-auto flex max-w-md items-stretch gap-2 px-2 py-2">
          {PILLARS.map(({ href, tKey, Icon }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  // No card frame (Itzik 2026-07-13) — icon plate + label sit
                  // directly on the strip. Spacing + tap area (px/py + full
                  // height) preserved; active state cued by full opacity.
                  className={`group flex h-full flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 text-center text-white transition active:scale-[0.97] ${
                    isActive ? "opacity-100" : "opacity-90 hover:opacity-100"
                  }`}
                >
                  {/* Icon only — no coloured disc (Itzik 2026-07-14). The
                      transparent h-10/w-10 box preserves the row height and
                      tap area; the white glyph reads directly on the strip. */}
                  <span className="grid h-10 w-10 place-items-center">
                    <Icon
                      className="h-7 w-7 text-white"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </span>
                  <span
                    className="max-w-[110px] text-[13px] font-bold leading-[1.15]"
                    style={{ letterSpacing: "0.005em" }}
                  >
                    {t(tKey)}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
    </>
  );
}
