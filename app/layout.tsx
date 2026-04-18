import type { ReactNode } from "react";
import { Assistant, IBM_Plex_Sans_Hebrew, Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

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
      )}
    >
      <head>
        {SUPABASE_ORIGIN ? (
          <>
            <link rel="preconnect" href={SUPABASE_ORIGIN} crossOrigin="" />
            <link rel="dns-prefetch" href={SUPABASE_ORIGIN} />
          </>
        ) : null}
        <meta name="theme-color" content="#1a0a2e" />
        <meta name="format-detection" content="telephone=no" />
      </head>
      <body className="min-h-[100dvh] antialiased">{children}</body>
    </html>
  );
}
