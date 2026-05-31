import type { ReactNode } from "react";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { Assistant, Frank_Ruhl_Libre } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { cn } from "@/lib/utils";
import {
  GoogleTagManager,
  GoogleTagManagerNoscript,
} from "@/components/analytics/GoogleTagManager";

// ─────────────────────────────────────────────────────────────────────────────
// Root metadata - inherited by every page, with per-page metadata overriding
// only what's specific. Without `metadataBase`, every per-page OG/Twitter URL
// is relative and crawlers / unfurlers (Slack, Twitter, Facebook, Google) can
// not resolve them. Defining it once here fixes social-share previews
// site-wide and lets us define safe defaults for OG image + twitter card.
// ─────────────────────────────────────────────────────────────────────────────
const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com"
).replace(/\/+$/, "");

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Mioshy - Couples games that warm up the connection",
    template: "%s · Mioshy",
  },
  description:
    "Mioshy is a platform for couples - games, an online couple-therapy track, and a personalised journey. Built by relationship experts.",
  applicationName: "Mioshy",
  authors: [{ name: "Mioshy" }],
  // Default OG card. Pages that override `openGraph` will replace this entirely
  // for that route; the metadataBase above still lets relative URLs resolve.
  // Files live at /public/opengraph-image.jpg + /public/twitter-image.jpg
  // (1200×630, verified 2026-05-22). When sharing on WhatsApp / Facebook /
  // Twitter / Slack, the unfurler now sees a real image instead of the
  // 404'd /images/og-default.png that the previous metadata pointed at.
  openGraph: {
    type: "website",
    siteName: "Mioshy",
    images: [
      {
        url: "/opengraph-image.jpg",
        width: 1200,
        height: 630,
        alt: "Mioshy — משחקי זוגיות שמחממים את הקשר",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      {
        url: "/twitter-image.jpg",
        width: 1200,
        height: 630,
        alt: "Mioshy — משחקי זוגיות שמחממים את הקשר",
      },
    ],
  },
  // Tell crawlers we accept indexing by default; per-page rules in robots.txt
  // and per-route `robots` metadata can still tighten this for specific paths.
  robots: { index: true, follow: true },
  // Full favicon set (added 2026-05-22). Browsers pick the best size per
  // surface: tab favicons read 16/32, iOS home-screen reads apple-touch
  // (180×180), Android home-screen / PWA reads the manifest's 192+512.
  // .ico is kept as the universal fallback for legacy browsers and as
  // /favicon.ico which crawlers fetch implicitly.
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
};

// ─────────────────────────────────────────────────────────────────────────────
// FONT SYSTEM (Itzik 2026-05-07)
// ─────────────────────────────────────────────────────────────────────────────
// The whole site uses TWO Google fonts only — both with built-in Hebrew +
// Latin subsets so the same files cover both locales. Previous setup loaded
// SEVEN distinct font families (Inter, Playfair, IBM Plex Hebrew, Heebo,
// Noto Serif Hebrew, Frank Ruhl, Assistant) which was an enormous
// first-paint cost and a brand-consistency hazard.
//
//   • Frank Ruhl Libre   →  serif display + serif body for headings
//   • Assistant          →  sans body
//
// Both fonts ship Hebrew + Latin — no need to fork by locale. Existing CSS
// variables (`--font-heebo`, `--font-noto-serif-hebrew`, `--font-heading-*`,
// `--font-body-*`) are still emitted so legacy stylesheets keep working,
// but they all point at one of these two fonts. That's a deliberate
// backwards-compat shim — when stylesheets are rewritten to reference the
// canonical pair directly, we can delete the aliases.
// ─────────────────────────────────────────────────────────────────────────────
// 2026-05-19 — `display: "swap" → "optional"` for both fonts.
// REASON: Lighthouse mobile run showed CLS 0.57 (threshold 0.1) with
// the layout-shift culprit identified as section.hero > ::before —
// classic FOUT signature: the Hero's clamp(52px,7.4vw,96px) headline
// shipped in a fallback font first, then swapped to Frank Ruhl Libre
// when the web font arrived, shifting every section below the hero.
// `display: "optional"` gives the web font a 100ms window; if it
// hasn't loaded, the page commits to the fallback for this session
// and skips the swap entirely. On cached visits the font loads from
// disk before paint so users still see the brand serif. Net: zero
// font-swap CLS, brand stays intact for returning users (which is
// the majority once we have any traffic).
// Frank_Ruhl_Libre is by far the bigger CLS contributor (headlines
// are huge); Assistant gets the same treatment so body text doesn't
// reflow either.
// adjustFontFallback (2026-05-21) — when display:"optional" misses
// the 100ms window, we commit to the system fallback. Without
// matched metrics, fallback Arial/Times has slightly different
// x-height + cap-height than Assistant / Frank Ruhl, which can
// shift line heights by a few pixels across the page. next/font
// auto-generates a @font-face fallback with size-adjust / ascent-
// override / descent-override so the fallback occupies the same
// vertical space as the web font. Net effect on CLS: small but
// stacks with the other fixes shipped 2026-05-21.
//
// In Next 14.2 google-font API this is a boolean. Next picks the
// correct fallback family per font category internally (Arial for
// sans, Times New Roman for serif). adjustFontFallback defaults to
// true in current Next versions but we set it EXPLICITLY so future
// upgrades / refactors don't accidentally disable the metric match.
const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-assistant",
  display: "optional",
  adjustFontFallback: true,
});

