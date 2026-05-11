import type { Metadata } from "next";
import { LocalGameClient } from "./ui";

function siteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://mioshy.com").replace(/\/+$/, "");
}

export async function generateMetadata({
  params,
}: {
  params: { locale: string };
}): Promise<Metadata> {
  const { locale } = params;
  const base = siteUrl();
  const isHe = locale === "he";
  return {
    title: isHe ? "Mioshy - משחק מקומי" : "Mioshy - Local Game",
    description: isHe
      ? "משחק סולמות ונחשים לזוגות, על מכשיר אחד."
      : "Snakes & Ladders for couples, played on a single device.",
    alternates: {
      canonical: `${base}/${locale}/game/local`,
      languages: {
        en: `${base}/en/game/local`,
        he: `${base}/he/game/local`,
        "x-default": `${base}/he/game/local`,
      },
    },
  };
}

export default function LocalGamePage() {
  return <LocalGameClient />;
}
