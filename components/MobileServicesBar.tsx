"use client";

import { useEffect, useState } from "react";
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
  { href: "/games", tKey: "games", Icon: Gamepad2 },
  { href: "/journey", tKey: "journey", Icon: Sparkles },
  { href: "/mioshy-sex", tKey: "adults", Icon: Heart },
] as const;

export function MobileServicesBar() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [footerVisible, setFooterVisible] = useState(false);

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

  if (isAssessment) return null;

  return (
    <nav
      aria-label={t("menu")}
      className={`fixed inset-x-0 bottom-0 z-40 lg:hidden transition-transform duration-300 ease-out ${
        footerVisible ? "translate-y-full" : "translate-y-0"
      }`}
      style={{
        // iOS safe-area: extends background under the home-indicator
        // strip but keeps the icons inside the safe zone.
        paddingBottom: "env(safe-area-inset-bottom, 0px)",
      }}
    >
      {/* Background + top accent. Per Itzik 2026-05-06 — wine→deep-purple
          gradient that matches the site palette. Performance: removed
          backdrop-blur-xl (audit found it was forcing GPU re-blur on
          every scroll tick). The gradient is now fully opaque, so blur
          isn't needed for legibility — and the bar is far cheaper to
          paint while scrolling. */}
      <div
        className="border-t border-[rgba(248,200,206,0.18)]"
        style={{
          background:
            "linear-gradient(180deg, #4A1721 0%, #3D1F3D 100%)",
          boxShadow:
            "0 -12px 32px -8px rgba(184,60,77,0.35), inset 0 1px 0 rgba(248,200,206,0.12)",
        }}
      >
        <ul className="mx-auto flex max-w-md items-stretch">
          {PILLARS.map(({ href, tKey, Icon }) => {
            // Active when the path starts with the pillar's marketing
            // route. e.g. /he/games → games active; /he/games/some-slug
            // is gameplay (Chrome hidden) so this never fires there.
            const isActive = pathname === href || pathname.startsWith(href + "/");
            return (
              <li key={href} className="flex-1">
                <Link
                  href={href}
                  className={`group flex h-full flex-col items-center justify-center gap-1.5 px-2 py-2.5 text-center transition-colors ${
                    isActive ? "text-white" : "text-white/85 hover:text-white"
                  }`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {/* Active indicator pill behind the icon. The active
                      pill uses the site's signature wine→pink gradient
                      and a soft glow ring; idle pills sit on a faint
                      cream tint so they read against the wine ground. */}
                  <span
                    className={`relative grid h-10 w-10 place-items-center rounded-full transition-all ${
                      isActive
                        ? "shadow-[0_6px_18px_rgba(248,200,206,0.45),0_0_0_2px_rgba(248,200,206,0.35)]"
                        : "bg-white/[0.10] group-hover:bg-white/[0.18]"
                    }`}
                    style={
                      isActive
                        ? {
                            background:
                              "linear-gradient(135deg,#F43F5E 0%,#B83C4D 100%)",
                          }
                        : undefined
                    }
                  >
                    <Icon
                      className={`h-[20px] w-[20px] ${
                        isActive ? "text-white" : ""
                      }`}
                      strokeWidth={2}
                      aria-hidden
                    />
                  </span>
                  {/* Label bumped 11→13px per Itzik 2026-05-06 — 14px is
                      the secondary-text floor; 13 here is acceptable
                      because it pairs with a 20px icon (visual anchor) and
                      goes on a saturated wine background where small text
                      reads cleaner. font-weight 600 holds it up. */}
                  <span
                    className="line-clamp-2 max-w-[96px] text-[13px] font-semibold leading-[1.15]"
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
