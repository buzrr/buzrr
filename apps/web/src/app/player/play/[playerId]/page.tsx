import { prisma, GameSession } from "@buzrr/prisma";
import GamePage from "@/components/Player/GamePage";
import ValidatePlayer from "@/components/Player/ValidatePlayer";
import ClientImage from "@/components/ClientImage";
import { redirect, notFound } from "next/navigation";

const page = async ({ params }: { params: Promise<{ playerId: string }> }) => {
  const { playerId } = await params;
  const player = await prisma.player.findUnique({
    where: { id: playerId },
  });

  if (!player) {
    notFound();
  }

  if (!player.gameId) {
    throw new Error("Player not in game");
  }

  const game = await prisma.gameSession.findUnique({
    where: { id: player.gameId },
    include: {
      quiz: {
        include: {
          questions: {
            include: {
              options: {
                select: {
                  id: true,
                  title: true,
                },
              },
            },
          },
        },
      },
      creator: {
        select: {
          name: true,
          image: true,
        },
      },
    },
  });

  if (!game) {
    redirect("/player/joinRoom/" + playerId);
  }

  return (
    <>
      <ValidatePlayer playerId={player.id} />
      <div className="p-4 pb-2 flex justify-between">
        <ClientImage
          props={{
            src: "/images/logo.svg",
            darksrc: "/images/logo-dark.svg",
            alt: "Buzzr Logo",
            width: 80,
            height: 80,
          }}
        />
      </div>
      <GamePage player={player} game={game as GameSession} />
    </>
  );
};

export default page;
