"use client";

import Link from "next/link";
import NavbarToggle from "@/components/Admin/NavbarToggle";
import Skeleton from "@/components/ui/Skeleton";
import { useHistoryQuery } from "@/lib/modules/game-sessions/hooks";

function HistoryBody() {
  const { data: results, isPending, isError } = useHistoryQuery();

  if (isPending) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-20 w-full rounded-xl bg-white dark:bg-card-dark"
          />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-dark dark:text-white">
        Could not load your game history. Try again later.
      </p>
    );
  }

  if (!results || results.length === 0) {
    return (
      <div className="border border-gray border-dashed rounded-lg p-6 text-center text-dark dark:text-white">
        <p className="text-lg font-black">No games played yet</p>
        <p className="text-sm mt-2">
          Host a quiz and the final results will show up here.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {results.map((result) => (
        <Link
          key={result.id}
          href={`/admin/quiz/leaderboard/${result.id}`}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white dark:bg-card-dark rounded-xl p-4 hover:bg-card-light dark:hover:bg-cardhover-dark transition-colors"
        >
          <div>
            <p className="font-bold text-dark dark:text-white capitalize">
              {result.quizTitle}
            </p>
            <p className="text-xs text-off-dark dark:text-off-white mt-1">
              {new Date(result.endedAt).toLocaleString()} · Room{" "}
              {result.gameCode}
            </p>
          </div>
          <div className="flex gap-4 text-sm text-dark dark:text-white">
            <span>
              {result.playerCount} player
              {result.playerCount === 1 ? "" : "s"}
            </span>
            <span>
              {result.questionCount} question
              {result.questionCount === 1 ? "" : "s"}
            </span>
            {result.mode === "duel" && (
              <span className="font-bold text-lprimary dark:text-dprimary">
                Duel
              </span>
            )}
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function HistoryClient() {
  return (
    <div className="w-full p-4 md:p-6">
      <div className="flex items-center gap-2 mb-4">
        <span className="md:hidden">
          <NavbarToggle />
        </span>
        <h1 className="text-2xl font-black text-dark dark:text-white">
          Game History
        </h1>
      </div>
      <HistoryBody />
    </div>
  );
}