const frankRuhl = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-frank-ruhl",
  display: "optional",
  adjustFontFallback: true,
});

// Preconnect to the Supabase domain used for images & realtime so the first
// paint of any game/article page isn't gated on a DNS round-trip. We read
// the env var at module scope so the URL is baked into the HTML and works
// even with JS disabled.
const SUPABASE_ORIGIN = (() => {
  try {
    const raw = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!raw) return null;
    return new URL(raw).origin;
  } catch {
    return null;
  }
})();

export default function RootLayout({ children }: { children: ReactNode }) {
  // Locale is stamped on the request by `middleware.ts` (header
  // `x-mioshy-locale`). Reading it here lets us render `<html lang dir>` on
  // the server — without this, the initial HTML had no `lang` attribute and
  // the locale was patched in client-side via a `useEffect`, which Lighthouse
  // / Google flag as a SEO + a11y failure (`tech.html_lang_present`).
  const locale = headers().get("x-mioshy-locale") === "en" ? "en" : "he";
  const dir = locale === "he" ? "rtl" : "ltr";

  return (
    <html
      lang={locale}
      dir={dir}
      suppressHydrationWarning
      className={cn(
        "font-sans",
        assistant.variable,
        frankRuhl.variable,
      )}
      // Backwards-compat alias variables. Old CSS still references
      // --font-body-latin / --font-heading-latin / --font-heading-hebrew /
      // --font-body-hebrew / --font-heebo / --font-noto-serif-hebrew. Map
      // them all to one of the two fonts loaded above so visuals don't
      // break while we migrate stylesheets to the canonical pair.
      style={
        {
          "--font-body-latin":         "var(--font-assistant)",
          "--font-body-hebrew":        "var(--font-assistant)",
          "--font-heebo":              "var(--font-assistant)",
          "--font-heading-latin":      "var(--font-frank-ruhl)",
          "--font-heading-hebrew":     "var(--font-frank-ruhl)",
          "--font-noto-serif-hebrew":  "var(--font-frank-ruhl)",
        } as React.CSSProperties
      }
    >
      <head>
        {/* Preconnect to Google Fonts CDN. next/font self-hosts most font
            files but the initial CSS request still hits Google, and PSI's
            network-dependency-tree audit flags the chain when the
            connection isn't warmed in advance. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin=""
        />
        {SUPABASE_ORIGIN ? (
          // dns-prefetch only - full preconnect held a connection slot
          // that the marketing homepage never used (Supabase is hit only
          // on auth-gated pages and the dashboard). Lighthouse 2026-05-06
          // flagged this as "Unused preconnect"; dropping it frees the
          // budget for the critical CSS/font requests instead.
          <link rel="dns-prefetch" href={SUPABASE_ORIGIN} />
        ) : null}
        <meta name="theme-color" content="#1a0a2e" />
        <meta name="format-detection" content="telephone=no" />
        <GoogleTagManager />
      </head>
      <body className="min-h-[100dvh] antialiased">
        <GoogleTagManagerNoscript />
        {children}
        {/* Real-user perf monitoring (Itzik 2026-05-31). SpeedInsights
            samples Core Web Vitals from production sessions; Analytics
            tracks page-view counts. Both are tree-shaken in dev — they
            only ship + transmit on Vercel production. The dashboards
            live under /vercel.com/<team>/<project>/{speed-insights,
            analytics}. */}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
