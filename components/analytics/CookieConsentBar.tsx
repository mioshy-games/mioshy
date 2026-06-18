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
 * Global overlay: fixed, does not change layout. z-50 keeps it above the mobile
 * MobileServicesBar (z-40); on mobile it is lifted above that bar so neither
 * covers the other; honours safe-area-inset-bottom.
 */

import { useEffect, useState } from "react";

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

export function CookieConsentBar({ locale = "he" }: { locale?: "he" | "en" }) {
  const isHe = locale !== "en";
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const existing = readConsentCookie();
    if (existing === "granted") {
      // Returning consenter — re-apply so analytics works this session too.
      applyGrantedConsent();
      return;
    }
    if (existing === "dismissed") return; // chose not to consent — respect it
    setVisible(true); // first visit, no decision yet
  }, []);

  if (!visible) return null;

  const t = {
    msg: isHe
      ? "אנחנו משתמשים בעוגיות כדי לשפר את החוויה שלכם ולמדוד שימוש."
      : "We use cookies to improve your experience and measure usage.",
    privacy: isHe ? "מדיניות הפרטיות" : "Privacy Policy",
    accept: isHe ? "מסכים/ה" : "Accept",
    close: isHe ? "סגירה" : "Close",
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
    <div
      role="region"
      aria-label={isHe ? "הודעת עוגיות" : "Cookie notice"}
      dir={isHe ? "rtl" : "ltr"}
      // Fixed thin bar. z-50 sits above MobileServicesBar (z-40); on mobile we
      // lift it above that bar so they never cover each other. Safe-area aware.
      className="fixed inset-x-0 z-50 bottom-[calc(env(safe-area-inset-bottom,0px)+78px)] lg:bottom-[env(safe-area-inset-bottom,0px)]"
    >
      <div className="mx-auto flex max-w-5xl items-center gap-3 border-t border-white/10 bg-[#1a0a2e]/95 px-4 py-2.5 text-white shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.6)] backdrop-blur-md sm:gap-4">
        <p className="min-w-0 flex-1 text-[13px] leading-snug text-white/85">
          {t.msg}{" "}
          <a
            href={`/${isHe ? "he" : "en"}/privacy`}
            className="whitespace-nowrap font-semibold text-white underline underline-offset-2 hover:text-white"
          >
            {t.privacy}
          </a>
        </p>
        <button
          type="button"
          onClick={onAccept}
          className="shrink-0 rounded-full bg-amber-400 px-4 py-1.5 text-[13px] font-bold text-stone-900 transition hover:brightness-105"
        >
          {t.accept}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t.close}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
            <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    </div>
  );
}
