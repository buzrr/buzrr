"use client";

import Lobby from "@/components/Admin/Lobby";
import { useAdminLobbyQuery } from "@/lib/modules/game-sessions/hooks";
import { isAxiosError } from "axios";
import { notFound } from "next/navigation";

export default function AdminPlayClient({
  roomId,
  userId,
}: {
  roomId: string;
  userId: string;
}) {
  const { data, isPending, isError, error } = useAdminLobbyQuery(roomId);

  if (isError && isAxiosError(error)) {
    if (error.response?.status === 404) notFound();
    if (error.response?.status === 403) {
      return (
        <p className="p-6 text-dark dark:text-white">Unauthorized</p>
      );
    }
  }

  if (isPending || !data) {
    return (
      <p className="p-6 text-dark dark:text-white">Loading…</p>
    );
  }

  const { room, players, quiz } = data;
  const playersForLobby = players.map((p) => ({
    ...p,
    profilePic: p.profilePic ?? undefined,
  }));

  return (
    <Lobby
      quizId={room.quizId}
      quizTitle={quiz.title}
      roomId={roomId}
      userId={userId}
      gameCode={room.gameCode}
      players={playersForLobby}
      quizQuestions={quiz}
      gameStarted={room.isPlaying}
      currentQues={room.currentQuestion}
    />
  );
}
