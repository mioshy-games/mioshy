import type { ReactNode } from "react";
import type { Metadata } from "next";
import {
  Assistant,
  Frank_Ruhl_Libre,
  Heebo,
  IBM_Plex_Sans_Hebrew,
  Inter,
  Noto_Serif_Hebrew,
  Playfair_Display,
} from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

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
  openGraph: {
    type: "website",
    siteName: "Mioshy",
    images: [
      {
        url: "/images/og-default.png",
        width: 1200,
        height: 630,
        alt: "Mioshy - Couples games",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["/images/og-default.png"],
  },
  // Tell crawlers we accept indexing by default; per-page rules in robots.txt
  // and per-route `robots` metadata can still tighten this for specific paths.
  robots: { index: true, follow: true },
  icons: {
    icon: "/favicon.ico",
  },
};

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body-latin",
  display: "swap",
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-heading-latin",
  display: "swap",
});

const ibmPlexHebrew = IBM_Plex_Sans_Hebrew({
  subsets: ["hebrew"],
  weight: ["400", "600", "700"],
  variable: "--font-heading-hebrew",
  display: "swap",
});

const assistant = Assistant({
  subsets: ["hebrew", "latin"],
  weight: ["400", "600", "700"],
  variable: "--font-body-hebrew",
  display: "swap",
});

// New homepage v2 fonts - body, accent serif, and display serif.
// Loaded alongside the existing fonts so legacy pages stay untouched.
const heebo = Heebo({
  subsets: ["hebrew", "latin"],
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  variable: "--font-heebo",
  display: "swap",
});

const frankRuhl = Frank_Ruhl_Libre({
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "700", "900"],
  variable: "--font-frank-ruhl",
  display: "swap",
});

const notoSerifHebrew = Noto_Serif_Hebrew({
  subsets: ["hebrew"],
  weight: ["400", "700", "900"],
  variable: "--font-noto-serif-hebrew",
  display: "swap",
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
  return (
    <html
      suppressHydrationWarning
      className={cn(
        "font-sans",
        inter.variable,
        playfair.variable,
        ibmPlexHebrew.variable,
        assistant.variable,
        heebo.variable,
        frankRuhl.variable,
        notoSerifHebrew.variable,
      )}
    >
      <head>
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
      </head>
      <body className="min-h-[100dvh] antialiased">{children}</body>
    </html>
  );
}
