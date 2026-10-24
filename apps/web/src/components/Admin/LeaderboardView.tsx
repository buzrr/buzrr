"use client";

import Image from "next/image";
import { useState } from "react";
import { LuTrash2 } from "react-icons/lu";
import { toast } from "react-toastify";
import ConfirmationModal from "@/components/Admin/ConfirmationModal";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useDeleteResultsMutation } from "@/lib/modules/quizzes/hooks";
import { DEFAULT_AVATAR } from "@/constants";
import Skeleton from "@/components/ui/Skeleton";
import { useResultQuery } from "@/lib/modules/game-sessions/hooks";

function rankBadge(rank: number) {
  if (rank === 1) return <span className="text-3xl overflow-hidden">🥇</span>;
  if (rank === 2) return <span className="text-3xl overflow-hidden">🥈</span>;
  if (rank === 3) return <span className="text-3xl overflow-hidden">🥉</span>;
  return <span className="font-bold">#{rank}</span>;
}

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

      <div className="flex flex-col gap-3 my-4 w-full max-w-2xl">
        {result.entries.length > 0 ? (
          result.entries.map((entry) => (
            <div
              key={entry.id}
              className="flex justify-between items-center px-4 py-2 w-full rounded-xl shadow bg-white dark:bg-card-dark text-dark dark:text-white"
            >
              {rankBadge(entry.rank)}
              <div className="flex flex-row items-center gap-x-2 min-w-0">
                <Image
                  src={entry.profilePic || DEFAULT_AVATAR}
                  className="w-12 h-12 rounded-full shrink-0"
                  width={50}
                  height={50}
                  alt="profile pic"
                />
                <p className="truncate">{entry.playerName}</p>
              </div>
              <p className="font-bold">{entry.score}</p>
            </div>
          ))
        ) : (
          <div className="border border-gray border-dashed rounded-lg p-6 text-center text-dark dark:text-white">
            No players in this game.
          </div>
        )}
      </div>
    </div>
  );
}
