"use client";

import Lobby from "@/components/Admin/Lobby";
import Skeleton from "@/components/ui/Skeleton";
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

  if (isError) {
    if (isAxiosError(error)) {
      if (error.response?.status === 404) notFound();
      if (error.response?.status === 403) {
        return (
          <p className="p-6 text-dark dark:text-white">Unauthorized</p>
        );
      }
    }
    return (
      <p className="p-6 text-dark dark:text-white">
        Could not load this game. Try again later.
      </p>
    );
  }

  if (isPending) {
    return (
      <div className="w-full p-6">
        <Skeleton className="mx-auto h-[85vh] w-full rounded-2xl bg-white dark:bg-card-dark" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="p-6 text-dark dark:text-white">
        Could not load this game. Try again later.
      </p>
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
      gameStarted={room.isPlaying}
      currentQues={room.currentQuestion}
    />
  );
}
