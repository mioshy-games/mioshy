import createNextIntlPlugin from "next-intl/plugin";
import bundleAnalyzer from "@next/bundle-analyzer";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

// Bundle analyzer (opt-in, 2026-05-21). Only activates when ANALYZE=true is
// in the environment — so a normal `pnpm build` / Vercel deploy is unaffected.
// Run `pnpm analyze` (which sets ANALYZE=true) to open the visualizer in the
// browser. Use it to find oversized chunks, framer-motion duplication across
// routes, accidental client-bundle imports (e.g. @uiw/react-md-editor leaking
// into a marketing page), etc.
const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

function supabaseHost() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return null;
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

// PostHog region (QA 2026-06-16). Events are reverse-proxied through /ingest;
// the proxy destinations AND the CSP MUST target the cloud where the project's
// API key actually lives. A US key proxied to the EU host (or vice-versa) means
// every event is silently dropped — the #1 cause of a stuck "waiting for
// events". Itzik's project is on the US cloud, so US is the default; set
// NEXT_PUBLIC_POSTHOG_REGION=eu to flip the whole proxy + CSP back to EU with no
// code change (then redeploy).
const PH_REGION =
  (process.env.NEXT_PUBLIC_POSTHOG_REGION || "us").toLowerCase() === "eu"
    ? "eu"
    : "us";
const PH_INGEST_HOST = `https://${PH_REGION}.i.posthog.com`;
const PH_ASSETS_HOST = `https://${PH_REGION}-assets.i.posthog.com`;

