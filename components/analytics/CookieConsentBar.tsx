"use client";

/**
 * CookieConsentBar — the missing piece of Google Consent Mode v2.
 *
 * GoogleTagManager.tsx sets consent `default` = denied for ad/analytics
 * storage, so GA/Ads stay blocked until something grants consent. This
 * one-time, centred modal is that grantor.
 *
 * Behaviour:
 *  • No cookie yet            → show the modal (EVERY visitor, signed in or not).
 *  • "מאשרים"                 → gtag('consent','update', all 4 → granted) +
 *                               cookie = 'granted' (12 months) + hide.
 *  • "מסרבים"                 → cookie = 'dismissed' (30 days) + hide;
 *                               consent stays denied.
 *  • Cookie === 'granted'     → re-apply the consent update on every load (so a
 *                               returning consenter keeps full analytics) — the
 *                               modal stays hidden.
 *  • Any cookie present       → never show the modal again until it expires.
 *
 * ── Why two different lifetimes (Itzik 2026-08-12) ──────────────────────────
 * `granted` lasts a year: someone who said yes should not be asked again.
 * `dismissed` lasts 30 days: the choice is respected for a month and then the
 * question may be asked once more. Re-asking sooner than that reads as a dark
 * pattern under the GDPR guidance; 30 days is the accepted middle ground. No
 * extra bookkeeping is needed — the cookie simply expires and the modal returns.
 *
 * ── Blocking by design ──────────────────────────────────────────────────────
 * There is no ✕, Escape does nothing, and clicking the scrim does nothing. The
 * visitor must pick one of the two buttons. Both choices are presented
 * symmetrically in weight (Israeli Privacy Authority, Feb 2026: symmetry is what
 * makes the consent valid) — the accept button is the primary pill and the
 * decline is a plainly-legible underlined control, not a faded dismissal.
 *
 * gtag/dataLayer come from GoogleTagManager.tsx. GTM may not have loaded at
 * click time, so we fall back to pushing the consent command onto
 * window.dataLayer, which GTM drains on load. In dev (no GTM) these calls are
 * harmless no-ops on a local dataLayer.
 */

import { useCallback, useEffect, useRef, useState } from "react";

const COOKIE = "mioshy_cookie_consent";
/** "Yes" is remembered for a year; "no" is revisited after a month. */
const MAX_AGE_SECONDS: Record<ConsentValue, number> = {
  granted: 60 * 60 * 24 * 365,
  dismissed: 60 * 60 * 24 * 30,
};

/** Fired on the window the moment a decision is stored, so surfaces that must
 *  wait for the modal to close (e.g. AssessmentBar) can appear without a
 *  reload. Nothing else depends on it. */
export const CONSENT_DECIDED_EVENT = "mioshy:consent-decided";

type ConsentValue = "granted" | "dismissed";

function readConsentCookie(): ConsentValue | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(/(?:^|; )mioshy_cookie_consent=([^;]*)/);
  const v = m ? decodeURIComponent(m[1]) : null;
  return v === "granted" || v === "dismissed" ? v : null;
}

