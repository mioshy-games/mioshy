"use client";

import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
// 2026-05-20 — swapped to local inline-SVG icons. SiteHeader renders
// on every page (including /mioshy-sex with its long INP) so the
// cumulative React-component-overhead win is broad.
import { ClipboardList, Gamepad2, Heart, Home, Library, LogOut, Menu, Sparkles, Target, X } from "@/components/icons/Icons";
import { JourneyNotificationsBell } from "@/components/notifications/JourneyNotificationsBell";
import { SurveyNavLink } from "@/components/analytics/SurveyLink";
import { CmsText } from "@/components/cms/CmsText";
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

type PillarKey = "games" | "journey" | "adults" | "couplesAssessment" | "survey";

type PillarLink = {
  /** Where anonymous visitors land - the marketing page. */
  marketingHref: string;
  /** Where authenticated visitors land - their private dashboard. */
  authedHref: string;
  tKey: PillarKey;
  /** Optional display-label override (defaults to tKey). Lets a pillar keep its
   *  logic key while showing a different nav label, e.g. survey → surveyShort. */
  labelKey?: PillarKey | "surveyShort";
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
    marketingHref: "/mioshy-sex",
    authedHref: "/my/adults",
    tKey: "adults",
    Icon: Heart,
    accent: "from-rose-400 via-red-400 to-amber-400",
  },
  {
    marketingHref: "/couples-assessment",
    authedHref: "/couples-assessment",
    tKey: "couplesAssessment",
    Icon: Target,
    accent: "from-violet-400 via-fuchsia-400 to-amber-300",
  },
  {
    // Public daily-poll flow — same target for anon + authed (/he/survey).
    marketingHref: "/survey",
    authedHref: "/survey",
    tKey: "survey",
    // Header shows the SHORT label ("סקר הזוגיות"); tKey stays "survey" for logic.
    labelKey: "surveyShort",
    Icon: ClipboardList,
    accent: "from-rose-400 via-fuchsia-400 to-amber-300",
  },
];

