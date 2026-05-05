"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/navigation";
import { useEffect, useState, useTransition } from "react";
import { Gamepad2, Heart, Library, LogOut, Menu, Sparkles, X } from "lucide-react";
import { JourneyNotificationsBell } from "@/components/notifications/JourneyNotificationsBell";
import { logoutAction } from "@/app/actions/auth-actions";

/**
 * SiteHeader - three-pillar navigation, theme-adaptive.
 * -----------------------------------------------------
 * The header lives inside the root layout, so it renders on every page -
 * some pages are dark-themed (home hero, /games, /adults, play pages),
 * others are light-themed (past-the-fold home sections, future light pages).
 *
 * Behaviour:
 *   • At the top of the page → transparent. The hero dictates its own
 *     contrast; the nav "floats" on it with a soft glass pill look.
 *   • After ~40px of scroll → becomes an opaque frosted bar. Bar tone
 *     follows the page theme (detected from `document.documentElement`'s
 *     data-header-theme attr, or - as a fallback - by sampling the
 *     background color of the element directly beneath the header).
 *
 * Pillars (always in this order for both locales, RTL keeps visual order):
 *   1. משחקים / Games          → /games
 *   2. ליווי עם מיאושי / Journey → /journey
 *   3. למבוגרים בלבד / Adults   → /adults
 */

type PillarKey = "games" | "journey" | "adults";

type PillarLink = {
  /** Where anonymous visitors land — the marketing page. */
  marketingHref: string;
  /** Where authenticated visitors land — their private dashboard. */
  authedHref: string;
  tKey: PillarKey;
  Icon: typeof Gamepad2;
  accent: string;
};

const PILLARS: PillarLink[] = [
  {
    marketingHref: "/games",
    authedHref: "/my/games",
    tKey: "games",
    Icon: Gamepad2,
    accent: "from-violet-400 via-fuchsia-400 to-cyan-400",
  },
  {
    marketingHref: "/journey",
    authedHref: "/my/journey",
    tKey: "journey",
    Icon: Sparkles,
    accent: "from-teal-300 via-indigo-400 to-purple-400",
  },
  {
    marketingHref: "/adults",
    authedHref: "/my/adults",
    tKey: "adults",
    Icon: Heart,
    accent: "from-rose-400 via-red-400 to-amber-400",
  },
];

// Header theme detection — kept as an opt-in only.
// Background-flipping while scrolling (light-glass over cream sections vs
// dark-glass over the hero) made the mobile experience feel unstable —
// the bar repainted on every scroll tick. We now LOCK to dark glass once
// scrolled, on every page, unless the page explicitly sets
// `<html data-header-theme="light">`. That gives editorial pages a way to
// opt into the inverted style when the whole page is light, but day-to-day
// users on the homepage / product pages get a single consistent dark bar.
function detectTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  const explicit = document.documentElement.dataset.headerTheme;
  if (explicit === "light" || explicit === "dark") return explicit;
  // No explicit opt-in → always dark. No more sampling, no more flip.
  return "dark";
}

interface SiteHeaderEntitlements {
  games: boolean;
  journey: boolean;
  adults: boolean;
}

