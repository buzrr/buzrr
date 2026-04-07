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
}) => {
  const router = useRouter();
  const mutation = useCreatePlayerMutation();
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
          router.push(`/player/joinRoom/${res.playerId}`);
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  });

  return (
    <form className="flex flex-col" onSubmit={onSubmit}>
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
            className="md:w-4/5 my-2"
            required
            autoComplete="off"
            maxLength={30}
            value={field.value}
            onChange={(e) => {
              handleNameChange(e.target.value);
              field.onChange(sanitizeName(e.target.value));
            }}
            error={fieldState.error?.message}
          />
        )}
      />

      <div className="w-full md:w-[40%] mt-10">
        <SubmitButton style="game" isPending={mutation.isPending} />
      </div>
    </form>
  );
};

export default CreatePlayerForm;
