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
  return {
    title: "Mioshy - משחק מקומי",
    description: "משחק סולמות ונחשים לזוגות, על מכשיר אחד.",
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
