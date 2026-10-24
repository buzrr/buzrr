"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { LuArrowRight, LuTrash2 } from "react-icons/lu";
import { quizzesApi } from "@/lib/modules/quizzes/api";
import { queryKeys } from "@/lib/modules/query-keys";
import { getApiErrorMessage } from "@/lib/api/errors";
import NavbarToggle from "@/components/Admin/NavbarToggle";
import LeaderboardView from "@/components/Admin/LeaderboardView";
import Skeleton from "@/components/ui/Skeleton";
import { useHistoryQuery } from "@/lib/modules/game-sessions/hooks";

function HistoryBody({
  onShowLeaderboard,
}: {
  onShowLeaderboard: (resultId: string) => void;
}) {
  const { data: results, isPending, isError } = useHistoryQuery();
  const qc = useQueryClient();
  const del = useMutation({
    mutationFn: (resultId: string) => quizzesApi.deleteResults({ resultId }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.gameSessions.history });
      void qc.invalidateQueries({ queryKey: queryKeys.quizzes.all });
    },
    onError: (err) => toast.error(getApiErrorMessage(err)),
  });

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
        <div
          key={result.id}
          className="flex flex-col sm:flex-row sm:items-center gap-2 bg-white dark:bg-card-dark rounded-xl hover:bg-card-light dark:hover:bg-cardhover-dark transition-colors"
        >
          <button
            type="button"
            onClick={() => onShowLeaderboard(result.id)}
            className="flex-1 min-w-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-left p-4 hover:cursor-pointer"
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
                {result.playerCount === 1
                  ? `${result.playerCount} player`
                  : `${result.playerCount} players`}
              </span>
              <span>
                {result.questionCount === 1
                  ? `${result.questionCount} question`
                  : `${result.questionCount} questions`}
              </span>
              {result.mode === "duel" && (
                <span className="font-bold text-lprimary dark:text-dprimary">
                  Duel
                </span>
              )}
            </div>
          </button>
          {result.mode !== "duel" && (
            <div className="flex items-center gap-1 px-3 pb-3 sm:pb-0 sm:pr-4">
              {result.quizId && (
                <Link
                  href={`/admin/quiz/${result.quizId}`}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-lprimary dark:text-dprimary hover:bg-lprimary/10"
                >
                  Go to quiz
                  <LuArrowRight size={15} />
                </Link>
              )}
              <button
                type="button"
                disabled={del.isPending}
                aria-label="Delete this game"
                title="Delete this game"
                onClick={() => {
                  if (window.confirm("Delete this game and its results?")) {
                    del.mutate(result.id);
                  }
                }}
                className="size-9 rounded-[10px] flex items-center justify-center text-off-dark dark:text-muted-dark hover:bg-[#e5544e]/14 hover:text-[#e5544e] cursor-pointer disabled:opacity-50"
              >
                <LuTrash2 size={17} />
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export default function HistoryClient() {
  const [leaderboardId, setLeaderboardId] = useState<string | null>(null);

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
      {leaderboardId ? (
        <LeaderboardView
          roomId={leaderboardId}
          onBack={() => setLeaderboardId(null)}
          backLabel="Back to history"
        />
      ) : (
        <HistoryBody onShowLeaderboard={setLeaderboardId} />
      )}
    </div>
  );
}
