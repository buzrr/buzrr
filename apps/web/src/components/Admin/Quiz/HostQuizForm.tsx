"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { LuPlay } from "react-icons/lu";
import { useAppDispatch } from "@/state/hooks";
import { setPlayers } from "@/state/admin/playersSlice";
import { getApiErrorMessage } from "@/lib/api/errors";
import { hostQuizSchema } from "@/lib/modules/forms/schemas";
import { useCreateGameSessionMutation } from "@/lib/modules/game-sessions/hooks";

type HostQuizValues = z.infer<typeof hostQuizSchema>;

export default function HostQuizForm(props: {
  quizId: string;
  disabled?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const mutation = useCreateGameSessionMutation();
  const { register, handleSubmit, reset } = useForm<HostQuizValues>({
    resolver: zodResolver(hostQuizSchema),
    defaultValues: { quizId: props.quizId },
  });

  React.useEffect(() => {
    reset({ quizId: props.quizId });
  }, [props.quizId, reset]);

  function resetGameState() {
    dispatch(setPlayers([]));
  }

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(
      { quizId: data.quizId },
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
  });

  return (
    <form onSubmit={onSubmit} className={props.className}>
      <input type="hidden" {...register("quizId")} />
      <button
        type="submit"
        disabled={props.disabled || mutation.isPending}
        className="w-full flex items-center justify-center gap-2.5 rounded-[15px] p-4 text-[17px] font-bold text-white bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] shadow-[0_10px_26px_-10px_#8b5cf6] transition-[filter,transform] hover:brightness-107 active:translate-y-px cursor-pointer disabled:cursor-default disabled:bg-none disabled:bg-gray disabled:shadow-none disabled:hover:brightness-100"
      >
        <LuPlay size={18} className="fill-current" />
        {mutation.isPending ? "Loading..." : "Host quiz"}
      </button>
    </form>
  );
}
