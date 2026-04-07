"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import SubmitButton from "@/components/SubmitButton";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import "react-toastify/dist/ReactToastify.css";
import { getApiErrorMessage } from "@/lib/api/errors";
import { joinRoomSchema } from "@/lib/modules/forms/schemas";
import { useJoinRoomMutation } from "@/lib/modules/game-sessions/hooks";
import { clearPlayerLocalSession } from "@/lib/player-session";
import { isAxiosError } from "axios";
import { TextInput } from "@/components/ui/TextInput";

type FormValues = z.infer<typeof joinRoomSchema>;

const JoinRoomForm = () => {
  const router = useRouter();
  const mutation = useJoinRoomMutation();
  const { register, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(joinRoomSchema),
    defaultValues: { gameCode: "" },
  });

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(
      {
        gameCode: data.gameCode.replace(/\s/g, "").toUpperCase(),
      },
      {
        onSuccess: (res) => {
          router.push(`/player/play/${res.playerId}`);
        },
        onError: (err) => {
          if (isAxiosError(err) && err.response?.status === 401) {
            clearPlayerLocalSession();
            toast.error("Your session expired. Create your player again.");
            router.replace("/player");
            return;
          }
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  });

  return (
    <form
      className="flex flex-col justify-center px-2 py-4 m-4 w-[85%] md:w-[55vw]"
      onSubmit={onSubmit}
    >
      <h1 className="text-3xl md:text-5xl py-2 font-extrabold dark:text-white">
        Enter room code
      </h1>
      <p className="text-md md:text-lg py-2 dark:text-white">
        Enter room code provided by the admin
      </p>
      <label htmlFor="gameCode" className="sr-only">
        Room Code
      </label>
      <TextInput
        id="gameCode"
        type="text"
        {...register("gameCode")}
        placeholder="Enter Code"
        className="md:w-4/5 uppercase tracking-widest font-mono my-12"
        autoComplete="off"
        required
        onInput={(e: React.FormEvent<HTMLInputElement>) => {
          const input = e.currentTarget;
          input.value = input.value.replace(/\s/g, "").toUpperCase();
        }}
      />
      <div className="w-full md:w-[40%] mt-10">
        <SubmitButton text="Join" isPending={mutation.isPending} />
      </div>
    </form>
  );
};

export default JoinRoomForm;
