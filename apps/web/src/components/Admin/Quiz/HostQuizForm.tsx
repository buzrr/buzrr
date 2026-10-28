"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { LuPlay } from "react-icons/lu";
import type { GameSettings } from "@buzrr/contract";
import { useAppDispatch } from "@/state/hooks";
import { setPlayers } from "@/state/admin/playersSlice";
import { getApiErrorMessage } from "@/lib/api/errors";
import { useCreateGameSessionMutation } from "@/lib/modules/game-sessions/hooks";
import HostSettingsModal from "./HostSettingsModal";

/** "Host quiz": pick the session's settings, then open its lobby. */
export default function HostQuizForm(props: {
  quizId: string;
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const mutation = useCreateGameSessionMutation();
  const [open, setOpen] = React.useState(false);

  function resetGameState() {
    dispatch(setPlayers([]));
  }

  const start = (settings: GameSettings) => {
    mutation.mutate(
      { quizId: props.quizId, ...settings },
      {
        onSuccess: (res) => {
          resetGameState();
          router.push(`/admin/play/${res.id}`);
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  };

  return (
    <div className={props.className}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={props.disabled || mutation.isPending}
        className="w-full flex items-center justify-center gap-2.5 rounded-[15px] p-4 text-[17px] font-bold text-white bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] dark:from-accent dark:to-accent-deep shadow-[0_10px_26px_-10px_#8b5cf6] transition-[filter,transform] hover:brightness-107 active:translate-y-px cursor-pointer disabled:cursor-default disabled:bg-none disabled:bg-gray disabled:shadow-none disabled:hover:brightness-100"
      >
        <LuPlay size={18} className="fill-current" />
        {mutation.isPending ? "Loading..." : "Host quiz"}
      </button>
      <HostSettingsModal
        open={open}
        onClose={() => setOpen(false)}
        onStart={start}
        // Stays pending through the navigation to the lobby.
        pending={mutation.isPending || mutation.isSuccess}
      />
    </div>
  );
}
