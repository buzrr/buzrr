"use client";

import clsx from "clsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { InputField } from "@/components/InputField";
import SubmitButton from "@/components/SubmitButton";
import { Box, Modal } from "@mui/material";
import Image from "next/image";
import { useState } from "react";
import style from "@/utils/modalStyle";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useSelector } from "react-redux";
import { RootState } from "@/state/store";
import { useRouter } from "next/navigation";
import { getApiErrorMessage } from "@/lib/api/errors";
import { createAiQuizSchema } from "@/lib/modules/forms/schemas";
import { useCreateAiQuizMutation } from "@/lib/modules/quizzes/hooks";

type FormValues = z.infer<typeof createAiQuizSchema>;

export default function CreateAIQuiz() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const view = useSelector((state: RootState) => state.gridListToggle.view);
  const mutation = useCreateAiQuizMutation();
  const { control, handleSubmit, reset } = useForm<FormValues>({
    resolver: zodResolver(createAiQuizSchema) as Resolver<FormValues>,
    defaultValues: {
      title: "",
      description: "",
      questions: undefined,
      time: undefined,
    },
  });

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(
      {
        title: data.title,
        description: data.description,
        questions: data.questions,
        time: data.time,
      },
      {
        onSuccess: (res) => {
          setOpen(false);
          reset();
          router.push(`/admin/quiz/${res.quizId}`);
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  });

  return (
    <>
      <div
        className={clsx(
          "p-2 border-2 border-[#c2b4fe] dark:border-transparent w-full text-dark dark:text-white rounded flex justify-center items-center bg-linear-to-b from-[#8D6DDD] to-[#AD56D6] cursor-pointer hover:border-transparent hover:from-[#8D6DDD] hover:to-[#AD56D6] transition-all duration-300 ease-in-out",
          view === "list" ? "md:w-full flex-row gap-x-3 md:gap-x-1 py-4 px-2" : "p-2 flex-col md:w-40 h-[50vh] md:h-44"
        )}
        onClick={() => setOpen(true)}
      >
        <div className="h-full w-full flex gap-x-4 justify-center items-center">
          <Image
            src="/images/AIQuiz.svg"
            alt="AI Quiz"
            width={45}
            height={45}
            className={clsx(view === "grid" ? "w-11 h-11" : "w-6 h-6")}
          />
          {view === "list" && (
            <div className="text-base font-bold w-full text-white">
              Create a quiz with AI
            </div>
          )}
        </div>
        {view === "grid" && (
          <div className="text-xs font-bold w-full text-white">
            Create a quiz with AI
          </div>
        )}
        <div
          className={clsx(view === "grid" ? "text-xs" : "text-base", "w-full text-white")}
        >
          Let&apos;s get your quiz ready
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={style} className="dark:bg-[#27272A] rounded-xl w-4/5 md:w-1/2">
          <div className="p-6">
            <p className="text-xl font-bold mb-2 text-dark dark:text-white">
              Hey there! I&apos;m your AI quiz buddy.
            </p>
            <p className="text-[#4E4E56] dark:text-off-white mb-4">
              Ready to get started? Just jot down your requirements below to
              begin the quiz!
            </p>
            <form onSubmit={onSubmit}>
              <Controller
                name="title"
                control={control}
                render={({ field, fieldState }) => (
                  <InputField
                    type="text"
                    name="title"
                    placeholder="Example: “My 20th Bday Quiz”"
                    className="text-dark dark:text-white dark:bg-dark my-2 rounded-xl mt-1 border"
                    required
                    autoComplete="off"
                    label="Name your quiz"
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
                    placeholder="Example: quiz on gravitational forces."
                    autoComplete="off"
                    required
                    className="text-dark dark:text-white dark:bg-dark mt-1 border rounded-xl "
                    textarea={true}
                    label="Quiz questions description"
                    fieldValue={field.value ?? ""}
                    onTitleChange={field.onChange}
                    error={!!fieldState.error}
                    errorMessage={fieldState.error?.message}
                  />
                )}
              />

              <div className="grid grid-cols-2 gap-x-3">
                <Controller
                  name="questions"
                  control={control}
                  render={({ field, fieldState }) => (
                    <InputField
                      type="number"
                      name="questions"
                      maxNum={15}
                      placeholder="Example: 15"
                      className="text-dark dark:text-white dark:bg-dark my-2 rounded-xl mt-1 border"
                      required
                      autoComplete="off"
                      label="Write number of quiz questions.(max 15)"
                      fieldValue={field.value?.toString() ?? ""}
                      onTitleChange={(v) => field.onChange(v === "" ? "" : Number(v))}
                      error={!!fieldState.error}
                      errorMessage={fieldState.error?.message}
                    />
                  )}
                />
                <Controller
                  name="time"
                  control={control}
                  render={({ field, fieldState }) => (
                    <InputField
                      type="number"
                      name="time"
                      placeholder="Example: 15"
                      className="text-dark dark:text-white dark:bg-dark my-2 rounded-xl mt-1 border"
                      required
                      autoComplete="off"
                      label="Write down default question time (in seconds)"
                      fieldValue={field.value?.toString() ?? ""}
                      onTitleChange={(v) => field.onChange(v === "" ? "" : Number(v))}
                      error={!!fieldState.error}
                      errorMessage={fieldState.error?.message}
                    />
                  )}
                />
              </div>
              <SubmitButton
                text="Generate"
                loader="Generating..."
                isPending={mutation.isPending}
              />
            </form>
          </div>
        </Box>
      </Modal>
    </>
  );
}
