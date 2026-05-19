"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/navigation";
import { Gamepad2, Sparkles, Heart } from "lucide-react";

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
] as const;

export function MobileServicesBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [footerVisible, setFooterVisible] = useState(false);
  const navRef = useRef<HTMLElement | null>(null);

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

  // ── Chrome mobile URL-bar tracker (2026-05-18, Itzik) ────────────────
  //
  // Symptom: on the hero the bar is flush with the screen bottom, but
  // after scrolling further down a gap appears between the bar and the
  // bottom edge of the viewport — the bar looks like it's floating in
  // mid-air rather than pinned to the screen.
  //
  // Cause: Chrome mobile distinguishes the *layout viewport* (what
  // `position: fixed; bottom: 0` anchors to) from the *visual viewport*
  // (what the user actually sees, which shrinks/grows as the URL bar
  // appears/collapses). Once the URL bar collapses during scroll, the
  // visual viewport grows but `bottom: 0` still references the layout
  // viewport's bottom — which is now ABOVE the visible screen bottom.
  //
  // Fix: read the live offset from `window.visualViewport` (Chrome 61+,
  // Safari 13+) and apply it as a translateY on a wrapper. The wrapper
  // gets repositioned every visualViewport `resize`/`scroll`, so the
  // bar stays pinned to the actual visible bottom.
  //
  // We instrument the path with console logs gated on `NODE_ENV !==
  // 'production'` so anyone reproducing the gap can read the exact
  // numbers (window.innerHeight, vv.height, vv.offsetTop, computed
  // offset, the bar's getBoundingClientRect). If the gap persists, the
  // log makes it obvious whether the visualViewport API isn't reporting
  // updates, or whether the translation is being clobbered by another
  // CSS rule.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const vv = window.visualViewport;
    const nav = navRef.current;
    if (!vv || !nav) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.log("[mobile-bar] visualViewport API unavailable — falling back to fixed positioning", {
          hasVV: !!vv,
          hasNav: !!nav,
        });
      }
      return;
    }

    let lastLog = 0;
    function update() {
      if (!vv || !nav) return;
      // Distance from the bottom of the layout viewport to the bottom
      // of the visual viewport. Positive when the visual viewport sits
      // higher on screen than the layout viewport's bottom edge — e.g.
      // when the URL bar is shown and pushes the visual viewport up.
      const bottomGap = window.innerHeight - (vv.height + vv.offsetTop);
      // Negative translateY pulls the bar UP into the visual viewport.
      // Clamp at 0 — we never want to push the bar DOWN past the
      // layout viewport (would hide it under the URL bar).
      const translate = -Math.max(0, bottomGap);
      nav.style.setProperty("--mobile-bar-vv-offset", `${translate}px`);

      // Throttled diagnostics — at most every 200ms so the console
      // doesn't drown during a scroll. Logs every resize regardless.
      if (process.env.NODE_ENV !== "production") {
        const now = Date.now();
        if (now - lastLog > 200) {
          lastLog = now;
          const rect = nav.getBoundingClientRect();
          // eslint-disable-next-line no-console
          console.log("[mobile-bar]", {
            innerH: window.innerHeight,
            vvH: vv.height,
            vvTop: vv.offsetTop,
            bottomGap,
            applied: translate,
            barTop: Math.round(rect.top),
            barBottom: Math.round(rect.bottom),
            visibleGapPx: Math.round(window.innerHeight - rect.bottom),
            scrollY: Math.round(window.scrollY),
          });
        }
      }
    }

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("orientationchange", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("scroll", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  if (isAssessment) return null;

  return (
    <nav
      ref={navRef}
      aria-label={t("menu")}
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden transition-transform duration-300 ease-out"
      style={{
        // iOS safe-area: extends background under the home-indicator
        // strip but keeps the icons inside the safe zone.
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
        // Transform composes TWO pieces:
        //   1. `--mobile-bar-vv-offset` — the visualViewport tracker
        //      (set in the useEffect above) pulls the bar up by the
        //      live gap between layout-viewport-bottom and visual-
        //      viewport-bottom on Chrome mobile during URL-bar
        //      collapse/expand. Defaults to 0px when the API is
        //      unavailable or there's no gap.
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
          users can tell each item is independently clickable. */}
      <div
        className="border-t border-white/20"
        style={{
          background:
            "linear-gradient(110deg, #d946ef 0%, #a855f7 35%, #ec4899 70%, #f59e0b 100%)",
          boxShadow:
            "0 -14px 36px -10px rgba(217,70,239,0.45), inset 0 1px 0 rgba(255,255,255,0.18)",
        }}
      >
        <ul className="mx-auto flex max-w-md items-stretch gap-2 px-2 py-2">
          {PILLARS.map(({ href, tKey, Icon, accent }) => {
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  aria-current={isActive ? "page" : undefined}
                  className={`group flex h-full flex-col items-center justify-center gap-1.5 rounded-2xl px-2 py-2.5 text-center transition active:scale-[0.97] ${
                    isActive
                      ? "bg-white text-[#170E14] shadow-[0_8px_22px_-8px_rgba(0,0,0,0.45)]"
                      : "bg-white/15 text-white hover:bg-white/25"
                  }`}
                >
                  {/* Coloured icon plate per pillar. Stays the pillar's
                      accent on both active and idle so users see the
                      colour cue without us having to invert. */}
                  <span
                    className="relative grid h-10 w-10 place-items-center rounded-full ring-1 ring-white/40 transition-all"
                    style={{
                      background: accent,
                      boxShadow: "0 4px 12px -4px rgba(0,0,0,0.35)",
                    }}
                  >
                    <Icon
                      className="h-[20px] w-[20px] text-white"
                      strokeWidth={2}
                      aria-hidden
                    />
                  </span>
                  <span
                    className="line-clamp-2 max-w-[96px] text-[15px] font-semibold leading-[1.15]"
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
  );
}
