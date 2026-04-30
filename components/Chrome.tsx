"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { HomeBackground } from "@/components/my/HomeBackground";

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
    /^\/auth(\/|$)/.test(pathname)
  );
}

export function Chrome({
  children,
  isAuthed = false,
}: {
  children: ReactNode;
  isAuthed?: boolean;
}) {
  const pathname = usePathname();
  const hide = shouldHideChrome(pathname);

  if (hide) {
    return <>{children}</>;
  }

  return (
    <div
      className={
        isAuthed
          ? // Authenticated layout — premium dark backdrop locked to the
            // viewport, only the content scrolls. Per the post-login spec
            // we want the homepage hero's purple↔rose blob language to
            // travel with the user across every page they land on.
            "relative flex min-h-[100dvh] flex-col text-white"
          : "flex min-h-[100dvh] flex-col bg-[var(--mio-bg)] text-white"
      }
    >
      {isAuthed ? <HomeBackground /> : null}
      <SiteHeader isAuthed={isAuthed} />
      <div className="flex-1">{children}</div>
      {/* Footer is marketing surface only — hide it for signed-in users
          so the post-login experience reads as "your space, not a brochure". */}
      {!isAuthed && <SiteFooter />}
    </div>
  );
}

