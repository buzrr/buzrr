"use client";

import React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import SubmitButton from "@/components/SubmitButton";
import { useAppDispatch } from "@/state/hooks";
import {
  setCurrIndex,
  setLeaderboard,
  setPlayers,
  setResult,
} from "@/state/admin/playersSlice";
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
    dispatch(setLeaderboard([]));
    dispatch(setResult([]));
    dispatch(setCurrIndex(0));
  }

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(
      { quizId: data.quizId },
      {
        onSuccess: (res) => {
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
      <SubmitButton
        text="Host quiz"
        error={props.disabled}
        isPending={mutation.isPending}
        onClick={resetGameState}
      />
    </form>
  );
}
