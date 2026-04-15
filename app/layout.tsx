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
      <body className="min-h-[100dvh] antialiased">{children}</body>
    </html>
  );
}
