import { SnakesGameClient } from "./ui";

export default async function SnakesGamePage({
  params,
}: {
  params: { locale: string; roomCode: string };
}) {
  return <SnakesGameClient locale={params.locale} roomCode={params.roomCode} />;
}

