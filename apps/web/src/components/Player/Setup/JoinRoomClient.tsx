"use client";

import SetLocalItem from "@/components/Player/SetLocalItem";
import ResetReduxStates from "@/components/Player/ResetReduxStates";
import Skeleton from "@/components/ui/Skeleton";
import JoinRoomForm from "@/components/Player/Setup/JoinRoomForm";
import JoinRoomProfileCard from "@/components/Player/Setup/JoinRoomProfileCard";
import ClientImage from "@/components/ClientImage";
import {
  useClearPlayerGameMutation,
  usePlayerQuery,
} from "@/lib/modules/players/hooks";
import { clearPlayerLocalSession } from "@/lib/player-session";
import { isAxiosError } from "axios";
import { notFound, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function JoinRoomClient({ playerId }: { playerId: string }) {
  const router = useRouter();
  const [sessionAllowed, setSessionAllowed] = useState(false);
  const { data: player, isPending, isError, error } = usePlayerQuery(
    playerId,
    sessionAllowed,
  );
  const { mutate: clearGame, isPending: clearingGame } =
    useClearPlayerGameMutation(playerId);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!window.localStorage.getItem("playerToken")) {
      clearPlayerLocalSession();
      router.replace("/player");
      return;
    }
    setSessionAllowed(true);
  }, [router]);

  useEffect(() => {
    if (!player?.gameId) return;
    clearGame();
  }, [player?.gameId, player?.id, clearGame]);

  const blockJoin = Boolean(player?.gameId) || clearingGame;

  if (!sessionAllowed) {
    return (
      <div className="p-8 text-center text-dark dark:text-white">
        Loading…
      </div>
    );
  }

  if (isError) {
    if (isAxiosError(error) && error.response?.status === 404) {
      notFound();
    }
    return (
      <div className="p-8 text-center text-dark dark:text-white">
        Could not load your player profile. Try again later.
      </div>
    );
  }

  if (isPending || !player || blockJoin) {
    return (
      <div className="p-4 md:p-8">
        <Skeleton className="mb-6 h-20 w-20 rounded bg-white dark:bg-card-dark" />
        <div className="flex h-[81vh] w-full gap-4">
          <Skeleton className="h-full w-full md:w-80 rounded-xl bg-white dark:bg-card-dark" />
          <Skeleton className="hidden md:block h-full flex-1 rounded-xl bg-white dark:bg-card-dark" />
        </div>
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
          <JoinRoomForm />
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
