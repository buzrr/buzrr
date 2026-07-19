"use client";

import clsx from "clsx";
import Skeleton from "@/components/ui/Skeleton";
import { useRecentDuelsQuery } from "@/lib/modules/duel/hooks";

export default function DuelHistoryList({ limit }: { limit?: number }) {
  const { data: duels, isPending, isError } = useRecentDuelsQuery(limit);

  if (isPending) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-16 w-full rounded-xl bg-white dark:bg-card-dark"
          />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <p className="text-dark dark:text-white">
        Could not load your duels. Try again later.
      </p>
    );
  }
  if (!duels || duels.length === 0) {
    return (
      <div className="border border-gray border-dashed rounded-lg p-6 text-center text-dark dark:text-white">
        <p className="text-lg font-black">No duels played yet</p>
        <p className="text-sm mt-2">
          Play a duel and your results will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {duels.map((entry) => {
        const eloDelta =
          entry.eloAfter !== null && entry.eloBefore !== null
            ? entry.eloAfter - entry.eloBefore
            : null;
        return (
          <div
            key={entry.id}
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-card-dark rounded-xl p-4"
          >
            <div>
              <p className="font-bold text-dark dark:text-white capitalize">
                {entry.result.quizTitle}
              </p>
              <p
                className="text-xs text-off-dark dark:text-off-white mt-1"
                suppressHydrationWarning
              >
                {new Date(entry.result.endedAt).toLocaleString()}
              </p>
            </div>
            <div className="flex gap-4 text-sm text-dark dark:text-white items-center">
              <span
                className={clsx(
                  "font-bold",
                  entry.rank === 1 && "text-lprimary dark:text-dprimary",
                )}
              >
                #{entry.rank}
              </span>
              <span>{entry.score} pts</span>
              {eloDelta !== null && (
                <span
                  className={clsx(
                    "font-bold",
                    eloDelta >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-light dark:text-red-dark",
                  )}
                >
                  {eloDelta >= 0 ? "+" : ""}
                  {eloDelta} elo
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
