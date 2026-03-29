"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { useEffect } from "react";
import SubmitButton from "@/components/SubmitButton";
import SelectProfile from "@/components/Player/selectProfile";
import { toast } from "react-toastify";
import { useRouter } from "next/navigation";
import "react-toastify/dist/ReactToastify.css";
import { getApiErrorMessage } from "@/lib/api/errors";
import { createPlayerSchema } from "@/lib/modules/forms/schemas";
import { useCreatePlayerMutation } from "@/lib/modules/players/hooks";

type FormValues = z.infer<typeof createPlayerSchema>;

const CreatePlayerForm = (props: {
  data: {
    name: string;
    image: string;
  };
  setData: (data: { name: string; image: string }) => void;
}) => {
  const router = useRouter();
  const mutation = useCreatePlayerMutation();
  const { control, handleSubmit, reset, formState } = useForm<FormValues>({
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
    const cleaned = value.replace(/[^a-zA-Z0-9_]/g, "");
    const trimmed = cleaned.slice(0, 30);
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
          <input
            type="text"
            placeholder="Enter Display Name"
            className="w-full border-gray border focus:border-blue-600 rounded-lg outline-none md:w-4/5 text-dark dark:text-gray dark:bg-dark-bg my-2 px-4 py-3"
            required
            autoComplete="off"
            maxLength={30}
            value={field.value}
            onChange={(e) => {
              handleNameChange(e.target.value);
              const cleaned = e.target.value
                .replace(/[^a-zA-Z0-9_]/g, "")
                .slice(0, 30);
              field.onChange(cleaned);
            }}
            aria-invalid={!!fieldState.error}
          />
        )}
      />
      {formState.errors.username?.message && (
        <p className="text-sm text-red-500">
          {formState.errors.username.message}
        </p>
      )}

      <div className="w-full md:w-[40%] mt-10">
        <SubmitButton style="game" isPending={mutation.isPending} />
      </div>
    </form>
  );
};

export default CreatePlayerForm;
