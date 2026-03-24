import { prisma } from "@buzrr/prisma";
import SetLocalItem from "@/components/Player/setLocalItem";
import ResetReduxStates from "@/components/Player/ResetReduxStates";
import JoinRoomForm from "@/components/Player/Setup/JoinRoomForm";
import JoinRoomProfileCard from "@/components/Player/Setup/JoinRoomProfileCard";
import ClientImage from "@/components/ClientImage";

async function JoinRoom({ params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const player = await prisma.player.findUnique({
    where: {
      id: playerId,
    },
  });

  if (!player) {
    throw new Error("Player not found");
  }

  if (player?.gameId) {
    await prisma.player.update({
      where: { id: playerId },
      data: {
        gameId: null,
      },
    });
  }
  return (
    <>
      <SetLocalItem mapKey="playerId" value={playerId} />
      <ResetReduxStates />
      <div className="p-4 flex justify-between">
        <ClientImage
          props={{
            src: "/images/logo.svg",
            darksrc: "/images/logo-dark.svg",
            alt: "Buzrr Logo",
            width: 80,
            height: 80,
          }}
        />
      </div>
      <div className="w-full h-[81vh] flex gap-4 px-4 *:bg-white dark:*:bg-dark *:rounded-xl">
        <div className="w-full md:w-fit py-4">
          <JoinRoomForm playerId={playerId} />
        </div>
        <JoinRoomProfileCard
          playerId={playerId}
          initialPlayerName={player.name}
          profilePic={player.profilePic}
        />
      </div>
    </>
  );
}

export default JoinRoom;
