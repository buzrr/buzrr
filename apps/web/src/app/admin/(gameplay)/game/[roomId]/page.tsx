import { auth } from "@/utils/auth";
import GameLobby from "@/components/Admin/Game/GameLobby";
import { prisma } from "@/utils/prisma";
import { redirect } from "next/navigation";

const page = async ({ params }: { params: { roomId: string } }) => {
  const session = await auth();

  if (!session || !session.user) redirect("/api/auth/signin");

  const user = await prisma.user.findUnique({
    where: {
      email: session.user.email as string,
    },
  });

  const room = await prisma.gameSession.findUnique({
    where: {
      id: params.roomId,
    },
  });

  const players = await prisma.player.findMany({
    where: {
      gameId: params.roomId,
    },
  });

  if (!room) throw new Error("Room not found");

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

  return (
    <div className="flex justify-center items-center h-fit md:h-[85vh] w-full bg-light-bg dark:bg-dark-bg">
      <GameLobby
        roomId={params.roomId}
        userId={user.id}
        gameCode={room?.gameCode}
        players={players}
        quizQuestions={quizQuestions}
        currentQues={room?.currentQuestion}
      />
    </div>
  );
};

export default page;
