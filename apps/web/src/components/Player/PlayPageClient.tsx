"use client";

import GamePage from "@/components/Player/GamePage";
import { LeaderBoard } from "@/components/Player/GameScreens";
import { loadFinalResult } from "@/lib/final-result";
import ValidatePlayer from "@/components/Player/ValidatePlayer";
import GameLogo from "@/components/Game/GameLogo";
import Skeleton from "@/components/ui/Skeleton";
import { usePlayerPlayQuery } from "@/lib/modules/game-sessions/hooks";
import { isAxiosError } from "axios";
import { notFound, redirect } from "next/navigation";

export default function PlayPageClient({ playerId }: { playerId: string }) {
  const { data, isPending, isError, error } = usePlayerPlayQuery(playerId);

  if (isError && isAxiosError(error) && error.response?.status === 404) {
    notFound();
  }

  if (isPending) {
    return (
      <div className="p-4 md:p-8">
        <Skeleton className="mb-6 h-20 w-20 rounded bg-white dark:bg-card-dark" />
        <Skeleton className="h-[75vh] w-full rounded-2xl bg-white dark:bg-card-dark" />
      </div>
    );
  }

  if (!data) {
    return (
      <div
        className="p-8 text-center text-dark dark:text-white"
        role="alert"
        aria-atomic="true"
      >
        Could not load game data. Please try again.
      </div>
    );
  }

  const { player, game } = data;

  if (!player.gameId || !game) {
    // The room is gone; a finished player keeps their thank-you screen.
    const last =
      typeof window !== "undefined" ? loadFinalResult(playerId) : null;
    if (last) {
      return (
        <LeaderBoard
          playerId={playerId}
          position={last.position}
          score={last.score}
          quizTitle={last.quizTitle}
          players={last.players}
        />
      );
    }
    redirect(`/player/joinRoom/${playerId}`);
  }

  return (
    <>
      <ValidatePlayer playerId={player.id} />
      <div className="p-4 pb-2 flex justify-between">
        <GameLogo logo={game.quiz?.logo} size={80} />
      </div>
      <GamePage player={player} game={game} />
    </>
  );
}
