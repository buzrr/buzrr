"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Box, Modal } from "@mui/material";
import { toast } from "react-toastify";
import style from "@/utils/modalStyle";
import ModalCloseButton from "@/components/ModalCloseButton";
import SubmitButton from "@/components/SubmitButton";
import { InputField } from "@/components/InputField";
import { DESCRIPTION_MAX, TITLE_MAX } from "./CreateBuzrrForm";
import { getApiErrorMessage } from "@/lib/api/errors";
import { createQuizSchema } from "@/lib/modules/forms/schemas";
import { useUpdateQuizMutation } from "@/lib/modules/quizzes/hooks";
import type { Quiz } from "@/types/db";

type FormValues = z.infer<typeof createQuizSchema>;

/** The fields the modal edits — satisfied by both list items and quiz details. */
type EditableQuiz = Pick<Quiz, "id" | "title" | "description">;

/**
 * Edit a quiz's title and description. The form mounts only while the modal
 * is open and takes its starting values once, so a background refetch of the
 * quiz (window focus, the public toggle) never resets what is being typed.
 */
export default function EditQuizModal({
  quiz,
  open,
  setOpen,
}: {
  quiz: EditableQuiz | null;
  open: boolean;
  setOpen: (open: boolean) => void;
}) {
  const mutation = useUpdateQuizMutation();
  const close = () => {
    if (!mutation.isPending) setOpen(false);
  };

  return (
    <Modal open={open} onClose={close} aria-labelledby="edit-quiz-title">
      <Box
        sx={style}
        className="bg-light-bg dark:bg-card-dark rounded-xl w-4/5 md:w-1/2 max-w-[600px]"
      >
        <ModalCloseButton onClose={close} />
        <div className="p-6">
          <p
            id="edit-quiz-title"
            className="text-xl font-bold mb-2 text-dark dark:text-white"
          >
            Edit quiz
          </p>
          {quiz && (
            <EditQuizForm
              quiz={quiz}
              mutation={mutation}
              onSaved={() => setOpen(false)}
            />
          )}
        </div>
      </Box>
    </Modal>
  );
}

function EditQuizForm({
  quiz,
  mutation,
  onSaved,
}: {
  quiz: EditableQuiz;
  mutation: ReturnType<typeof useUpdateQuizMutation>;
  onSaved: () => void;
}) {
  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(createQuizSchema),
    defaultValues: { title: quiz.title, description: quiz.description ?? "" },
  });

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(
      {
        quizId: quiz.id,
        title: data.title.trim(),
        description: data.description?.trim(),
      },
      {
        onSuccess: () => {
          toast.success("Quiz updated");
          onSaved();
        },
        onError: (err) => toast.error(getApiErrorMessage(err)),
      },
    );
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col">
      <Controller
        name="title"
        control={control}
        render={({ field, fieldState }) => (
          <InputField
            type="text"
            name="title"
            placeholder="Enter quiz title"
            className="text-dark dark:text-white dark:bg-dark my-2 rounded-xl mt-1 border"
            required
            autoComplete="off"
            label={`Quiz title (${field.value.length}/${TITLE_MAX})`}
            maxLength={TITLE_MAX}
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
            placeholder="Description"
            autoComplete="off"
            className="text-dark dark:text-white dark:bg-dark mt-1 border rounded-xl"
            textarea={true}
            label={`Description (Optional) (${(field.value ?? "").length}/${DESCRIPTION_MAX})`}
            maxLength={DESCRIPTION_MAX}
            fieldValue={field.value ?? ""}
            onTitleChange={field.onChange}
            error={!!fieldState.error}
            errorMessage={fieldState.error?.message}
          />
        )}
      />
      <SubmitButton
        text="Save changes"
        loader="Saving..."
        isPending={mutation.isPending}
      />
    </form>
  );
}
