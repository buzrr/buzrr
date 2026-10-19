"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect, type ReactNode } from "react";
import clsx from "clsx";
import SelectProfile from "@/components/Player/SelectProfile";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import "react-toastify/dist/ReactToastify.css";
import { getApiErrorMessage } from "@/lib/api/errors";
import { createPlayerSchema } from "@/lib/modules/forms/schemas";
import { useCreatePlayerMutation } from "@/lib/modules/players/hooks";
import { useJoinRoomMutation } from "@/lib/modules/game-sessions/hooks";
import { clearPlayerLocalSession } from "@/lib/player-session";
import { loadPlayerProfile, savePlayerProfile } from "@/lib/player-prefs";
import { isAxiosError } from "axios";
import { mutedText, primaryButtonClass } from "@/components/Game/GameUI";
import { useT } from "@/lib/i18n/context";
import {
  BackSquare,
  Steps,
  joinCounterClass,
  joinInputClass,
  joinLabelClass,
} from "@/components/Player/Setup/JoinShell";

type FormValues = z.infer<typeof createPlayerSchema>;

const NAME_MAX = 30;

const sanitizeName = (value: string) =>
  value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, NAME_MAX);

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
  /** Called with the new player instead of going to the room-code step. */
  onCreated?: (playerId: string) => void;
  /** Replaces "Joining a private quiz" under the heading. */
  subtitle?: ReactNode;
}) => {
  const t = useT();
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

  // Start from the name and avatar used last time (if the form is still empty).
  useEffect(() => {
    const saved = loadPlayerProfile();
    if (saved && !props.data.name) {
      props.setData({ name: sanitizeName(saved.name), image: saved.image });
    }
    // Once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            toast.error(t("Your session expired. Please try again."));
            return;
          }
          if (isAxiosError(err) && err.response?.status === 404) {
            toast.error(t("This quiz link is invalid or the game has ended."));
            return;
          }
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  };

  const pending = mutation.isPending || joinMutation.isPending;

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
          savePlayerProfile({ name: data.username, image: data.profile });
          if (props.joinGameCode) {
            autoJoin(props.joinGameCode);
            return;
          }
          if (props.onCreated) {
            window.localStorage.setItem("playerId", res.playerId);
            props.onCreated(res.playerId);
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
      className="flex flex-col gap-5 md:gap-6 animate-fade-up"
      onSubmit={onSubmit}
    >
      <div className="flex items-center justify-between">
        <BackSquare href="/" />
        {!props.joinGameCode && !props.onCreated && <Steps step={1} />}
      </div>
      <div>
        <h1 className="text-[32px] md:text-[44px] font-extrabold tracking-[-0.03em] leading-[1.06]">
          {t("Create a custom profile")}
        </h1>
        <p className={clsx("mt-2.5 text-base", mutedText)}>
          {props.subtitle ? (
            props.subtitle
          ) : props.joinGameCode ? (
            <>
              {t("Joining room")}{" "}
              <b className="font-bold tracking-[0.1em] text-lprimary dark:text-dprimary">
                {props.joinGameCode}
              </b>
            </>
          ) : (
            <>
              {t("Joining a")}{" "}
              <b className="font-semibold text-dark dark:text-white">
                {t("private quiz")}
              </b>
            </>
          )}
        </p>
      </div>

      <SelectProfile {...props} />

      <Controller
        name="username"
        control={control}
        render={({ field, fieldState }) => (
          <label className="block">
            <span className={joinLabelClass}>
              {t("Display name")}
              <span className={joinCounterClass}>
                {field.value.length}/{NAME_MAX}
              </span>
            </span>
            <input
              type="text"
              id="displayName"
              name={field.name}
              placeholder={t("Enter display name")}
              className={clsx(joinInputClass, "mt-2")}
              required
              autoComplete="off"
              maxLength={NAME_MAX}
              value={field.value}
              onBlur={field.onBlur}
              ref={field.ref}
              aria-invalid={!!fieldState.error}
              onChange={(e) => {
                handleNameChange(e.target.value);
                field.onChange(sanitizeName(e.target.value));
              }}
            />
            {fieldState.error?.message ? (
              <span className="mt-1.5 block text-sm text-red-light dark:text-red-dark">
                {fieldState.error.message}
              </span>
            ) : (
              <span className={clsx("mt-1.5 block", joinCounterClass)}>
                {t("Letters, numbers and underscores only.")}
              </span>
            )}
          </label>
        )}
      />

      <button
        type="submit"
        disabled={!props.data.name.trim() || pending}
        className={clsx(primaryButtonClass, "w-full py-4 text-[17px]")}
      >
        {pending ? "Loading..." : props.joinGameCode ? t("Join game") : "Next"}
      </button>
    </form>
  );
};

export default CreatePlayerForm;
