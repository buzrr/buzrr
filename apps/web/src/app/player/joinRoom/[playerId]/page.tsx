import JoinRoomClient from "@/components/Player/Setup/JoinRoomClient";

export default async function JoinRoom({
  params,
}: {
  params: Promise<{ playerId: string }>;
}) {
  const { playerId } = await params;
  return <JoinRoomClient playerId={playerId} />;
}
