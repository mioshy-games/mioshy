"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
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
  // /my/notifications, /my/more. The shell ships its own PageHeader,
  // so the marketing SiteHeader stacks awkwardly above it. Existing
  // /my and /my/games and /my/adults and /my/journey are NOT in the
  // shell yet → they still get the marketing chrome until migrated.
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
    /^\/(en|he)\/my\/(today|lessons|expert|share|settings|notifications|more)(\/|$)/.test(pathname)
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
      {isAuthed ? <HomeBackground /> : null}
      <SiteHeader
        isAuthed={isAuthed}
        entitlements={entitlements}
        unreadNotifications={unreadNotifications}
      />
      {/* Reserve space at the bottom on mobile (when the bar is shown)
          so the last section of every page isn't permanently hidden
          under the fixed <MobileServicesBar/>. The bar is ~76px tall
          including safe-area; we round up to 80px. lg+ has no bar so
          no padding. */}
      <div className={`flex-1 ${!isAuthed ? "pb-[80px] lg:pb-0" : ""}`}>
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

