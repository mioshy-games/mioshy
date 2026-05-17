import type { Metadata } from "next";
import { LocalGameClient } from "./ui";
import { loadActiveSnakesConfig } from "@/lib/snakes/configLoader";

// The local game is keyed off the admin-managed Snakes config, which can
// change at any moment from `/dashboard/snakes`. Force dynamic rendering
// so edits show up on the next visit without a redeploy.
export const dynamic = "force-dynamic";

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

export default async function LocalGamePage() {
  // Load the live admin-managed config on the server. Falls back through
  // is_active → is_default → hardcoded — see loadActiveSnakesConfig docs.
  const { config, source } = await loadActiveSnakesConfig();
  return <LocalGameClient initialConfig={config} configSource={source} />;
}
