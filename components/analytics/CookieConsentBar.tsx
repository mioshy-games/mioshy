"use client";

/**
 * CookieConsentBar — the missing piece of Google Consent Mode v2.
 *
 * GoogleTagManager.tsx sets consent `default` = denied for ad/analytics
 * storage, so GA/Ads stay blocked until something grants consent. This thin,
 * one-time bottom bar is that grantor.
 *
 * Behaviour (per Itzik):
 *  • No cookie yet            → show the bar.
 *  • "Accept"                 → gtag('consent','update', all 4 → granted) +
 *                               cookie = 'granted' (~12 months) + hide.
 *  • Close (X)                → cookie = 'dismissed' + hide; consent stays denied.
 *  • Cookie === 'granted'     → re-apply the consent update on every load (so a
 *                               returning consenter keeps full analytics) — bar
 *                               stays hidden.
 *  • Any cookie present       → never show the bar again (appears once).
 *
 * gtag/dataLayer come from GoogleTagManager.tsx. GTM loads on first interaction
 * (prod only), so window.gtag may not exist yet at click time — we fall back to
 * pushing the consent command onto window.dataLayer, which GTM drains on load.
 * In dev (no GTM) these calls are harmless no-ops on a local dataLayer.
 *
 * Global overlay: a fixed full-width strip pinned to the bottom of the screen
 * (sticky through scroll until the visitor decides). z-50 keeps it above the
 * mobile MobileServicesBar (z-40); honours safe-area-inset-bottom.
 *
 * Mobile coordination while the strip is shown (all reverted on dismiss):
 *  • lift the floating WhatsApp button above the strip — globals.css reads
 *    `--cookie-bar-h` under the `html.cookie-bar-open` class (mobile media
 *    query only), so desktop is untouched.
 *  • render a same-height spacer so the fixed strip never covers page content.
 */

import { useEffect, useRef, useState } from "react";

const COOKIE = "mioshy_cookie_consent";
const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365; // ~12 months

type ConsentValue = "granted" | "dismissed";

function readConsentCookie(): ConsentValue | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )mioshy_cookie_consent=([^;]*)/);
  const v = m ? decodeURIComponent(m[1]) : null;
  return v === "granted" || v === "dismissed" ? v : null;
}

function writeConsentCookie(value: ConsentValue): void {
  document.cookie = `${COOKIE}=${value}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax; Secure`;
}

/** Push a Consent Mode v2 "granted" update via gtag (or queue on dataLayer). */
function applyGrantedConsent(): void {
  if (typeof window === "undefined") return;
  const consent = {
    analytics_storage: "granted",
    ad_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  };
  const w = window as typeof window & {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  };
  if (typeof w.gtag === "function") {
    w.gtag("consent", "update", consent);
  } else {
    // GTM not loaded yet — queue it; GTM processes the dataLayer on load.
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push(["consent", "update", consent]);
  }
}

export function CookieConsentBar({
  locale = "he",
  isAuthed = false,
}: {
  locale?: "he" | "en";
  isAuthed?: boolean;
}) {
  const isHe = locale !== "en";
  const [visible, setVisible] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const [barHeight, setBarHeight] = useState(0);

  useEffect(() => {
    const existing = readConsentCookie();
    if (existing === "granted") {
      // Returning consenter — re-apply so analytics works this session too.
      // (Still runs for authed users: it's invisible consent plumbing, not the
      // banner.)
      applyGrantedConsent();
      return;
    }
    if (existing === "dismissed") return; // chose not to consent — respect it
    // Signed-in users never see the banner — they've already onboarded, so we
    // don't interrupt them with the consent prompt.
    if (isAuthed) return;
    setVisible(true); // anonymous first visit, no decision yet
  }, [isAuthed]);

  // While the strip is shown, publish its measured height (so the spacer and
  // the mobile WhatsApp lift match it exactly) and flag the document. The
  // consuming CSS lives in a mobile-only media query, so this is a no-op on
  // desktop. Everything is reverted the moment the strip is dismissed.
  useEffect(() => {
    if (!visible) return;
    const measure = () => {
      const h = barRef.current?.offsetHeight ?? 0;
      setBarHeight(h);
      document.documentElement.style.setProperty("--cookie-bar-h", `${h}px`);
    };
    measure();
    document.documentElement.classList.add("cookie-bar-open");
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      document.documentElement.classList.remove("cookie-bar-open");
      document.documentElement.style.removeProperty("--cookie-bar-h");
    };
  }, [visible]);

  if (!visible) return null;

  const t = {
    msg: isHe
      ? "אנחנו משתמשים בעוגיות כדי לשפר את החוויה שלכם ולמדוד שימוש."
      : "We use cookies to improve your experience and measure usage.",
    privacy: isHe ? "מדיניות הפרטיות" : "Privacy Policy",
    accept: isHe ? "מאשרים" : "Accept",
    refuse: isHe ? "מסרבים" : "Decline",
  };

  const onAccept = () => {
    applyGrantedConsent();
    writeConsentCookie("granted");
    setVisible(false);
  };
  const onDismiss = () => {
    writeConsentCookie("dismissed");
    setVisible(false);
  };

  return (
    <>
    <div
      role="region"
      aria-label={isHe ? "הודעת עוגיות" : "Cookie notice"}
      dir={isHe ? "rtl" : "ltr"}
      // Full-width strip flush to the very bottom edge (bottom:0) so its
      // background fills under the iPhone home-indicator — no transparent gap.
      // The safe-area inset is applied as inner padding-bottom below instead, so
      // the buttons stay above the indicator while the background reaches the
      // edge. Sticky through scroll. z-50 sits above MobileServicesBar (z-40).
      className="fixed inset-x-0 bottom-0 z-50"
    >
      <div ref={barRef} className="mx-auto flex max-w-5xl items-center gap-3 border-t border-white/10 bg-[#1a0a2e]/95 px-4 pt-2.5 pb-[calc(0.625rem+env(safe-area-inset-bottom,0px))] text-white shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md sm:gap-4">
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-white/85">
          {t.msg}{" "}
          <a
            href={`/${isHe ? "he" : "en"}/privacy`}
            className="whitespace-nowrap font-semibold text-white underline underline-offset-2 hover:text-white"
          >
            {t.privacy}
          </a>
        </p>
        {/* Task 22 — SYMMETRIC choices (Israeli Privacy Authority, Feb 2026:
            symmetry = valid consent). Accept + Decline are the same size + the
            same color weight (two solid pills), no faded "X". Both remember the
            choice for ~12 months (accept→granted, decline→dismissed). */}
        <button
          type="button"
          onClick={onAccept}
          className="min-h-[40px] shrink-0 rounded-full bg-amber-400 px-5 text-[13px] font-bold text-stone-900 transition hover:brightness-105"
        >
          {t.accept}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="min-h-[40px] shrink-0 rounded-full bg-white px-5 text-[13px] font-bold text-stone-900 transition hover:brightness-105"
        >
          {t.refuse}
        </button>
      </div>
    </div>
    {/* Mobile-only spacer the same height as the strip, so the fixed strip
        never covers the bottom of the page content. Hidden on desktop (lg+),
        where the layout already accounts for the bottom strip. */}
    <div aria-hidden className="lg:hidden" style={{ height: barHeight }} />
    </>
  );
}
