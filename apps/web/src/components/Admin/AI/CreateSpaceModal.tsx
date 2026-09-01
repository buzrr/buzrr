"use client";

import { Box, Modal } from "@mui/material";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";
import type { z } from "zod";
import { InputField } from "@/components/InputField";
import ModalCloseButton from "@/components/ModalCloseButton";
import SubmitButton from "@/components/SubmitButton";
import { getApiErrorMessage } from "@/lib/api/errors";
import { createSpaceSchema } from "@/lib/modules/forms/schemas";
import { useCreateSpaceMutation } from "@/lib/modules/ai/hooks";
import style from "@/utils/modalStyle";

type FormValues = z.infer<typeof createSpaceSchema>;

export default function CreateSpaceModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const mutation = useCreateSpaceMutation();
  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(createSpaceSchema) as Resolver<FormValues>,
    defaultValues: { name: "", description: "" },
  });

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(
      { name: data.name, description: data.description || undefined },
      {
        onSuccess: (space) => {
          reset();
          onClose();
          router.push(`/admin/ai/${space.id}`);
        },
        onError: (error) => toast.error(getApiErrorMessage(error)),
      },
    );
  });

  return (
    <Modal open={open} onClose={onClose} aria-labelledby="create-space-title">
      <Box
        sx={style}
        className="bg-light-bg dark:bg-[#27272A] rounded-xl w-4/5 md:w-1/2 max-w-[600px]"
      >
        <ModalCloseButton onClose={onClose} />
        <div className="p-6">
          <p
            id="create-space-title"
            className="text-xl font-bold mb-2 text-dark dark:text-white"
          >
            New knowledge space
          </p>
          <p className="text-[#4E4E56] dark:text-off-white mb-4">
            A space holds one subject&apos;s documents. Upload your material,
            then ask for questions from any part of it.
          </p>
          <form onSubmit={onSubmit}>
            <Controller
              name="name"
              control={control}
              render={({ field, fieldState }) => (
                <InputField
                  type="text"
                  name="name"
                  placeholder="Example: “Thermodynamics — CHEM 101”"
                  className="text-dark dark:text-white dark:bg-dark my-2 rounded-xl mt-1 border"
                  required
                  autoComplete="off"
                  label="Name this space"
                  fieldValue={field.value ?? ""}
                  onTitleChange={field.onChange}
                  error={!!fieldState.error}
                  errorMessage={fieldState.error?.message}
                />
              )}
            />
            <Controller
              name="description"
              control={control}
              render={({ field, fieldState }) => (
                <InputField
                  type="text"
                  name="description"
                  placeholder="Example: lecture notes and the course textbook"
                  className="text-dark dark:text-white dark:bg-dark mt-1 border rounded-xl"
                  autoComplete="off"
                  textarea
                  label="What's in it? (optional)"
                  fieldValue={field.value ?? ""}
                  onTitleChange={field.onChange}
                  error={!!fieldState.error}
                  errorMessage={fieldState.error?.message}
                />
              )}
            />
            <SubmitButton
              text="Create space"
              loader="Creating..."
              isPending={mutation.isPending}
            />
          </form>
        </div>
      </Box>
    </Modal>
  );
}

export function useCreateSpaceModal() {
  const [open, setOpen] = useState(false);
  return { open, setOpen };
}
