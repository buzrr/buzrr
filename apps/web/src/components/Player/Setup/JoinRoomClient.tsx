"use client";

import SetLocalItem from "@/components/Player/SetLocalItem";
import ResetReduxStates from "@/components/Player/ResetReduxStates";
import Skeleton from "@/components/ui/Skeleton";
import JoinRoomForm from "@/components/Player/Setup/JoinRoomForm";
import JoinRoomProfileCard from "@/components/Player/Setup/JoinRoomProfileCard";
import JoinShell from "@/components/Player/Setup/JoinShell";
import {
  useClearPlayerGameMutation,
  usePlayerQuery,
} from "@/lib/modules/players/hooks";
import { isAxiosError } from "axios";
import { notFound, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

function JoinRoomSkeleton() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <Skeleton className="my-4 h-10 w-20 rounded bg-white dark:bg-card-dark" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 h-[80dvh]">
        <Skeleton className="h-full rounded-3xl bg-white dark:bg-dark" />
        <Skeleton className="hidden md:block h-full rounded-3xl bg-white dark:bg-dark" />
      </div>
    </div>
  );
}

export default function JoinRoomClient({ playerId }: { playerId: string }) {
  const router = useRouter();
  const [sessionAllowed, setSessionAllowed] = useState(false);
  const {
    data: player,
    isPending,
    isError,
    error,
  } = usePlayerQuery(playerId, sessionAllowed);
  const { mutate: clearGame, isPending: clearingGame } =
    useClearPlayerGameMutation(playerId);

  useEffect(() => {
    if (!window.localStorage.getItem("playerToken")) {
      router.replace("/player");
      return;
    }
    setSessionAllowed(true);
  }, [router]);

  useEffect(() => {
    if (!player?.gameId) return;
    clearGame();
  }, [player?.gameId, clearGame]);

  const blockJoin = Boolean(player?.gameId) || clearingGame;
  const [name, setName] = useState<string | null>(null);
  const displayName = name ?? player?.name ?? "";

  if (!sessionAllowed) {
    return <JoinRoomSkeleton />;
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
    return <JoinRoomSkeleton />;
  }

  return (
    <>
      <SetLocalItem mapKey="playerId" value={playerId} />
      <ResetReduxStates />
      <JoinShell
        form={
          <JoinRoomForm
            joiningAs={
              <JoinRoomProfileCard
                variant="chip"
                playerId={playerId}
                name={displayName}
                profilePic={player.profilePic}
                onNameSaved={setName}
              />
            }
          />
        }
        preview={
          <JoinRoomProfileCard
            variant="card"
            playerId={playerId}
            name={displayName}
            profilePic={player.profilePic}
            onNameSaved={setName}
          />
        }
      />
    </>
  );
}
