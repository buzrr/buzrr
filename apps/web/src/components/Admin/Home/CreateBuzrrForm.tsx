"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import SubmitButton from "../../SubmitButton";
import { InputField } from "@/components/InputField";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useRouter } from "next/navigation";
import { getApiErrorMessage } from "@/lib/api/errors";
import { createQuizSchema } from "@/lib/modules/forms/schemas";
import { useCreateQuizMutation } from "@/lib/modules/quizzes/hooks";

type FormValues = z.infer<typeof createQuizSchema>;

const CreateBuzrrForm = (params: { setTitle: (title: string) => void }) => {
  const router = useRouter();
  const mutation = useCreateQuizMutation();
  const { control, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(createQuizSchema),
    defaultValues: { title: "", description: "" },
  });

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(
      {
        title: data.title,
        description: data.description?.trim() || undefined,
      },
      {
        onSuccess: (res) => {
          router.push(`/admin/quiz/${res.quizId}`);
        },
        onError: (err) => {
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col w-full md:w-4/5 mt-8">
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
            onTitleChange={(v) => {
              field.onChange(v);
              params.setTitle(v);
            }}
            label="Quiz title"
            fieldValue={field.value}
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
            label="Description (Optional)"
            onTitleChange={field.onChange}
            fieldValue={field.value ?? ""}
            error={!!fieldState.error}
            errorMessage={fieldState.error?.message}
          />
        )}
      />
      <SubmitButton isPending={mutation.isPending} />
    </form>
  );
};

export default CreateBuzrrForm;
