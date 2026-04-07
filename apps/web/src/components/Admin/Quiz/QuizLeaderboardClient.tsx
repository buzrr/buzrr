"use client";

import { DEFAULT_AVATAR } from "@/constants";
import Skeleton from "@/components/ui/Skeleton";
import { useLeaderboardByRoomQuery } from "@/lib/modules/game-sessions/hooks";
import Image from "next/image";

export default function QuizLeaderboardClient({ roomId }: { roomId: string }) {
  const { data: leaderboard, isPending, isError } =
    useLeaderboardByRoomQuery(roomId);

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

  if (isError) {
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
          Leaderboard
        </p>

        <div className="flex flex-col gap-4 my-6 overflow-x-visible">
          {leaderboard && leaderboard.length > 0
            ? leaderboard.map((lead, index) => {
                return (
                  <div
                    key={lead.id}
                    className="shadow-xl flex justify-between px-4 py-2 flex-row w-[60vw] items-center z-10 bg-white text-black"
                  >
                    {index == 0 ? (
                      <span className="text-3xl overflow-hidden">🥇</span>
                    ) : index == 1 ? (
                      <span className="text-3xl overflow-hidden">🥈</span>
                    ) : index == 2 ? (
                      <span className="text-3xl overflow-hidden">🥉</span>
                    ) : (
                      `#${index + 1}`
                    )}
                    <div className="flex flex-row items-center gap-x-2 z-20">
                      <Image
                        src={lead.Player.profilePic || DEFAULT_AVATAR}
                        className="w-12 h-12 rounded-full"
                        width={50}
                        height={50}
                        alt="profile pic"
                      />
                      <p>{lead.Player.name}</p>
                    </div>
                    <p>{lead.score}</p>
                  </div>
                );
              })
            : null}
        </div>
      </div>
    </>
  );
}
