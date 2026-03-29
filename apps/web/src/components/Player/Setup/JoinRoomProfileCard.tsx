"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useState } from "react";
import { toast } from "react-toastify";
import ClientImage from "@/components/ClientImage";
import { DEFAULT_AVATAR } from "@/constants";
import { getApiErrorMessage } from "@/lib/api/errors";
import { updatePlayerNameSchema } from "@/lib/modules/forms/schemas";
import { useUpdatePlayerNameMutation } from "@/lib/modules/players/hooks";

type FormValues = z.infer<typeof updatePlayerNameSchema>;

const JoinRoomProfileCard = (params: {
  playerId: string;
  initialPlayerName: string;
  profilePic: string | null;
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [savedPlayerName, setSavedPlayerName] = useState(params.initialPlayerName);
  const mutation = useUpdatePlayerNameMutation();
  const { register, handleSubmit, reset, formState } = useForm<FormValues>({
    resolver: zodResolver(updatePlayerNameSchema),
    defaultValues: { username: params.initialPlayerName },
  });

  const handleNameChange = (value: string) => {
    const cleaned = value.replace(/[^a-zA-Z0-9_]/g, "");
    return cleaned.slice(0, 30);
  };

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(
      {
        playerId: params.playerId,
        username: data.username,
      },
      {
        onSuccess: (res) => {
          setSavedPlayerName(res.name);
          setIsEditingName(false);
          toast.success("Player name updated");
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  });

  return (
    <div className="w-[40vw] hidden md:flex md:flex-col items-center justify-center gap-4">
      <ClientImage
        props={{
          src: params.profilePic || DEFAULT_AVATAR,
          alt: "player avatar",
          width: 200,
          height: 200,
          classname: "rounded-full",
        }}
      />
      {!isEditingName ? (
        <div className="flex items-center gap-3">
          <p className="text-2xl font-bold dark:text-white">{savedPlayerName}</p>
          <button
            type="button"
            className="px-3 py-1 rounded-lg border border-gray dark:text-white font-bold text-sm cursor-pointer"
            onClick={() => {
              reset({ username: savedPlayerName });
              setIsEditingName(true);
            }}
          >
            Edit
          </button>
        </div>
      ) : (
        <form
          className="w-full flex flex-col items-center gap-2"
          onSubmit={onSubmit}
        >
          <input
            type="text"
            {...register("username", {
              onChange: (e) => {
                e.target.value = handleNameChange(e.target.value);
              },
            })}
            placeholder="Enter Display Name"
            className="w-[70%] border-gray dark:bg-dark-bg dark:text-white border focus:border-blue-600 rounded-lg outline-none text-slate-900 px-4 py-3"
            required
            autoComplete="off"
            maxLength={30}
          />
          {formState.errors.username?.message && (
            <p className="text-sm text-red-500">
              {formState.errors.username.message}
            </p>
          )}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-4 py-2 rounded-lg bg-lprimary dark:bg-dprimary text-white dark:text-dark font-bold cursor-pointer disabled:opacity-60"
            >
              Save
            </button>
            <button
              type="button"
              className="px-4 py-2 rounded-lg border border-gray dark:text-white font-bold cursor-pointer"
              onClick={() => {
                reset({ username: savedPlayerName });
                setIsEditingName(false);
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default JoinRoomProfileCard;
