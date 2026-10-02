"use client";

import clsx from "clsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { LuArrowLeft, LuArrowRight } from "react-icons/lu";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useRouter } from "next/navigation";
import { getApiErrorMessage } from "@/lib/api/errors";
import { createQuizSchema } from "@/lib/modules/forms/schemas";
import { useCreateQuizMutation } from "@/lib/modules/quizzes/hooks";
import { usePlanLimitPrompt } from "@/components/Billing/UpgradePrompt";
import {
  counterClass,
  fieldLabelClass,
  inputClass,
  mutedText,
  primaryButtonClass,
} from "@/components/Game/GameUI";

type FormValues = z.infer<typeof createQuizSchema>;

export const TITLE_MAX = 60;
export const DESCRIPTION_MAX = 200;

const CreateBuzrrForm = (params: {
  onChange: (values: { title: string; description: string }) => void;
}) => {
  const router = useRouter();
  const mutation = useCreateQuizMutation();
  const { handlePlanLimit, upgradePrompt } = usePlanLimitPrompt();
  const { control, handleSubmit, watch } = useForm<FormValues>({
    resolver: zodResolver(createQuizSchema),
    defaultValues: { title: "", description: "" },
  });
  const title = watch("title");

  const onSubmit = handleSubmit((data) => {
    mutation.mutate(
      {
        title: data.title.trim(),
        description: data.description?.trim() || undefined,
      },
      {
        onSuccess: (res) => {
          router.push(`/admin/quiz/${res.quizId}`);
        },
        onError: (err) => {
          if (handlePlanLimit(err)) return;
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  });

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-[18px] md:gap-[22px] h-full"
    >
      <button
        type="button"
        onClick={() => router.push("/admin")}
        className={clsx(
          "self-start flex items-center gap-2 text-[14.5px] font-semibold hover:text-dark dark:hover:text-white transition-colors cursor-pointer",
          mutedText,
        )}
      >
        <LuArrowLeft size={18} />
        Back to home
      </button>
      <div>
        <h1 className="text-[30px] md:text-[42px] font-extrabold tracking-[-0.03em] leading-[1.08] text-balance">
          Give your quiz a title and description
        </h1>
        <p className={clsx("mt-2.5 text-[15.5px]", mutedText)}>
          You&apos;ll add questions in the next step.
        </p>
      </div>

      <Controller
        name="title"
        control={control}
        render={({ field, fieldState }) => (
          <label className="flex flex-col gap-2">
            <span className={fieldLabelClass}>
              Quiz title
              <span className={counterClass}>
                {field.value.length}/{TITLE_MAX}
              </span>
            </span>
            <input
              {...field}
              type="text"
              maxLength={TITLE_MAX}
              placeholder="Enter quiz title"
              autoComplete="off"
              autoFocus
              aria-invalid={!!fieldState.error}
              className={inputClass}
              onChange={(e) => {
                field.onChange(e.target.value);
                params.onChange({
                  title: e.target.value,
                  description: watch("description") ?? "",
                });
              }}
            />
            {fieldState.error?.message && (
              <span className="text-sm text-red-light dark:text-red-dark">
                {fieldState.error.message}
              </span>
            )}
          </label>
        )}
      />

      <Controller
        name="description"
        control={control}
        render={({ field }) => (
          <label className="flex flex-col gap-2">
            <span className={fieldLabelClass}>
              Description
              <span className={counterClass}>Optional</span>
            </span>
            <textarea
              {...field}
              value={field.value ?? ""}
              rows={4}
              maxLength={DESCRIPTION_MAX}
              placeholder="What's this quiz about?"
              className={clsx(inputClass, "resize-none")}
              onChange={(e) => {
                field.onChange(e.target.value);
                params.onChange({
                  title: watch("title"),
                  description: e.target.value,
                });
              }}
            />
          </label>
        )}
      />

      <div className="md:mt-auto flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <p className={clsx("flex-1 text-[13.5px]", mutedText)}>
          Next: add questions
        </p>
        <button
          type="submit"
          disabled={!title.trim() || mutation.isPending}
          className={primaryButtonClass}
        >
          {mutation.isPending ? "Creating..." : "Next"}
          <LuArrowRight size={18} />
        </button>
      </div>
      {upgradePrompt}
    </form>
  );
};

export default CreateBuzrrForm;