export function SiteHeader({
  isAuthed = false,
  entitlements = null,
  unreadNotifications = 0,
}: {
  isAuthed?: boolean;
  /** Authenticated users still see all three pillars; entitlements only
   *  decide whether each pillar links to its private dashboard or to its
   *  marketing page. Anonymous users always see the marketing pages. */
  entitlements?: SiteHeaderEntitlements | null;
  /** v3 slice 10 — drives the bell badge for signed-in users. */
  unreadNotifications?: number;
}) {
  // All three pillars are ALWAYS rendered — for both anonymous and
  // authenticated visitors, on desktop and mobile. Only the destination
  // changes based on entitlements:
  //
  //   - Anonymous OR authenticated without entitlement → marketingHref
  //     (e.g. /games). The user can still discover the product.
  //   - Authenticated WITH entitlement → authedHref (e.g. /my/games).
  //
  // Hiding pillars from non-entitled users (the previous behaviour)
  // turned out to make the header feel inconsistent across sessions and
  // hid the product surface from existing customers who might want to
  // upgrade.
  // Resolve which pillar links the current visitor sees.
  //   - Anonymous → all three marketing pillars
  //   - Authenticated, OWNS pillar X → /my/X (private)
  //   - Authenticated, does NOT own pillar X → pillar HIDDEN (not just
  //     re-routed). Per spec §11 the header is never a marketing
  //     surface once the user is signed in.
  const visiblePillars = PILLARS.flatMap((p) => {
    if (!isAuthed) {
      return [
        {
          href: p.marketingHref,
          tKey: p.tKey,
          Icon: p.Icon,
          accent: p.accent,
        },
      ];
    }
    const owns = entitlements ? entitlements[p.tKey] : false;
    if (!owns) return [];
    return [
      {
        href: p.authedHref,
        tKey: p.tKey,
        Icon: p.Icon,
        accent: p.accent,
      },
    ];
  });
  const locale = useLocale();
  const pathname = usePathname();
  const isHe = locale === "he";
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isPending, startTransition] = useTransition();

  // ⚠️ BUILD MARKER — fires once per mount, confirms the entitlement-
  // aware header is the version actually running on the client. If
  // the log is missing in DevTools after a deploy, the new code
  // didn't ship.
  useEffect(() => {
    console.log("[SiteHeader] BUILD=2026-04-30-phaseD-gating v1", {
      isAuthed,
      entitlements,
      visiblePillarKeys: visiblePillars.map((p) => p.tKey),
      pillarsHrefs: visiblePillars.map((p) => p.href),
    });
    // Empty deps — log once per mount only, not on every scroll tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Track scroll + theme on mount and on scroll. We intentionally resample
  // the theme on every scroll tick - switching between dark hero and light
  // sections should flip the header tone live.
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 40);
      setTheme(detectTheme());
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const handleLogout = () => {
    startTransition(async () => {
      await logoutAction();
      window.location.assign(`/${locale}`);
    });
  };

  // ─── Themed classes ────────────────────────────────────────────────────────
  // At the top: always transparent (hero dictates). When scrolled: switch
  // between a dark glass (`bg-black/45`) and a light glass (`bg-white/80`)
  // based on what the header is hovering over.
  // Visual mode: "float" when at the top, "dark" when scrolled over dark,
  // "light" when scrolled over light content. We branch on this instead of
  // interpolating dynamic Tailwind classes (which JIT wouldn't pick up).
  const mode: "float" | "dark" | "light" =
    !scrolled ? "float" : theme === "light" ? "light" : "dark";

  const barBg =
    mode === "float"
      ? "bg-transparent border-transparent shadow-none"
      : mode === "light"
        ? "bg-white/80 border-slate-200/70 shadow-[0_4px_24px_-12px_rgba(17,24,39,0.18)]"
        : "bg-[linear-gradient(135deg,rgba(15,8,40,0.95)_0%,rgba(9,5,28,0.95)_50%,rgba(14,7,38,0.95)_100%)] border-violet-800/20 shadow-[0_4px_32px_-8px_rgba(80,0,180,0.35)]";

  const textFg =
    mode === "light" ? "text-slate-900" : "text-white";

  // Subtle (nav-link rest) + hover-to-strong foreground pairs. We always
  // write out the full hover: class so Tailwind keeps it in the build.
  const linkBase =
    mode === "light"
      ? "text-slate-700 hover:text-slate-900"
      : mode === "float"
        ? "text-white/85 hover:text-white"
        : "text-white/85 hover:text-white";

  const ghostBorder =
    mode === "light" ? "border-slate-300/70" : "border-white/15";

  const ghostBg =
    mode === "light"
      ? "bg-white/60 hover:bg-white/80"
      : "bg-white/5 hover:bg-white/10";

  // Logo swap: the project only ships mioshy-white.svg. On light-scrolled
  // state we darken it via a CSS filter (invert + slight hue correction).
  const logoFilter =
    scrolled && theme === "light"
      ? "invert(1) hue-rotate(180deg) saturate(1.2) brightness(0.85)"
      : "none";

  return (
    <header
      className={`sticky top-0 z-50 border-b backdrop-blur-xl transition-all duration-300 ${barBg}`}
    >
      {/* Top-of-page gradient hair - only when transparent, to keep identity. */}
      {!scrolled ? (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-fuchsia-400/40 to-transparent"
        />
      ) : null}

      <div
        className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3"
        dir={isHe ? "rtl" : "ltr"}
      >
        {/* ─────── Logo ─────── */}
        <Link
          href="/"
          className={`flex shrink-0 items-center gap-2 text-lg font-bold tracking-tight transition ${textFg}`}
          aria-label="Mioshy"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mioshy-white.svg"
            alt="Mioshy"
            className="h-10 w-auto sm:h-12"
            width={171}
            height={81}
            style={{ filter: logoFilter, transition: "filter 220ms ease" }}
          />
        </Link>

        {/* ─────── Pillar links (desktop) ─────── */}
        <nav className="hidden items-center gap-1 lg:flex">
          {visiblePillars.map((p) => {
            const isActive = pathname.startsWith(p.href);
            return (
              <Link
                key={p.href}
                href={p.href}
                className={`group relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-base font-medium transition ${linkBase} ${
                  isActive
                    ? mode === "light"
                      ? "bg-slate-100"
                      : "bg-white/10"
                    : ""
                }`}
              >
                <p.Icon
                  className={`h-4 w-4 transition ${
                    isActive ? "opacity-100" : "opacity-75 group-hover:opacity-100"
                  }`}
                />
                <span>{t(p.tKey)}</span>
                <span
                  aria-hidden
                  className={`pointer-events-none absolute inset-x-3 bottom-1 h-[2px] origin-center rounded-full bg-gradient-to-r ${p.accent} transition-transform duration-200 ${
                    isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        {/* ─────── Auth area (desktop) ─────── */}
        <div className="hidden items-center gap-2 md:flex">
          {isAuthed ? (
            <>
              <Link
                href="/my"
                className={`inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-base font-semibold transition ${ghostBorder} ${ghostBg} ${textFg}`}
              >
                <Library className="h-4 w-4" />
                {t("library")}
              </Link>
              <JourneyNotificationsBell
                initialUnreadCount={unreadNotifications}
                isHe={isHe}
              />
              <button
                type="button"
                onClick={handleLogout}
                disabled={isPending}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-base font-medium transition disabled:opacity-60 ${linkBase}`}
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">{t("signOut")}</span>
              </button>
            </>
          ) : (
            <>
              <Link
                href="/auth"
                className={`text-base font-medium transition ${linkBase}`}
              >
                {t("signIn")}
              </Link>
              {/* Primary CTA in the header is now "ליווי עם מיאושי" → /journey
                  rather than the generic "Sign up" → /auth/signup. The
                  flagship product is Journey and the header is its biggest
                  conversion surface. New visitors who click discover the
                  product first; signup happens naturally during purchase. */}
              <Link
                href="/journey"
                className="group relative inline-flex min-h-[40px] items-center justify-center overflow-hidden rounded-full px-5 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(110deg,#d946ef_0%,#a855f7_35%,#ec4899_70%,#f59e0b_100%)] bg-[length:220%_100%] mio-nav-cta-shift"
                />
                <span className="relative z-10">
                  {isHe ? "ליווי עם מיאושי" : "Mioshy Journey"}
                </span>
              </Link>
            </>
          )}
        </div>

        {/* ─────── Mobile compact actions (auth + toggle) ───────
            On screens below `md` (mobile / phablet) the desktop auth
            block is hidden, which used to leave the user without a
            one-tap shortcut to their library - they had to open the
            hamburger drawer first. We now surface a compact "מיאושי
            שלי" pill alongside the hamburger so authenticated users
            can jump straight into /my, and unauthenticated users get
            a lightweight Sign-up CTA in the same slot. The full nav
            still lives inside the drawer. */}
        <div className="flex items-center gap-2 lg:hidden">
          {isAuthed ? (
            <Link
              href="/my"
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-semibold transition md:hidden ${ghostBorder} ${ghostBg} ${textFg}`}
              aria-label={t("library")}
            >
              <Library className="h-4 w-4" />
              <span>{t("library")}</span>
            </Link>
          ) : (
            // Mobile primary CTA — same swap as desktop: "ליווי עם מיאושי"
            // → /journey instead of "Sign up" → /auth/signup. Slightly
            // more compact label so it fits in the cramped mobile header
            // alongside the hamburger.
            <Link
              href="/journey"
              className="group relative inline-flex min-h-[36px] items-center justify-center overflow-hidden rounded-full px-4 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/25 transition hover:brightness-110 md:hidden"
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(110deg,#d946ef_0%,#a855f7_35%,#ec4899_70%,#f59e0b_100%)] bg-[length:220%_100%] mio-nav-cta-shift"
              />
              <span className="relative z-10">
                {isHe ? "ליווי מיאושי" : "Journey"}
              </span>
            </Link>
          )}

          <button
            className={`rounded-full border p-2 transition ${ghostBorder} ${textFg}`}
            onClick={() => setOpen((o) => !o)}
            aria-label={t("menu")}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* ─────── Mobile drawer ─────── */}
      {open ? (
        <div
          className={`border-t backdrop-blur-xl lg:hidden ${
            theme === "light"
              ? "border-slate-200 bg-white/95 text-slate-900"
              : "border-white/10 bg-black/75 text-white"
          }`}
          dir={isHe ? "rtl" : "ltr"}
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {visiblePillars.map((p) => {
              const isActive = pathname.startsWith(p.href);
              return (
                <Link
                  key={p.href}
                  href={p.href}
                  onClick={() => setOpen(false)}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium transition ${
                    isActive
                      ? theme === "light"
                        ? "bg-slate-100 font-semibold"
                        : "bg-white/10 font-semibold"
                      : theme === "light"
                        ? "hover:bg-slate-100"
                        : "hover:bg-white/5"
                  }`}
                >
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${p.accent} shadow-lg shadow-black/40 ${isActive ? "ring-2 ring-white/30" : ""}`}
                  >
                    <p.Icon className="h-4 w-4 text-white" />
                  </span>
                  <span>{t(p.tKey)}</span>
                  {isActive && (
                    <span
                      aria-hidden
                      className={`ms-auto h-2 w-2 rounded-full bg-gradient-to-br ${p.accent}`}
                    />
                  )}
                </Link>
              );
            })}

            <div className={`my-2 h-px ${theme === "light" ? "bg-slate-200" : "bg-white/10"}`} />

            {isAuthed ? (
              <>
                <Link
                  href="/my"
                  onClick={() => setOpen(false)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-3 text-base font-semibold transition ${
                    theme === "light" ? "hover:bg-slate-100" : "hover:bg-white/5"
                  }`}
                >
                  <Library className="h-5 w-5" />
                  {t("library")}
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    handleLogout();
                  }}
                  disabled={isPending}
                  className={`inline-flex items-center gap-2 rounded-xl px-3 py-3 text-base font-medium transition disabled:opacity-60 ${
                    theme === "light" ? "text-slate-700 hover:bg-slate-100" : "text-white/75 hover:bg-white/5"
                  }`}
                >
                  <LogOut className="h-5 w-5" />
                  {t("signOut")}
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth"
                  onClick={() => setOpen(false)}
                  className={`rounded-xl px-3 py-3 text-base font-medium transition ${
                    theme === "light" ? "text-slate-700 hover:bg-slate-100" : "text-white/85 hover:bg-white/5"
                  }`}
                >
                  {t("signIn")}
                </Link>
                {/* Drawer primary CTA — Journey, matching the desktop +
                    mobile header buttons. Replaces the previous Sign-up
                    button so the entire site funnels new visitors into
                    the flagship product first. */}
                <Link
                  href="/journey"
                  onClick={() => setOpen(false)}
                  className="mt-1 inline-flex min-h-[44px] items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 px-5 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/25"
                >
                  {isHe ? "ליווי עם מיאושי" : "Mioshy Journey"}
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Keyframes for the signup-CTA gradient drift. Defined once, global. */}
      <style jsx global>{`
        @keyframes mio-nav-cta-shift {
          0%, 100% { background-position: 0% 50%; }
          50%      { background-position: 100% 50%; }
        }
        .mio-nav-cta-shift {
          animation: mio-nav-cta-shift 7s ease-in-out infinite;
        }
      `}</style>
    </header>
  );
}
