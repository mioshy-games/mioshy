import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

function supabaseHost() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return null;
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    // AVIF first so the optimizer prefers it when the browser advertises
    // support — typically 25-35% smaller than the same WebP at the same
    // visual quality, which directly cuts hero LCP bytes on mobile.
    // WebP stays as the fallback for older browsers.
    formats: ["image/avif", "image/webp"],
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
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://*.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: blob: https:",
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://www.google-analytics.com https://*.google-analytics.com https://www.googletagmanager.com https://*.googletagmanager.com https://*.cardcom.solutions https://*.cardcom.co.il",
      "frame-src 'self' https://www.googletagmanager.com https://*.googletagmanager.com https://*.cardcom.solutions https://*.cardcom.co.il",
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

export default withNextIntl(nextConfig);
