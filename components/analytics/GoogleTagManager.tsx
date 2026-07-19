"use client";

import { useEffect, useState } from "react";
import Script from "next/script";

/**
 * Google Tag Manager loader.
 *
 * GA4 (G-E7LRXB8XN0) and Google Ads (AW-457802965) are both configured
 * inside the GTM container — we ship one script tag, not three.
 *
 * Consent Mode v2 defaults are set to `denied` for ad/analytics storage
 * so that when a consent banner is added later the existing wiring
 * starts in the safe state. Until the banner exists, calling
 * `gtag('consent', 'update', {...})` from a future component is the
 * only thing needed to enable tracking — no GTM container changes
 * required.
 *
 * NOTE: the noscript iframe sibling lives in `GoogleTagManagerNoscript`
 * because Next.js doesn't allow `<noscript>` inside <head>.
 *
 * Load strategy — 2026-05-20:
 *   GTM no longer loads on page load. It waits for the FIRST user
 *   interaction (scroll / click / keydown / touch / pointermove) or
 *   a 10-second idle timeout as a fallback. Lighthouse measured
 *   GTM-related work at 1,096ms of CPU on /mioshy-sex in production
 *   — pushing that out of the initial-load TBT window jumps the
 *   Performance score from ~64 to a projected 80-90.
 *
 *   Implications:
 *     • All page_view events still fire (just slightly later — after
 *       first interaction or 10s, whichever first).
 *     • Engaged readers still get tracked — scroll is one of the
 *       triggers, so any meaningful read of the page fires GTM.
 *     • The ~5% of bouncers who hit the URL and immediately leave
 *       without ANY interaction won't be counted — acceptable
 *       trade-off (they wouldn't have read the content anyway and
 *       most analytics tools dedupe bounce-only views).
 *
 *   Dev mode: GTM is gated to NODE_ENV === 'production'. In dev
 *   nothing loads regardless of interaction (kept noise out of the
 *   developer console; the CSP errors GTM triggers were a constant
 *   distraction).
 */

export const GTM_ID = "GTM-5WQQB3R";

// Interaction events that count as "engaged" — any one fires GTM load.
// `pointermove` is intentionally NOT included to keep accidental
// hovers from triggering — but `pointerdown` is (deliberate touch).
const INTERACTION_EVENTS = [
  "scroll",
  "click",
  "keydown",
  "touchstart",
  "pointerdown",
] as const;

// 2026-05-20 — fallback timer REMOVED. Itzik reports "page gets
// stuck after a few seconds" on /mioshy-sex. The 10s idle fallback
// was firing GTM (300KB parse + multiple pixel requests) right
// around that mark. Now GTM ONLY loads on actual user interaction
// (scroll/click/keydown/touch/pointerdown). True bouncers won't be
// counted — acceptable trade-off for guaranteed-stable initial UX.
// If you want to bring back a fallback, set this >30s to avoid the
// "feels frozen" window.
// const GTM_IDLE_FALLBACK_MS = 10_000;

export function GoogleTagManager() {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    // Dev gate — never load in development. Saves the CSP-violation
    // console noise and faster Fast Refresh in dev.
    if (process.env.NODE_ENV !== "production") return;

    // Conversion landing pages have NO guaranteed user interaction before the
    // conversion fires — /billing/success auto-polls Cardcom and pushes the
    // `purchase` dataLayer event with no scroll/click. Load GTM immediately
    // there so the event is never dropped. The interaction-gate below still
    // applies to every other (content/marketing) page, preserving the perf win.
    if (window.location.pathname.includes("/billing/success")) {
      setShouldLoad(true);
      return;
    }

    let loaded = false;
    const triggerLoad = () => {
      if (loaded) return;
      loaded = true;
      setShouldLoad(true);
      // Clean up all listeners once we've decided to load.
      for (const evt of INTERACTION_EVENTS) {
        window.removeEventListener(evt, triggerLoad);
      }
    };

    // Set up interaction listeners (passive so they don't block scroll).
    for (const evt of INTERACTION_EVENTS) {
      window.addEventListener(evt, triggerLoad, { passive: true, once: true });
    }

    // 2026-05-20 — no fallback timer. GTM only loads on actual
    // user interaction. See top-of-file comment for rationale.

    return () => {
      for (const evt of INTERACTION_EVENTS) {
        window.removeEventListener(evt, triggerLoad);
      }
    };
  }, []);

  if (!shouldLoad) return null;

  return (
    <Script
      id="gtm-init"
      // `lazyOnload` once the gate is open — defers further to the
      // browser's idle window. Combined with the interaction gate
      // above, GTM finally runs at the most opportune moment.
      strategy="lazyOnload"
      dangerouslySetInnerHTML={{
        __html: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('consent', 'default', {
            'ad_storage': 'denied',
            'ad_user_data': 'denied',
            'ad_personalization': 'denied',
            'analytics_storage': 'denied',
            'functionality_storage': 'granted',
            'security_storage': 'granted',
            'wait_for_update': 500
          });
          (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
          new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
          j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
          'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
          })(window,document,'script','dataLayer','${GTM_ID}');
        `,
      }}
    />
  );
}

export function GoogleTagManagerNoscript() {
  // Also gated to production. The noscript iframe is harmless but
  // unnecessary in dev (most devs have JS enabled).
  if (process.env.NODE_ENV !== "production") {
    return null;
  }
  return (
    <noscript>
      <iframe
        src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
        height={0}
        width={0}
        style={{ display: "none", visibility: "hidden" }}
      />
    </noscript>
  );
}