function writeConsentCookie(value: ConsentValue): void {
  document.cookie = `${COOKIE}=${value}; path=/; max-age=${MAX_AGE_SECONDS[value]}; SameSite=Lax; Secure`;
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
  // Drives the enter transition: the card mounts at scale(.96)/opacity 0 and is
  // flipped on the next frame, so the browser has a "from" state to animate.
  const [entered, setEntered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const acceptRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const existing = readConsentCookie();
    if (existing === "granted") {
      // Returning consenter — re-apply so analytics works this session too.
      applyGrantedConsent();
      return;
    }
    if (existing === "dismissed") return; // chose not to consent — respect it
    setVisible(true); // no decision on record yet
  }, []);

  // Lock background scrolling while the modal is up, and restore exactly what
  // was there before (not a hardcoded "" ) when it closes.
  useEffect(() => {
    if (!visible) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [visible]);

  // Start the enter transition on the frame after mount, and put the initial
  // focus on "accept".
  useEffect(() => {
    if (!visible) return;
    const raf = requestAnimationFrame(() => setEntered(true));
    acceptRef.current?.focus();
    return () => cancelAnimationFrame(raf);
  }, [visible]);

  // Focus trap. Tab cycles inside the card and Escape is swallowed — the modal
  // is not dismissible, so letting either escape it would be a lie.
  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if (e.key !== "Tab") return;
    const focusable = cardRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled])',
    );
    if (!focusable || focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && active === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }, []);

  if (!visible) return null;

  const t = {
    title: isHe ? "אנחנו משתמשים בעוגיות" : "We use cookies",
    body: isHe
      ? "כדי לזכור איפה עצרתם, ולהבין איך לשפר את האתר. אין כאן שום דבר שמזהה אתכם אישית."
      : "To remember where you left off and understand how to improve the site. Nothing here identifies you personally.",
    privacy: isHe ? "מדיניות הפרטיות" : "Privacy Policy",
    accept: isHe ? "מאשרים" : "Accept",
    refuse: isHe ? "מסרבים" : "Decline",
  };

  const decide = (value: ConsentValue) => {
    if (value === "granted") applyGrantedConsent();
    writeConsentCookie(value);
    setVisible(false);
    window.dispatchEvent(new Event(CONSENT_DECIDED_EVENT));
  };

  return (
    <div
      // The scrim. No onClick — the modal is blocking, so clicking through or
      // clicking to dismiss are both deliberately absent.
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 90,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 18,
        background: "rgba(10,4,18,.72)",
        backdropFilter: "blur(3px)",
        WebkitBackdropFilter: "blur(3px)",
        opacity: entered ? 1 : 0,
        transition: "opacity 180ms ease-out",
      }}
    >
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cookie-consent-title"
        dir={isHe ? "rtl" : "ltr"}
        onKeyDown={onKeyDown}
        style={{
          position: "relative",
          zIndex: 91,
          width: "100%",
          maxWidth: 390,
          padding: "26px 26px 24px",
          textAlign: "center",
          background: "#1B0F2B",
          border: "1px solid rgba(255,255,255,.13)",
          borderRadius: 20,
          boxShadow: "0 30px 80px rgba(0,0,0,.65)",
          opacity: entered ? 1 : 0,
          transform: entered ? "scale(1)" : "scale(.96)",
          transition: "opacity 220ms ease-out, transform 220ms ease-out",
        }}
      >
        <div aria-hidden style={{ fontSize: 30, marginBottom: 10, lineHeight: 1 }}>
          🍪
        </div>

        <h2
          id="cookie-consent-title"
          style={{ fontSize: 18, fontWeight: 800, color: "#FFFFFF", marginBottom: 9 }}
        >
          {t.title}
        </h2>

        <p
          style={{
            fontSize: 13.2,
            fontWeight: 400,
            lineHeight: 1.65,
            color: "#B7A3CD",
            marginBottom: 20,
          }}
        >
          {t.body}{" "}
          <a
            href={`/${isHe ? "he" : "en"}/privacy`}
            style={{ color: "#DCCBEF", textDecoration: "underline" }}
          >
            {t.privacy}
          </a>
        </p>

        <button
          ref={acceptRef}
          type="button"
          onClick={() => decide("granted")}
          style={{
            display: "block",
            width: "100%",
            padding: 14,
            fontSize: 15.5,
            fontWeight: 800,
            color: "#2B1A06",
            background: "linear-gradient(180deg,#F0B840,#E0A32B)",
            borderRadius: 12,
            boxShadow: "0 8px 26px rgba(240,184,64,.30)",
          }}
        >
          {t.accept}
        </button>

        <button
          type="button"
          onClick={() => decide("dismissed")}
          style={{
            display: "inline-block",
            marginTop: 16,
            // 8px/4px padding lifts the hit area to the 44px minimum.
            padding: "8px 4px",
            fontSize: 13.5,
            color: "#A08FB8",
            textDecoration: "underline",
            textUnderlineOffset: 4,
            textDecorationThickness: 1,
          }}
        >
          {t.refuse}
        </button>
      </div>
    </div>
  );
}
