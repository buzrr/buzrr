"use client";

import { DEFAULT_AVATAR } from "@/constants";
import Skeleton from "@/components/ui/Skeleton";
import { useResultQuery } from "@/lib/modules/game-sessions/hooks";
import Image from "next/image";

export default function QuizLeaderboardClient({ roomId }: { roomId: string }) {
  const { data: result, isPending, isError } = useResultQuery(roomId);

  if (isPending) {
    return (
      <div className="flex flex-col items-center m-auto w-full px-4 my-8 gap-4">
        <Skeleton className="h-10 w-40 rounded" />
        <div className="flex flex-col gap-4 my-6 w-full max-w-4xl">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-16 w-full rounded bg-white dark:bg-card-dark"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !result) {
    return (
      <p className="text-center text-dark dark:text-white py-8">
        Could not load leaderboard.
      </p>
    );
  }

  return (
    <>
      <div className="flex flex-col items-center m-auto w-full px-4 my-8 gap-4 overflow-x-visible">
        <p className="w-full py-2 px-3 text-2xl text-center bg-white text-slate-900 font-semibold rounded max-w-fit capitalize overflow-x-visible">
          {result.quizTitle} — Leaderboard
        </p>
        <p className="text-sm text-dark dark:text-white">
          Played {new Date(result.endedAt).toLocaleString()} · Room{" "}
          {result.gameCode}
        </p>

        <div className="flex flex-col gap-4 my-6 overflow-x-visible">
          {result.entries.length > 0
            ? result.entries.map((entry) => {
                return (
                  <div
                    key={entry.id}
                    className="shadow-xl flex justify-between px-4 py-2 flex-row w-[60vw] items-center z-10 bg-white text-black"
                  >
                    {entry.rank == 1 ? (
                      <span className="text-3xl overflow-hidden">🥇</span>
                    ) : entry.rank == 2 ? (
                      <span className="text-3xl overflow-hidden">🥈</span>
                    ) : entry.rank == 3 ? (
                      <span className="text-3xl overflow-hidden">🥉</span>
                    ) : (
                      `#${entry.rank}`
                    )}
                    <div className="flex flex-row items-center gap-x-2 z-20">
                      <Image
                        src={entry.profilePic || DEFAULT_AVATAR}
                        className="w-12 h-12 rounded-full"
                        width={50}
                        height={50}
                        alt="profile pic"
                      />
                      <p>{entry.playerName}</p>
                    </div>
                    <p>{entry.score}</p>
                  </div>
                );
              })
            : null}
        </div>
      </div>
    </>
  );
}
