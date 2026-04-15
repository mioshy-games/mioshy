import { RoomClient } from "./ui";

export default async function RoomPage({
  params,
}: {
  params: { locale: string; roomCode: string };
}) {
  return <RoomClient locale={params.locale} roomCode={params.roomCode} />;
}

