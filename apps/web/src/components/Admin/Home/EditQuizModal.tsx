"use client";

import { useEffect } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Box, Modal } from "@mui/material";
import { toast } from "react-toastify";
import style from "@/utils/modalStyle";
import ModalCloseButton from "@/components/ModalCloseButton";
import SubmitButton from "@/components/SubmitButton";
import { InputField } from "@/components/InputField";
import { getApiErrorMessage } from "@/lib/api/errors";
import { createQuizSchema } from "@/lib/modules/forms/schemas";
import { useUpdateQuizMutation } from "@/lib/modules/quizzes/hooks";
import { useT } from "@/lib/i18n/context";
import type { QuizListItem } from "@/lib/modules/quizzes/api";

type FormValues = z.infer<typeof createQuizSchema>;

export default function EditQuizModal({
  quiz,
  open,
  setOpen,
}: {
  quiz: QuizListItem | null;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const t = useT();
  const mutation = useUpdateQuizMutation();
  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(createQuizSchema),
    defaultValues: { title: "", description: "" },
  });

  useEffect(() => {
    if (open && quiz) {
      reset({ title: quiz.title, description: quiz.description ?? "" });
    }
  }, [open, quiz, reset]);

  const onSubmit = handleSubmit((data) => {
    if (!quiz) return;
    const title = data.title.trim();
    mutation.mutate(
      {
        quizId: quiz.id,
        title,
        description: data.description?.trim(),
      },
      {
        onSuccess: () => {
          toast.success(t("Quiz updated"));
          setOpen(false);
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );
  });

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!mutation.isPending) setOpen(false);
      }}
      aria-labelledby="edit-quiz-title"
    >
      <Box
        sx={style}
        className="bg-light-bg dark:bg-card-dark rounded-xl w-4/5 md:w-1/2 max-w-[600px]"
      >
        <ModalCloseButton
          onClose={() => {
            if (!mutation.isPending) setOpen(false);
          }}
        />
        <div className="p-6">
          <p
            id="edit-quiz-title"
            className="text-xl font-bold mb-2 text-dark dark:text-white"
          >
            {t("Edit quiz")}
          </p>
          <form onSubmit={onSubmit} className="flex flex-col">
            <Controller
              name="title"
              control={control}
              render={({ field, fieldState }) => (
                <InputField
                  type="text"
                  name="title"
                  placeholder={t("Enter quiz title")}
                  className="text-dark dark:text-white dark:bg-dark my-2 rounded-xl mt-1 border"
                  required
                  autoComplete="off"
                  label={t("Quiz title")}
                  fieldValue={field.value}
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
                  placeholder={t("Description")}
                  autoComplete="off"
                  className="text-dark dark:text-white dark:bg-dark mt-1 border rounded-xl"
                  textarea={true}
                  label={t("Description (Optional)")}
                  fieldValue={field.value ?? ""}
                  onTitleChange={field.onChange}
                  error={!!fieldState.error}
                  errorMessage={fieldState.error?.message}
                />
              )}
            />
            <SubmitButton
              text={t("Save changes")}
              loader="Saving..."
              isPending={mutation.isPending}
            />
          </form>
        </div>
      </Box>
    </Modal>
  );
}
