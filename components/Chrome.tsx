"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

function shouldHideChrome(pathname: string) {
  // Hide chrome on gameplay pages (full-screen), including after login.
  // Examples:
  // - /en/game
  // - /en/game/ABCD
  // - /en/game/ABCD/snakes
  // - /en/games/truth-or-dare
  // - /en/games/some-slug
  // Support any locale prefix (/[locale]/...) and also non-localized routes.
  return (
    /^\/[^/]+\/(game|games)(\/|$)/.test(pathname) ||
    /^\/(game|games)(\/|$)/.test(pathname) ||
    /^\/[^/]+\/auth(\/|$)/.test(pathname) ||
    /^\/auth(\/|$)/.test(pathname)
  );
}

export function Chrome({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hide = shouldHideChrome(pathname);

  if (hide) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[var(--mio-bg)] text-white">
      <SiteHeader />
      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  );
}

