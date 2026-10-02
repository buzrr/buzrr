"use client";

import clsx from "clsx";
import Image from "next/image";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { toast } from "react-toastify";
import { DEFAULT_AVATAR } from "@/constants";
import { getApiErrorMessage } from "@/lib/api/errors";
import { updatePlayerNameSchema } from "@/lib/modules/forms/schemas";
import { useUpdatePlayerNameMutation } from "@/lib/modules/players/hooks";
import { labelClass, mutedText } from "@/components/Game/GameUI";
import { MeCard, joinInputClass } from "./JoinShell";

type FormValues = z.infer<typeof updatePlayerNameSchema>;

const cleanName = (value: string) =>
  value.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30);

const editButtonClass =
  "shrink-0 rounded-[10px] border-[1.5px] border-lprimary/15 dark:border-white/10 bg-white dark:bg-dark px-3.5 py-1.5 text-[13px] font-semibold tracking-normal hover:border-dprimary transition-colors cursor-pointer";

/**
 * "Joining as" identity on the room-code step, with inline rename. `card` is
 * the large preview-panel version; `chip` is the compact one shown above the
 * form on small screens.
 */
const JoinRoomProfileCard = (params: {
  playerId: string;
  name: string;
  profilePic: string | null;
  onNameSaved: (name: string) => void;
  variant: "card" | "chip";
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const mutation = useUpdatePlayerNameMutation();
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(updatePlayerNameSchema),
    defaultValues: { username: params.name },
  });

  const startEdit = () => {
    reset({ username: params.name });
    setIsEditing(true);
  };

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(
      { playerId: params.playerId, username: data.username },
      {
        onSuccess: (res) => {
          params.onNameSaved(res.name);
          setIsEditing(false);
          toast.success("Player name updated");
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );
  });

  const editForm = (
    <form className="w-full flex flex-col gap-2" onSubmit={onSubmit}>
      <input
        type="text"
        {...register("username", {
          onChange: (e) => {
            e.target.value = cleanName(e.target.value);
          },
        })}
        placeholder="Enter display name"
        aria-label="Display name"
        className={joinInputClass}
        required
        autoComplete="off"
        autoFocus
        maxLength={30}
      />
      {formState.errors.username?.message && (
        <p className="text-sm text-red-light dark:text-red-dark">
          {formState.errors.username.message}
        </p>
      )}
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="flex-1 rounded-xl bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] px-4 py-2.5 font-bold text-white cursor-pointer disabled:opacity-60"
        >
          {mutation.isPending ? "Saving…" : "Save"}
        </button>
        <button
          type="button"
          className="flex-1 rounded-xl border-[1.5px] border-lprimary/15 dark:border-white/10 px-4 py-2.5 font-semibold cursor-pointer hover:border-dprimary"
          onClick={() => setIsEditing(false)}
        >
          Cancel
        </button>
      </div>
    </form>
  );

  if (params.variant === "chip") {
    return (
      <div className="md:hidden flex flex-col gap-3 rounded-[14px] border px-3 py-2.5 bg-light-bg dark:bg-card-dark border-lprimary/15 dark:border-white/5">
        <div className="flex items-center gap-3">
          <Image
            src={params.profilePic || DEFAULT_AVATAR}
            width={40}
            height={40}
            alt=""
            className="size-10 rounded-full object-cover"
          />
          <span
            className={clsx("flex-1 min-w-0 flex flex-col text-xs", mutedText)}
          >
            Joining as
            <b className="truncate text-[15px] text-dark dark:text-white">
              {params.name}
            </b>
          </span>
          {!isEditing && (
            <button
              type="button"
              className={editButtonClass}
              onClick={startEdit}
            >
              Edit
            </button>
          )}
        </div>
        {isEditing && editForm}
      </div>
    );
  }

  return (
    <>
      <span className={labelClass}>Joining as</span>
      {isEditing ? (
        <div className="w-full max-w-sm flex flex-col items-center gap-4">
          <MeCard image={params.profilePic} name={null} size="md" />
          {editForm}
        </div>
      ) : (
        <MeCard
          image={params.profilePic}
          name={params.name}
          action={
            <button
              type="button"
              className={editButtonClass}
              onClick={startEdit}
            >
              Edit
            </button>
          }
        />
      )}
    </>
  );
};

export default JoinRoomProfileCard;
