"use client";

import SetLocalItem from "@/components/Player/setLocalItem";
import ResetReduxStates from "@/components/Player/ResetReduxStates";
import JoinRoomForm from "@/components/Player/Setup/JoinRoomForm";
import JoinRoomProfileCard from "@/components/Player/Setup/JoinRoomProfileCard";
import ClientImage from "@/components/ClientImage";
import {
  useClearPlayerGameMutation,
  usePlayerQuery,
} from "@/lib/modules/players/hooks";
import { isAxiosError } from "axios";
import { notFound } from "next/navigation";
import { useEffect } from "react";

export default function JoinRoomClient({ playerId }: { playerId: string }) {
  const { data: player, isPending, isError, error } = usePlayerQuery(playerId);
  const { mutate: clearGame, isPending: clearingGame } =
    useClearPlayerGameMutation(playerId);

  useEffect(() => {
    if (!player?.gameId) return;
    clearGame();
  }, [player?.gameId, player?.id, clearGame]);

  if (isError && isAxiosError(error) && error.response?.status === 404) {
    notFound();
  }

  const needsClear = Boolean(player?.gameId);
  if (isPending || !player || (needsClear && clearingGame)) {
    return (
      <div className="p-8 text-center text-dark dark:text-white">
        Loading…
      </div>
    );
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