// Header theme detection - kept as an opt-in only.
// Background-flipping while scrolling (light-glass over cream sections vs
// dark-glass over the hero) made the mobile experience feel unstable -
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
  trialEndsAt = null,
}: {
  isAuthed?: boolean;
  /** Authenticated users still see all three pillars; entitlements only
   *  decide whether each pillar links to its private dashboard or to its
   *  marketing page. Anonymous users always see the marketing pages. */
  entitlements?: SiteHeaderEntitlements | null;
  /** v3 slice 10 - drives the bell badge for signed-in users. */
  unreadNotifications?: number;
  /** A3/task 21 — trial deadline; renders the persistent "יום X מתוך 7" chip. */
  trialEndsAt?: string | null;
}) {
  // A3/task 21 — trial-day for the header chip (status, not closeable). Day 1 on
  // signup (~7d left) → day 7 on the last day. Clamped [1,7].
  const trialDay = (() => {
    if (!trialEndsAt) return null;
    const remainingMs = new Date(trialEndsAt).getTime() - Date.now();
    const remainingDays = Math.ceil(remainingMs / 86_400_000);
    return Math.min(7, Math.max(1, 8 - remainingDays));
  })();
  // All three pillars are ALWAYS rendered - for both anonymous and
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
  //   - Anonymous → all three marketing pillars (/games, /journey, /mioshy-sex).
  //   - Authenticated → all three pillars ALWAYS visible (Itzik 2026-05-28).
  //     • Owned pillar  → /my/X  (private workspace).
  //     • Un-owned       → /X    (marketing page so the user can upgrade).
  //
  // This unifies the rule that originally only applied to Adults
  // (added 2026-05-24): hiding pillars from non-entitled signed-in
  // users felt inconsistent and hid the product surface from existing
  // customers who might want to add another pillar. The rule now
  // applies to all three pillars: post-login, header is a 3-pillar
  // shelf where each tile leads either into the workspace (if owned)
  // or into the upgrade path (if not).
  const visiblePillars = PILLARS.flatMap((p) => {
    if (!isAuthed) {
      return [
        {
          href: p.marketingHref,
          tKey: p.tKey,
          labelKey: p.labelKey,
          Icon: p.Icon,
          accent: p.accent,
        },
      ];
    }
    // Adults always lands on /my/adults so a logged-in user has
    // one tap into the adults gallery — owned thumbnails sit there
    // and unowned ones are merchandised inline.
    if (p.tKey === "adults") {
      return [
        {
          href: p.authedHref,
          tKey: p.tKey,
          labelKey: p.labelKey,
          Icon: p.Icon,
          accent: p.accent,
        },
      ];
    }
    // Couples-assessment + survey: marketing-only entries (no entitlement),
    // so they always point at the public page for authed users too.
    if (p.tKey === "couplesAssessment" || p.tKey === "survey") {
      return [
        {
          href: p.marketingHref,
          tKey: p.tKey,
          labelKey: p.labelKey,
          Icon: p.Icon,
          accent: p.accent,
        },
      ];
    }
    // Games + Journey: pillar always rendered. Route depends on
    // entitlement — owned → /my/X, otherwise → marketing /X.
    const owns = entitlements
      ? entitlements[p.tKey as "games" | "journey"]
      : false;
    return [
      {
        href: owns ? p.authedHref : p.marketingHref,
        tKey: p.tKey,
        labelKey: p.labelKey,
        Icon: p.Icon,
        accent: p.accent,
      },
    ];
  });
  const locale = useLocale();
  const pathname = usePathname();
  const isHe = locale === "he";
  const t = useTranslations("nav");
  // 2026-05-28 — Itzik: during the assessment funnel the header should
  // be reduced to a small Mioshy logo only (no pillar nav, no CTA, no
  // hamburger). The logo stays in its current start-aligned position
  // (right in RTL) per his "במיקום שלו כיום" note. usePathname() from
  // @/navigation already strips the locale prefix, so a literal
  // /journey/assessment match works for both he and en.
  const isAssessment = pathname.startsWith("/journey/assessment");
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  const [isPending, startTransition] = useTransition();
  // Mobile-only: auto-hide the header on scroll-down, restore on scroll-up.
  // Pairs with <MobileServicesBar/> at the bottom — together they read like
  // a native mobile-app chrome (top bar collapses while reading, bottom
  // pillars stay reachable). Desktop never hides.
  const [hiddenOnMobile, setHiddenOnMobile] = useState(false);
  const lastScrollY = useRef(0);

  // 2026-05-20 — [SiteHeader] BUILD marker console.log removed.
  // The Lighthouse mobile audit flagged console output as a
  // diagnostic-overhead source; this one fires on every page load
  // (SiteHeader is on every page) and serializes entitlements +
  // pillar arrays. To confirm a deploy shipped, check the Network
  // panel for the actual JS hash instead.

  // Track scroll + theme on mount and on scroll. We intentionally resample
  // the theme on every scroll tick - switching between dark hero and light
  // sections should flip the header tone live.
  //
  // Direction tracking (mobile-only auto-hide):
  //   - Past a small threshold, scrolling DOWN hides the header.
  //   - Scrolling UP — even one pixel — brings it back.
  //   - At/near the top of the page (<40px) we always force visible, so
  //     pulling all the way up never leaves a stranded "hidden" state.
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 40);
      setTheme(detectTheme());

      const prev = lastScrollY.current;
      const delta = y - prev;
      // Ignore micro-movements (rubber-banding, trackpad jitter).
      if (Math.abs(delta) < 4) return;
      if (y < 40) {
        setHiddenOnMobile(false);
      } else if (delta > 0) {
        // Scrolling down past the threshold → hide.
        setHiddenOnMobile(true);
      } else {
        // Scrolling up → show.
        setHiddenOnMobile(false);
      }
      lastScrollY.current = y;
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // If the user opens the mobile drawer mid-scroll, force the header to
  // stay visible — otherwise the drawer would seem to detach from the
  // top of the viewport.
  useEffect(() => {
    if (open) setHiddenOnMobile(false);
  }, [open]);

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

  // Logo swap: the project only ships mioshy-white.svg. On light-scrolled
  // state we darken it via a CSS filter (invert + slight hue correction).
  const logoFilter =
    scrolled && theme === "light"
      ? "invert(1) hue-rotate(180deg) saturate(1.2) brightness(0.85)"
      : "none";

  // Mobile auto-hide: only applies under lg (1024px). Desktop ignores.
  // We pair `transition-transform` with the existing `transition-all` so
  // both the slide and the bg flip animate smoothly together.
  const hideClass = hiddenOnMobile ? "max-lg:-translate-y-full" : "translate-y-0";

  return (
    /* Performance: backdrop-blur-xl on a sticky header forces Chrome to
       re-blur the whole viewport on every scroll tick — the #1 GPU
       offender flagged in the 2026-05-06 audit. We removed it; the
       header bgs in `barBg` now use opaque solids/strong-alpha
       gradients instead, which read identically without the blur. */
    <header
      // CLS 2026-05-21 — explicit min-height locks the header height
      // across all states (float ↔ scrolled ↔ themed). Without this,
      // micro-differences in border/shadow rendering between the
      // transparent and frosted variants could nudge `sticky` flow
      // by 1-2px, which on a long page accumulates into measurable
      // CLS. 64px mobile = py-3 (24) + max(h-10 logo, min-h-36 btn).
      // 72px sm+ = py-3 (24) + h-12 logo.
      className={`sticky top-0 z-50 min-h-[64px] sm:min-h-[72px] border-b transition-all duration-300 ${barBg} ${hideClass}`}
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
            // 2026-05-28 — smaller logo on assessment per Itzik
            // ("להשאיר רק את הלוגו בקטן"). Mobile-only change per
            // feedback_mioshy_mobile_only — desktop (sm:h-12) is
            // unchanged. Non-assessment pages keep the original
            // h-10/sm:h-12 sizing.
            className={
              isAssessment
                ? "h-7 w-auto sm:h-12"
                : "h-10 w-auto sm:h-12"
            }
            width={171}
            height={81}
            style={{ filter: logoFilter, transition: "filter 220ms ease" }}
          />
        </Link>

        {/* ─────── Pillar links (desktop) ─────── */}
        <nav aria-label={isHe ? "ניווט ראשי" : "Main navigation"} className="hidden items-center gap-1 lg:flex">
          {visiblePillars.map((p) => {
            const isActive = pathname.startsWith(p.href);
            const className = `group relative inline-flex items-center rounded-full px-4 py-2 text-base font-medium transition ${linkBase} ${
              isActive
                ? mode === "light"
                  ? "bg-slate-100"
                  : "bg-white/10"
                : ""
            }`;
            const inner = (
              <>
                {/* Desktop pillar links are text-only (Itzik 2026-07-14) — the
                    icon is kept in the mobile drawer below. */}
                <span>{t(p.labelKey ?? p.tKey)}</span>
                <span
                  aria-hidden
                  className={`pointer-events-none absolute inset-x-3 bottom-1 h-[2px] origin-center rounded-full bg-gradient-to-r ${p.accent} transition-transform duration-200 ${
                    isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
                  }`}
                />
              </>
            );
            // The survey pillar reports its click (Meta + PostHog); every other
            // pillar stays a plain Link. Markup is shared above so the two
            // branches can't drift visually.
            return p.tKey === "survey" ? (
              <SurveyNavLink key={p.href} href={p.href} className={className}>
                {inner}
              </SurveyNavLink>
            ) : (
              <Link key={p.href} href={p.href} className={className}>
                {inner}
              </Link>
            );
          })}
        </nav>

        {/* ─────── Auth area (desktop) ─────── */}
        <div className="hidden items-center gap-2 md:flex">
          {isAuthed ? (
            <>
              {/* A3/task 21 — trial status chip ("יום X מתוך 7"). Persistent
                  status (not closeable); click opens the billing/timeline. */}
              {trialDay != null ? (
                <Link
                  href="/account"
                  className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-fuchsia-300/40 bg-fuchsia-500/10 px-3 text-sm font-semibold text-fuchsia-100 transition hover:bg-fuchsia-500/20"
                  title={isHe ? "פרטי הניסיון והחיוב" : "Trial & billing details"}
                >
                  {isHe ? `יום ${trialDay} מתוך 7` : `Day ${trialDay} of 7`}
                </Link>
              ) : null}
              {/* Home link removed from the authed header per Itzik
                  2026-05-27 — signed-in users already have "מיאושי
                  שלי" as their primary destination, plus the pillar
                  links in the main nav. The Home link was creating
                  visual clutter and pulled focus away from the
                  primary CTA. For unauthed visitors the link is
                  still in the branch below (they may want to return
                  to the marketing homepage). */}
              {/* "מיאושי שלי" — primary CTA after login. Same gradient
                  treatment as the pre-login "Join now" button so the
                  user has one obvious next-action regardless of state.
                  Per Itzik 2026-05-07. */}
              <Link
                href="/my/lessons"
                className="group relative inline-flex min-h-[40px] items-center justify-center gap-1.5 overflow-hidden rounded-full px-5 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(110deg,#d946ef_0%,#a855f7_35%,#ec4899_70%,#f59e0b_100%)]"
                />
                <span className="relative z-10 inline-flex items-center gap-1.5">
                  <Library className="h-4 w-4" />
                  {t("library")}
                </span>
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
              {/* Home link — added 2026-05-19 per Itzik. Sits to the
                  right of the sign-in button in RTL (FIRST in JSX
                  order = rightmost when document is RTL). Desktop-
                  only; on mobile this goes inside the drawer menu.
                  Icon removed (text-only) per Itzik same-day. */}
              <Link
                href="/"
                className={`inline-flex min-h-[40px] items-center rounded-full px-3 py-2 text-base font-semibold transition ${linkBase}`}
                aria-label={t("home")}
              >
                <span>{t("home")}</span>
              </Link>
              {/* Sign-in (secondary) button. Per Itzik 2026-05-07 — same
                  size + padding as the primary "Join now" CTA but with a
                  dark header-matching background, so the two buttons read
                  as a clear primary/secondary pair instead of a button +
                  a text link. */}
              <Link
                href="/auth"
                className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-white/15 bg-[#170E14] px-5 text-base font-semibold text-white/90 transition hover:bg-[#231619] hover:border-white/25 hover:text-white"
              >
                {t("signIn")}
              </Link>
              {/* Primary header CTA. Was → /journey ("ליווי עם מיאושי")
                  per the previous "lead with the flagship" thinking. Per
                  Itzik 2026-05-06 → /auth/signup ("הצטרפות בחינם"). The
                  funnel is now: free signup → /my → choose pillar →
                  /pricing → Cardcom. Lower commitment for first click. */}
              {/* QA 2026-06-16 — funnel now leads with the assessment.
                  Desktop keeps the label; the navigation target matches mobile. */}
              <Link
                href="/journey/assessment"
                className="group relative inline-flex min-h-[40px] items-center justify-center overflow-hidden rounded-full px-5 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/25 transition hover:brightness-110"
              >
                <span
                  aria-hidden
                  className="absolute inset-0 bg-[linear-gradient(110deg,#d946ef_0%,#a855f7_35%,#ec4899_70%,#f59e0b_100%)]"
                />
                <CmsText cmsKey="header.joinCta" as="span" className="relative z-10" />
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
        {!isAssessment && <div className="flex items-center gap-2 lg:hidden">
          {isAuthed ? (
            // Mobile primary — matching the desktop My-Mioshy gradient
            // treatment. Compact size to fit beside the hamburger.
            <Link
              href="/my/lessons"
              className="group relative inline-flex min-h-[36px] items-center justify-center gap-1.5 overflow-hidden rounded-full px-4 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/25 transition hover:brightness-110 md:hidden"
              aria-label={t("library")}
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(110deg,#d946ef_0%,#a855f7_35%,#ec4899_70%,#f59e0b_100%)]"
              />
              <span className="relative z-10 inline-flex items-center gap-1.5">
                <Library className="h-4 w-4" />
                <span>{t("library")}</span>
              </span>
            </Link>
          ) : (
            // Mobile primary CTA — matches the desktop primary: free
            // signup. Slightly compact label so it fits next to the
            // hamburger on cramped mobile headers.
            <Link
              href="/journey/assessment"
              className="group relative inline-flex min-h-[36px] items-center justify-center overflow-hidden rounded-full px-4 text-sm font-semibold text-white shadow-md shadow-fuchsia-500/25 transition hover:brightness-110 md:hidden"
            >
              <span
                aria-hidden
                className="absolute inset-0 bg-[linear-gradient(110deg,#d946ef_0%,#a855f7_35%,#ec4899_70%,#f59e0b_100%)]"
              />
              <span className="relative z-10">
                {/* QA 2026-06-16 — mobile label leads with the assessment. */}
                {isHe ? "אבחון והצטרפות לליווי" : "Assessment & journey"}
              </span>
            </Link>
          )}

          <button
            className={`inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full border p-2 transition ${ghostBorder} ${textFg}`}
            onClick={() => setOpen((o) => !o)}
            aria-label={t("menu")}
            aria-expanded={open}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>}
      </div>

      {/* ─────── Mobile drawer ─────── */}
      {/* Performance: removed backdrop-blur-xl — the drawer is rendered
          on top of the page anyway, so a solid background reads better
          and is far cheaper than blurring everything beneath it. */}
      {open ? (
        <div
          className={`border-t lg:hidden ${
            theme === "light"
              ? "border-slate-200 bg-white text-slate-900"
              : "border-white/10 bg-[#0E0810] text-white"
          }`}
          dir={isHe ? "rtl" : "ltr"}
        >
          <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3">
            {/* Home link — mobile drawer entry point. Shown only to
                unauthenticated visitors (mirrors the desktop branch
                per Itzik 2026-05-27). Signed-in users have the pillar
                links below + "מיאושי שלי" in the footer area, so
                surfacing /home again would only add clutter and pull
                focus away from the primary in-app destinations. */}
            {!isAuthed ? (
              <Link
                href="/"
                onClick={() => setOpen(false)}
                className={`group flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium transition ${
                  pathname === "/" || pathname === ""
                    ? theme === "light"
                      ? "bg-slate-100 font-semibold"
                      : "bg-white/10 font-semibold"
                    : theme === "light"
                      ? "hover:bg-slate-100"
                      : "hover:bg-white/5"
                }`}
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-rose-500 via-fuchsia-500 to-violet-500 shadow-lg shadow-black/40`}
                >
                  <Home className="h-4 w-4 text-white" />
                </span>
                <span>{t("home")}</span>
              </Link>
            ) : null}
            {visiblePillars.map((p) => {
              const isActive = pathname.startsWith(p.href);
              const className = `group relative flex items-center gap-3 rounded-xl px-3 py-3 text-base font-medium transition ${
                isActive
                  ? theme === "light"
                    ? "bg-slate-100 font-semibold"
                    : "bg-white/10 font-semibold"
                  : theme === "light"
                    ? "hover:bg-slate-100"
                    : "hover:bg-white/5"
              }`;
              const inner = (
                <>
                  <span
                    className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${p.accent} shadow-lg shadow-black/40 ${isActive ? "ring-2 ring-white/30" : ""}`}
                  >
                    <p.Icon className="h-4 w-4 text-white" />
                  </span>
                  <span>{t(p.labelKey ?? p.tKey)}</span>
                  {isActive && (
                    <span
                      aria-hidden
                      className={`ms-auto h-2 w-2 rounded-full bg-gradient-to-br ${p.accent}`}
                    />
                  )}
                </>
              );
              // See the desktop nav above — same swap, same shared markup.
              return p.tKey === "survey" ? (
                <SurveyNavLink
                  key={p.href}
                  href={p.href}
                  onClick={() => setOpen(false)}
                  className={className}
                >
                  {inner}
                </SurveyNavLink>
              ) : (
                <Link
                  key={p.href}
                  href={p.href}
                  onClick={() => setOpen(false)}
                  className={className}
                >
                  {inner}
                </Link>
              );
            })}

            <div className={`my-2 h-px ${theme === "light" ? "bg-slate-200" : "bg-white/10"}`} />

            {isAuthed ? (
              <>
                <Link
                  href="/my/lessons"
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
                {/* Drawer primary CTA — free signup, matching the
                    desktop + mobile header buttons. */}
                <Link
                  href="/journey/assessment"
                  onClick={() => setOpen(false)}
                  className="mt-1 inline-flex min-h-[44px] items-center justify-center rounded-full bg-gradient-to-r from-fuchsia-500 via-purple-500 to-pink-500 px-5 text-base font-semibold text-white shadow-lg shadow-fuchsia-500/25"
                >
                  {isHe ? "אבחון והצטרפות לליווי" : "Assessment & journey"}
                </Link>
              </>
            )}
          </div>
        </div>
      ) : null}

      {/* Keyframes for the signup-CTA gradient drift. Defined once, global. */}
      {/* Header CTA gradient is now static (no animation) - keyframes
          intentionally removed 2026-05-06. */}
    </header>
  );
}
