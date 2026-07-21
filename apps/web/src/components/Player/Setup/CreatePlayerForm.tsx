"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect } from "react";
import SubmitButton from "@/components/SubmitButton";
import SelectProfile from "@/components/Player/SelectProfile";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import "react-toastify/dist/ReactToastify.css";
import { getApiErrorMessage } from "@/lib/api/errors";
import { createPlayerSchema } from "@/lib/modules/forms/schemas";
import { useCreatePlayerMutation } from "@/lib/modules/players/hooks";
import { useJoinRoomMutation } from "@/lib/modules/game-sessions/hooks";
import { clearPlayerLocalSession } from "@/lib/player-session";
import { isAxiosError } from "axios";
import { TextInput } from "@/components/ui/TextInput";

type FormValues = z.infer<typeof createPlayerSchema>;

const sanitizeName = (value: string) =>
  value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30);

const CreatePlayerForm = (props: {
  data: {
    name: string;
    image: string;
  };
  setData: (data: { name: string; image: string }) => void;
  /**
   * When set (link/QR join flow), the player is dropped straight into this
   * room after being created — skipping the manual "enter room code" step.
   */
  joinGameCode?: string;
}) => {
  const router = useRouter();
  const mutation = useCreatePlayerMutation();
  const joinMutation = useJoinRoomMutation();
  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(createPlayerSchema),
    defaultValues: {
      username: props.data.name,
      profile: props.data.image,
    },
  });

  useEffect(() => {
    reset({
      username: props.data.name,
      profile: props.data.image,
    });
  }, [props.data.name, props.data.image, reset]);

  const handleNameChange = (value: string) => {
    const trimmed = sanitizeName(value);
    props.setData({
      ...props.data,
      name: trimmed,
    });
  };

  // Link/QR flow: after the player exists, join the room the link points at
  // and go straight to the game — no room-code entry step.
  const autoJoin = (gameCode: string) => {
    joinMutation.mutate(
      { gameCode },
      {
        onSuccess: (joinRes) => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem("playerId", joinRes.playerId);
          }
          router.push(`/player/play/${joinRes.playerId}`);
        },
        onError: (err) => {
          if (isAxiosError(err) && err.response?.status === 401) {
            clearPlayerLocalSession();
            toast.error("Your session expired. Please try again.");
            return;
          }
          if (isAxiosError(err) && err.response?.status === 404) {
            toast.error("This quiz link is invalid or the game has ended.");
            return;
          }
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  };

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(
      {
        username: data.username,
        profile: data.profile,
      },
      {
        onSuccess: (res) => {
          if (typeof window !== "undefined") {
            window.localStorage.setItem("playerToken", res.accessToken);
          }
          if (props.joinGameCode) {
            autoJoin(props.joinGameCode);
            return;
          }
          router.push(`/player/joinRoom/${res.playerId}`);
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  });

  return (
    <form
      className="flex flex-col w-full max-w-xl animate-fade-up"
      onSubmit={onSubmit}
    >
      <h1 className="text-3xl md:text-5xl py-2 font-extrabold dark:text-white">
        Create a custom profile
      </h1>
      <h2 className="md:text-lg py-2 dark:text-white">Join a private quiz</h2>

      <SelectProfile {...props} />

      <Controller
        name="username"
        control={control}
        render={({ field, fieldState }) => (
          <TextInput
            type="text"
            id="displayName"
            name={field.name}
            placeholder="Enter Display Name"
            className="w-full my-2"
            required
            autoComplete="off"
            maxLength={30}
            value={field.value}
            onBlur={field.onBlur}
            ref={field.ref}
            onChange={(e) => {
              handleNameChange(e.target.value);
              field.onChange(sanitizeName(e.target.value));
            }}
            error={fieldState.error?.message}
          />
        )}
      />

      <div className="w-full mt-8">
        <SubmitButton
          style="game"
          text={props.joinGameCode ? "Join Game" : undefined}
          isPending={mutation.isPending || joinMutation.isPending}
        />
      </div>
    </form>
  );
};

export default CreatePlayerForm;
