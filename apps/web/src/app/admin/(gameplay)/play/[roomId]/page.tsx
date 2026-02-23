import { prisma } from "@buzrr/prisma";
import { auth } from "@/utils/auth";
import { redirect } from "next/navigation";
import Lobby from "@/components/Admin/Lobby";

async function Play({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const session = await auth();

  if (!session || !session.user) redirect("/api/auth/signin");

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

  if (!room) throw new Error("Room not found");

  if (room.creatorId !== session.user.id) throw new Error("Unauthorized");

  // fetch quiz
  const quizQuestions = await prisma.quiz.findUnique({
    where: { id: room.quizId },
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

  return (
    <>
      <Lobby
        quizId={room.quizId}
        quizTitle={quizQuestions?.title ?? ""}
        roomId={roomId}
        userId={session.user.id}
        gameCode={room.gameCode}
        players={playersForLobby}
        quizQuestions={quizQuestions ?? {}}
        gameStarted={room.isPlaying}
        currentQues={room.currentQuestion}
      />
    </>
  );
}

export default Play;
