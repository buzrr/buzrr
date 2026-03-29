"use client";

import GameLobby from "@/components/Admin/Game/GameLobby";
import { useAdminLobbyQuery } from "@/lib/modules/game-sessions/hooks";
import { isAxiosError } from "axios";
import { notFound } from "next/navigation";

export default function AdminGameLobbyClient({
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
    <div className="flex justify-center items-center h-fit md:h-[85vh] w-full bg-light-bg dark:bg-dark-bg">
      <GameLobby
        roomId={roomId}
        userId={userId}
        gameCode={room.gameCode}
        players={playersForLobby}
        quizQuestions={quiz}
        currentQues={room.currentQuestion}
      />
    </div>
  );
}
