import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { GameLobbyClient } from "./ui";

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
  const title = "Mioshy - Game Lobby";
  const description = "Start a new game or join a room.";
  return {
    title,
    description,
    alternates: {
      canonical: `${base}/${locale}/game`,
      languages: {
        en: `${base}/en/game`,
        he: `${base}/he/game`,
        "x-default": `${base}/en/game`,
      },
    },
  };
}

export default async function GameLobbyPage() {
  // Keep texts simple for v1; can be moved to messages later.
  await getTranslations("metadata");
  return <GameLobbyClient />;
}

