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
 */

export const GTM_ID = "GTM-5WQQB3R";

export function GoogleTagManager() {
  return (
    <Script
      id="gtm-init"
      strategy="afterInteractive"
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
