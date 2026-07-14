"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { CampaignPromoBar } from "@/components/promo/CampaignPromoBar";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileServicesBar } from "@/components/MobileServicesBar";
import { HomeBackground } from "@/components/my/HomeBackground";
import { PerfDebugHud } from "@/components/dev/PerfDebugHud";
import { WhatsAppFloatingCta } from "@/components/marketing/WhatsAppFloatingCta";

function shouldHideChrome(pathname: string) {
  // Hide chrome on gameplay pages (full-screen), including after login.
  //
  // The /games catalogue index keeps chrome (header + footer) - only the
  // actual gameplay inside a specific game hides it.
  //
  // Hidden (gameplay):
  // - /en/game                    (cross-device gameplay hub)
  // - /en/game/ABCD               (room code)
  // - /en/game/ABCD/snakes        (snakes & ladders)
  // - /en/game/local              (local two-device play)
  // - /en/games/truth-or-dare     (redirects, but fine to hide)
  // - /en/games/some-slug         (TruthOrDareClient gameplay)
  // Shown (catalogue / marketing):
  // - /en/games                   (catalogue index - needs chrome)
  //
  // Also hide on post-login AppShell routes (Studio v12, 2026-05-29) —
  // /my/today, /my/lessons, /my/expert, /my/share, /my/settings,
  // /my/notifications, /my/more, /my/games, /my/adults. The shell ships
  // its own PageHeader, so the marketing SiteHeader stacks awkwardly
  // above it. /my (index) and /my/journey are NOT in the shell yet →
  // they still get the marketing chrome until migrated.
  //
  // 2026-05-30 — /my/games and /my/adults moved INTO the shell layout
  // group; appended here so the legacy SiteHeader stops painting above
  // their PageHeader.
  //
  // Support any locale prefix (/[locale]/...) and also non-localized routes.
  return (
    // /game/<roomCode> and deeper - always gameplay; but /game (lobby) keeps chrome
    /^\/[^/]+\/game\/.+/.test(pathname) ||
    /^\/game\/.+/.test(pathname) ||
    // /games/<slug> - a segment AFTER /games means we're inside a game
    /^\/[^/]+\/games\/.+/.test(pathname) ||
    /^\/games\/.+/.test(pathname) ||
    // Auth flows
    /^\/[^/]+\/auth(\/|$)/.test(pathname) ||
    /^\/auth(\/|$)/.test(pathname) ||
    // AppShell routes — post-login surface ships its own header
    /^\/(en|he)\/my\/(today|lessons|expert|share|settings|notifications|more|games|adults)(\/|$)/.test(pathname) ||
    // 2026-05-31 — /journey/timeline/[scheduledId] (single-lesson view)
    // now lives INSIDE the shell layout group too, so the marketing
    // SiteHeader stops painting above its PageHeader.
    /^\/(en|he)\/journey\/timeline\/[^/]+/.test(pathname) ||
    // 2026-06-01 — assessment + its /intro redirect are a focused
    // questionnaire flow. The marketing site header above the
    // multi-step UI was visually crowding the page; hide it here so
    // the assessment owns the viewport.
    /^\/(en|he)\/journey\/assessment(\/|$)/.test(pathname) ||
    // 2026-06-07 — standalone assessments runner (/assessments/<id>) is a
    // focused funnel just like the journey assessment: hide the marketing
    // header so only the Mioshy logo (rendered by the page) shows. The hub
    // index (/assessments) keeps chrome — it's a catalogue.
    /^\/(en|he)\/assessments\/[^/]+/.test(pathname)
  );
}

interface Entitlements {
  games: boolean;
  journey: boolean;
  adults: boolean;
}

export function Chrome({
  children,
  isAuthed = false,
  entitlements = null,
  unreadNotifications = 0,
  trialEndsAt = null,
  locale,
}: {
  children: ReactNode;
  isAuthed?: boolean;
  /** When the user is signed in, the layout passes their entitlement
   *  flags so the header can surface ONLY the products they own (per
   *  spec §11). null = anonymous OR auth fetch failed. */
  entitlements?: Entitlements | null;
  /** v3 slice 10 - unread journey_notifications count for the bell. */
  unreadNotifications?: number;
  /** A3/task 21 — trial deadline for the persistent header chip. */
  trialEndsAt?: string | null;
  /** Required when isAuthed; drives RTL/LTR rendering of the bell
   *  dropdown. Anonymous visitors don't see the bell. */
  locale?: string;
}) {
  const pathname = usePathname();
  const hide = shouldHideChrome(pathname);

  if (hide) {
    return (
      <>
        {children}
        <PerfDebugHud />
      </>
    );
  }

  return (
    <div
      className={
        isAuthed
          ? // Authenticated layout - premium dark backdrop locked to the
            // viewport, only the content scrolls. Per the post-login spec
            // we want the homepage hero's purple↔rose blob language to
            // travel with the user across every page they land on.
            "relative flex min-h-[100dvh] flex-col text-white"
          : "flex min-h-[100dvh] flex-col bg-[var(--mio-bg)] text-white"
      }
    >
      {/* a11y (M1): skip-to-content — first focusable element, revealed on
          focus. Targets the content wrapper below. */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:font-semibold focus:text-[#0E0810] focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-fuchsia-500"
      >
        {locale === "en" ? "Skip to content" : "דלג לתוכן"}
      </a>
      {isAuthed ? <HomeBackground /> : null}
      {/* Task 21 — holiday-campaign sticky bar (self-gates: only campaign_timer). */}
      <CampaignPromoBar isHe={locale === "he"} />
      <SiteHeader
        isAuthed={isAuthed}
        entitlements={entitlements}
        unreadNotifications={unreadNotifications}
        trialEndsAt={trialEndsAt}
      />
      {/* Reserve space at the bottom on mobile (when the bar is shown)
          so the last section of every page isn't permanently hidden
          under the fixed <MobileServicesBar/>. The bar is ~76px tall
          including safe-area; we round up to 80px. lg+ has no bar so
          no padding. */}
      <div id="main-content" tabIndex={-1} className={`flex-1 outline-none ${!isAuthed ? "pb-[80px] lg:pb-0" : ""}`}>
        {children}
      </div>
      {/* Footer is marketing surface only - hide it for signed-in users
          so the post-login experience reads as "your space, not a brochure". */}
      {!isAuthed && <SiteFooter />}
      {/* Persistent bottom tab-bar — mobile only, anonymous only. Same
          gate as the footer: when the user is signed in, the dashboard
          chrome takes over and this surface gets out of the way. */}
      {!isAuthed && <MobileServicesBar />}
      {/* Floating WhatsApp CTA — Hebrew-only, hides itself on
          /journey/assessment + /my + /dashboard. Component decides
          visibility internally; we always mount it on the chrome
          surfaces. Added 2026-05-19 per Itzik. */}
      <WhatsAppFloatingCta locale={locale ?? "he"} />
      <PerfDebugHud />
    </div>
  );
}

