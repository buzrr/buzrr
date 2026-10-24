"use client";

import { useState } from "react";
import { LuTrash2 } from "react-icons/lu";
import { toast } from "react-toastify";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useDeleteResultsMutation } from "@/lib/modules/quizzes/hooks";
import Skeleton from "@/components/ui/Skeleton";
import { useResultQuery } from "@/lib/modules/game-sessions/hooks";
import Report from "@/components/Admin/Report/Report";

export default function LeaderboardView({
  roomId,
  onBack,
  backLabel = "Back",
  onDeleted,
}: {
  roomId: string;
  onBack?: () => void;
  backLabel?: string;
  /** Shows a delete button; called once this run is deleted. */
  onDeleted?: () => void;
}) {
  const { data: result, isPending, isError } = useResultQuery(roomId);
  const del = useDeleteResultsMutation(result?.quizId ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const backButton = onBack ? (
    <button
      type="button"
      onClick={onBack}
      className="self-start text-sm text-lprimary dark:text-dprimary font-bold hover:underline hover:cursor-pointer"
    >
      ← {backLabel}
    </button>
  ) : null;

  if (isPending) {
    return (
      <div className="flex flex-col w-full gap-4">
        {backButton}
        <Skeleton className="h-10 w-40 rounded self-center" />
        <div className="flex flex-col gap-4 my-6 w-full max-w-2xl mx-auto">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton
              key={index}
              className="h-16 w-full rounded-xl bg-white dark:bg-card-dark"
            />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !result) {
    return (
      <div className="flex flex-col w-full gap-4">
        {backButton}
        <p className="text-center text-dark dark:text-white py-8">
          Could not load leaderboard.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full gap-4">
      <div className="self-stretch flex items-center justify-between gap-3">
        {backButton ?? <span />}
        {onDeleted && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border-[1.5px] border-red-light dark:border-red-dark px-3 py-1.5 text-sm font-semibold text-red-light dark:text-red-dark hover:bg-red-light hover:text-white dark:hover:bg-red-dark dark:hover:text-dark cursor-pointer transition-colors"
          >
            <LuTrash2 size={15} />
            Delete
          </button>
        )}
      </div>
      <ConfirmationModal
        open={confirmDelete}
        setOpen={setConfirmDelete}
        desc="Delete this game and its leaderboard? This can't be undone."
        confirmLabel="Delete"
        confirming={del.isPending}
        confirmingLabel="Deleting…"
        onClick={() =>
          del.mutate(
            { resultId: roomId },
            {
              onSuccess: () => {
                setConfirmDelete(false);
                toast.success("Game deleted");
                onDeleted?.();
              },
              onError: (err) => toast.error(getApiErrorMessage(err)),
            },
          )
        }
      />
      <p className="text-2xl text-center font-black text-dark dark:text-white capitalize">
        {result.quizTitle} — Leaderboard
      </p>
      <p className="text-sm text-dark dark:text-white">
        Played {new Date(result.endedAt).toLocaleString()} · Room{" "}
        {result.gameCode}
      </p>

      <Report
        title={result.quizTitle}
        entries={result.entries.map((e) => ({
          rank: e.rank,
          name: e.playerName,
          profilePic: e.profilePic,
          score: e.score,
          correctCount: e.correctCount,
        }))}
        questions={result.questions ?? []}
        emptyText="No players in this game."
      />
    </div>
  );
}