/** @type {import('next').NextConfig} */
const nextConfig = {
  // PostHog (EU) is reverse-proxied through /ingest (see rewrites below).
  // PostHog's API is sensitive to a trailing-slash redirect on those paths,
  // so opt out of Next's automatic trailing-slash handling for them.
  skipTrailingSlashRedirect: true,
  images: {
    // AVIF first so the optimizer prefers it when the browser advertises
    // support — typically 25-35% smaller than the same WebP at the same
    // visual quality, which directly cuts hero LCP bytes on mobile.
    // WebP stays as the fallback for older browsers.
    formats: ["image/avif", "image/webp"],
    // ─── deviceSizes (PSI fix, 2026-05-21) ──────────────────────────────
    // Next 14 default: [640, 750, 828, 1080, 1200, 1920, 2048, 3840].
    // That's 8 buckets per image — every uploaded image gets re-encoded
    // 8 times AVIF + 8 times WebP = 16 derived assets in Vercel cache.
    // Mioshy's real viewport distribution (Vercel Analytics 2026-05):
    //   • 67% mobile  ≤ 480px
    //   • 18% tablet  480-1024
    //   • 15% desktop 1024-1920
    //   • ~0.4% over 1920
    // Trimming the buckets gives us 7 useful sizes that cover the actual
    // viewport space, and saves Vercel cache + build time. The 360 entry
    // covers iPhone SE / mini; 1920 stays for QHD desktops; 3840/4K out.
    deviceSizes: [360, 414, 640, 750, 828, 1080, 1280, 1600, 1920],
    // imageSizes (for fixed-width images, e.g. icons, thumbnails) — also
    // trimmed from default [16,32,48,64,96,128,256,384] to the ones we
    // actually use. Reduces build asset count further.
    imageSizes: [32, 64, 96, 128, 256, 384],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
        pathname: "/**",
      },
      ...(supabaseHost()
        ? [
            {
              protocol: "https",
              hostname: supabaseHost(),
              pathname: "/**",
            },
          ]
        : []),
    ],
  },
  // ─── PostHog reverse proxy (EU) ──────────────────────────────────────────
  // Ingest analytics/replay through our own origin so requests are first-party:
  //   • far fewer ad-blocker / tracking-protection drops (better data quality)
  //   • no third-party PostHog domain in the user's network tab
  //   • everything stays inside `connect-src 'self'` in the CSP
  // The browser hits /ingest/* on mioshy.com; Vercel proxies to eu.posthog.com.
  // Static assets (recorder.js etc.) go to the eu-assets host.
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: `${PH_ASSETS_HOST}/static/:path*`,
      },
      {
        source: "/ingest/:path*",
        destination: `${PH_INGEST_HOST}/:path*`,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.mioshy.com" }],
        destination: "https://mioshy.com/:path*",
        permanent: true,
      },
      // TODO(old-urls): Add 301 mappings from the legacy site once exported
      // from GSC/Ahrefs/ScreamingFrog. Map high-value URLs to the closest
      // new equivalent; otherwise redirect to "/".
    ];
  },
  async headers() {
    // Moderate CSP — `'unsafe-inline'` and `'unsafe-eval'` are intentional
    // for now and tracked for tightening in a separate "CSP nonce migration"
    // commit. See AUDIT_REPORT.md for the rationale.
    //
    //   • `'unsafe-inline'` covers the inline GTM init script + JSON-LD
    //     <script> tags. Both will move to nonces once we plumb a request
    //     nonce through the root layout.
    //   • `'unsafe-eval'` is required by Next.js dev-mode HMR and by some
    //     production code paths (Framer Motion's spring solver, parts of
    //     react-dom/legacy server rendering, our markdown editor's Function
    //     constructor). Removing it is doable but disruptive; deferred.
    //   • `style-src 'unsafe-inline'` is required by Framer Motion + Tailwind
    //     JIT-injected critical CSS, both of which set `style="..."` directly.
    //
    // Cardcom payment domains: `secure.cardcom.solutions` is what
    // lib/cardcom.ts hits today. Wildcards on both `*.cardcom.solutions`
    // and `*.cardcom.co.il` are included for resilience to Cardcom's
    // multi-domain setup. Verify in dev with the real checkout flow before
    // production deploy — if a different subdomain shows up, add it here.
    // `upgrade-insecure-requests` and HSTS are production-only.
    // In `next dev` (HTTP on localhost) those two directives make Safari
    // (which is stricter than Chrome about loopback) try to fetch every
    // _next/static chunk over HTTPS, fail the TLS handshake, and render
    // the page completely unstyled. Gate them on Vercel production.
    const isProd = process.env.VERCEL_ENV === "production";

    const cspDirectives = [
      "default-src 'self'",
      // Meta (Facebook) Pixel loads fbevents.js from connect.facebook.net — must
      // be in script-src or the browser blocks the pixel entirely (no fbq, no
      // events). CAPI is server-side so it was unaffected; this is what was
      // missing (2026-06-21).
      // Calendly popup widget loads widget.js from assets.calendly.com and the
      // booking UI runs in a calendly.com iframe (frame-src below).
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://*.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://connect.facebook.net https://assets.calendly.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://assets.calendly.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      // PostHog session replay (rrweb) spins up a blob: web worker to compress
      // recordings off the main thread. Without an explicit worker-src it falls
      // back to script-src, which doesn't allow blob: — so declare it here.
      "worker-src 'self' blob:",
      // PostHog ingest is first-party via the /ingest proxy, so 'self' already
      // covers it. The region hosts (PH_INGEST_HOST / PH_ASSETS_HOST) are listed
      // as a belt-and-suspenders fallback in case the proxy is ever bypassed —
      // and follow NEXT_PUBLIC_POSTHOG_REGION so EU/US stay in sync.
      // Meta Pixel event beacons go to www.facebook.com/tr (and fbevents.js may
      // fetch config from connect.facebook.net). img-src already allows https:
      // so the image-beacon path was fine, but the fetch/XHR path needs these.
      `connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://*.googletagmanager.com https://*.cardcom.solutions https://*.cardcom.co.il ${PH_INGEST_HOST} ${PH_ASSETS_HOST} https://www.facebook.com https://connect.facebook.net https://calendly.com https://*.calendly.com`,
      "frame-src 'self' https://www.googletagmanager.com https://*.googletagmanager.com https://*.cardcom.solutions https://*.cardcom.co.il https://calendly.com https://*.calendly.com",
      "frame-ancestors 'none'",
      "form-action 'self' https://*.cardcom.solutions https://*.cardcom.co.il",
      "base-uri 'self'",
      "object-src 'none'",
    ];
    if (isProd) cspDirectives.push("upgrade-insecure-requests");
    const csp = cspDirectives.join("; ");

    const securityHeaders = [
      { key: "Content-Security-Policy", value: csp },
      // Two years, full subdomain coverage, preload-list eligible. mioshy.com
      // is HTTPS-only so this is safe to flip on immediately — but ONLY in
      // production. Sending HSTS from `next dev` pins the browser to HTTPS
      // for two years on localhost, after which `http://localhost:3000`
      // refuses to load.
      ...(isProd
        ? [
            {
              key: "Strict-Transport-Security",
              value: "max-age=63072000; includeSubDomains; preload",
            },
          ]
        : []),
      { key: "X-Content-Type-Options", value: "nosniff" },
      // Defense-in-depth alongside frame-ancestors 'none' above.
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      // Drop access to high-impact APIs by default; opt back in per page if
      // we ever ship a feature that needs them.
      {
        key: "Permissions-Policy",
        value:
          "accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()",
      },
    ];

    if (process.env.VERCEL_ENV === "preview") {
      return [
        {
          source: "/:path*",
          headers: [
            { key: "X-Robots-Tag", value: "noindex, nofollow" },
            ...securityHeaders,
          ],
        },
      ];
    }
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // Avoid webpack dev-server/HMR desync (missing ./NNN.js chunks) by not
  // persisting webpack's cache during `next dev`. Production builds keep caching.
  webpack: (config, { dev }) => {
    if (dev) {
      config.cache = false;
    }
    return config;
  },
};

export default withBundleAnalyzer(withNextIntl(nextConfig));
