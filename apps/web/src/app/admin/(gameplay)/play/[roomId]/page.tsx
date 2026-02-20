import { prisma } from "@/utils/prisma";
import { auth } from "@/utils/auth";
import { redirect } from "next/navigation";
import Lobby from "@/components/Admin/Lobby";

async function Play({ params }: { params: { roomId: string } }) {
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

  // fetch quiz
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

  const quiz = await prisma.quiz.findUnique({
    where: { id: room?.quizId },
  });

  return (
    <>
      <Lobby
        quizId={room?.quizId}
        quizTitle={quiz?.title ? quiz.title : ""}
        roomId={params.roomId}
        userId={user.id}
        gameCode={room?.gameCode}
        players={players}
        quizQuestions={quizQuestions}
        gameStarted={room?.isPlaying}
        currentQues={room?.currentQuestion}
      />
    </>
  );
}

export default Play;
