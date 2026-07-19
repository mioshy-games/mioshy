import Script from "next/script";

/**
 * Google Tag Manager wiring.
 *
 * GA4 (G-E7LRXB8XN0) and Google Ads (AW-457802965) are configured INSIDE the
 * GTM container (GTM-5WQQB3R) — we ship one loader, not three.
 *
 * ── History / why this file changed (2026-07-19) ──────────────────────────
 * The previous loader was a CLIENT component that (a) waited for the first
 * user interaction and (b) was rendered inside <head>. React does not hydrate
 * interactive components placed in <head>, so its useEffect never ran, the
 * interaction listeners never attached, and gtm.js was NEVER injected on any
 * page — verified live: window.dataLayer / window.google_tag_manager absent
 * even after scrolling/clicking. The interaction gate is removed entirely; GTM
 * now loads immediately on every page via <GoogleTagManager> from
 * @next/third-parties/google (mounted in app/layout.tsx).
 *
 * This module now owns only the Consent Mode v2 DEFAULT, which must be set
 * BEFORE gtm.js runs so ad/analytics storage start denied until CookieConsentBar
 * grants them. It is a `beforeInteractive` inline script (raw <script> in the
 * document head — no hydration required, runs before the GTM loader).
 */

export const GTM_ID = "GTM-5WQQB3R";

/**
 * Consent Mode v2 default = denied for ad/analytics storage. Emitted before the
 * GTM loader so the container starts in the safe state; CookieConsentBar flips
 * it to granted via gtag('consent','update',…). Prod-only — keeps the dev
 * console free of GTM/CSP noise (GA/Ads only matter on the live site).
 *
 * `function gtag(){…}` runs in global scope here, so window.gtag exists for
 * CookieConsentBar's grant call.
 */
export function GtmConsentDefault() {
  if (process.env.NODE_ENV !== "production") return null;
  // App Router root layout IS the supported place for beforeInteractive; the
  // lint rule is a legacy pages-router false positive. Verified live: this runs
  // at dataLayer[0] (consent default) before gtm.js at [1].
  return (
    // eslint-disable-next-line @next/next/no-before-interactive-script-outside-document
    <Script
      id="gtm-consent-default"
      strategy="beforeInteractive"
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
        `,
      }}
    />
  );
}
