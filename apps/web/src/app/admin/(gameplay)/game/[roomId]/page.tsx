import { auth } from "@/utils/auth";
import GameLobby from "@/components/Admin/Game/GameLobby";
import { prisma } from "@buzrr/prisma";
import { redirect, notFound } from "next/navigation";

const page = async ({ params }: { params: Promise<{ roomId: string }> }) => {
  const { roomId } = await params;
  const session = await auth();

  if (!session || !session.user) redirect("/api/auth/signin");

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email as string,
    },
  });

  const room = await prisma.gameSession.findUnique({
    where: {
      id: roomId,
    },
  });

  const players = await prisma.player.findMany({
    where: {
      gameId: roomId,
    },
  });

  if (!room) {
    return notFound();
  }

  if (room.creatorId !== user?.id) throw new Error("Unauthorized");

  const quizQuestions = await prisma.quiz.findUnique({
    where: { id: room?.quizId },
    include: {
      questions: {
        include: {
          options: true,
        },
      },
    },
  });

  const playersForLobby = players.map((p) => ({
    ...p,
    profilePic: p.profilePic ?? undefined,
  }));

  if(!quizQuestions) {
    return notFound();
  }

  return (
    <div className="flex justify-center items-center h-fit md:h-[85vh] w-full bg-light-bg dark:bg-dark-bg">
      <GameLobby
        roomId={roomId}
        userId={user.id}
        gameCode={room?.gameCode}
        players={playersForLobby}
        quizQuestions={quizQuestions}
        currentQues={room?.currentQuestion}
      />
    </div>
  );
};

export default page;
