"use client";

import clsx from "clsx";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { Modal } from "@mui/material";
import { LuSparkles, LuX } from "react-icons/lu";
import { useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useAppSelector } from "@/state/hooks";
import { useRouter } from "next/navigation";
import { getApiErrorMessage } from "@/lib/api/errors";
import { createAiQuizSchema } from "@/lib/modules/forms/schemas";
import { useCreateAiQuizMutation } from "@/lib/modules/quizzes/hooks";
import {
  AiQuotaBar,
  usePlanLimitPrompt,
} from "@/components/Billing/UpgradePrompt";
import ActionCard from "@/components/Admin/Home/ActionCard";
import RangeSlider from "@/components/ui/RangeSlider";
import {
  fieldLabelClass,
  inputClass,
  mutedText,
  primaryButtonClass,
  subtleCardClass,
} from "@/components/Game/GameUI";

type FormValues = z.infer<typeof createAiQuizSchema>;

const MAX_QUESTIONS = 15;
const DEFAULTS: FormValues = {
  title: "",
  description: "",
  questions: 10,
  time: 20,
};

export default function CreateAIQuiz({ className }: { className?: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [customTime, setCustomTime] = useState(false);
  const view = useAppSelector((state) => state.gridListToggle.view);
  const mutation = useCreateAiQuizMutation();
  const { handlePlanLimit, upgradePrompt } = usePlanLimitPrompt();
  const { control, handleSubmit, reset, watch, formState } =
    useForm<FormValues>({
      resolver: zodResolver(createAiQuizSchema) as Resolver<FormValues>,
      defaultValues: DEFAULTS,
    });

  const [title, description, questions, time] = watch([
    "title",
    "description",
    "questions",
    "time",
  ]);
  const n = Number(questions) || 0;
  const t = Number(time) || 0;
  const canGenerate =
    title.trim().length > 0 &&
    description.trim().length > 0 &&
    !mutation.isPending;

  const close = () => {
    if (mutation.isPending) return;
    setOpen(false);
  };

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
          reset(DEFAULTS);
          setCustomTime(false);
          router.push(`/admin/quiz/${res.quizId}`);
        },
        onError: (err) => {
          if (handlePlanLimit(err)) {
            setOpen(false);
            return;
          }
          toast.error(getApiErrorMessage(err));
        },
      },
    );
  });

  return (
    <>
      <ActionCard
        view={view}
        variant="ai"
        onClick={() => setOpen(true)}
        icon={<LuSparkles />}
        title="Create a quiz with AI"
        subtitle="Let's get your quiz ready"
        className={className}
      />

      <Modal
        open={open}
        onClose={close}
        aria-labelledby="ai-quiz-title"
        slotProps={{
          backdrop: {
            className: "!bg-[rgba(10,8,20,0.55)] backdrop-blur-[3px]",
          },
        }}
      >
        <div
          className="fixed inset-0 flex items-end md:items-center justify-center md:p-6 outline-none"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <form
            onSubmit={onSubmit}
            className="w-full md:max-w-[600px] max-h-[92dvh] overflow-y-auto flex flex-col rounded-t-[26px] md:rounded-[26px] border bg-white dark:bg-dark border-lprimary/15 dark:border-white/5 shadow-[0_40px_80px_-30px_rgba(0,0,0,0.6)] text-dark dark:text-white"
          >
            <div className="flex items-start gap-4 px-5 pt-[22px] md:px-7 md:pt-[26px]">
              <span className="size-12 shrink-0 rounded-[14px] bg-linear-to-br from-[#9a6cf5] to-[#7c4ddb] text-white flex items-center justify-center shadow-[0_10px_24px_-10px_#7c4ddb]">
                <LuSparkles size={24} />
              </span>
              <div className="min-w-0">
                <h2
                  id="ai-quiz-title"
                  className="text-xl md:text-[22px] font-bold tracking-[-0.01em]"
                >
                  Hey there! I&apos;m your AI quiz buddy.
                </h2>
                <p
                  className={clsx(
                    "mt-1 text-[14.5px] leading-normal",
                    mutedText,
                  )}
                >
                  Describe what you want and I&apos;ll draft the questions. You
                  can edit everything afterwards.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className={clsx(
                  "ml-auto size-9 shrink-0 rounded-[10px] flex items-center justify-center hover:bg-lprimary/8 dark:hover:bg-white/5 hover:text-dark dark:hover:text-white transition-colors cursor-pointer",
                  mutedText,
                )}
              >
                <LuX size={18} />
              </button>
            </div>

            <AiQuotaBar className="mx-5 md:mx-7 mt-4 md:mt-[18px]" />

            <div className="flex flex-col gap-[18px] px-5 pt-[18px] md:px-7 md:pt-5">
              <Controller
                name="title"
                control={control}
                render={({ field }) => (
                  <label className="flex flex-col gap-2">
                    <span className={fieldLabelClass}>Name your quiz</span>
                    <input
                      {...field}
                      type="text"
                      maxLength={60}
                      autoComplete="off"
                      placeholder='Example: "My 20th Bday Quiz"'
                      className={inputClass}
                    />
                  </label>
                )}
              />
              <Controller
                name="description"
                control={control}
                render={({ field }) => (
                  <label className="flex flex-col gap-2">
                    <span className={fieldLabelClass}>
                      What should the questions be about?
                    </span>
                    <textarea
                      {...field}
                      rows={3}
                      placeholder="Example: quiz on gravitational forces."
                      className={clsx(inputClass, "resize-none")}
                    />
                  </label>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Controller
                  name="questions"
                  control={control}
                  render={({ field }) => (
                    <div
                      className={clsx(
                        "flex flex-col gap-3 rounded-2xl p-4",
                        subtleCardClass,
                      )}
                    >
                      <div className={fieldLabelClass}>
                        Questions
                        <span className="text-[22px] font-extrabold tracking-[-0.02em] leading-none text-lprimary dark:text-dprimary">
                          {n}
                        </span>
                      </div>
                      <RangeSlider
                        label="Number of questions"
                        min={1}
                        max={MAX_QUESTIONS}
                        value={n}
                        onChange={field.onChange}
                        ticks={["1", "5", "10", "15"]}
                      />
                    </div>
                  )}
                />
                <Controller
                  name="time"
                  control={control}
                  render={({ field }) => (
                    <div
                      className={clsx(
                        "flex flex-col gap-3 rounded-2xl p-4",
                        subtleCardClass,
                      )}
                    >
                      <div className={fieldLabelClass}>
                        Time per question
                        <span className="flex gap-1 rounded-[10px] p-[3px] bg-lprimary/8 dark:bg-white/5">
                          {(["Slider", "Custom"] as const).map((mode) => {
                            const on = (mode === "Custom") === customTime;
                            return (
                              <button
                                key={mode}
                                type="button"
                                aria-pressed={on}
                                onClick={() => {
                                  setCustomTime(mode === "Custom");
                                  if (mode === "Slider") {
                                    field.onChange(
                                      Math.min(60, Math.max(5, t || 20)),
                                    );
                                  }
                                }}
                                className={clsx(
                                  "rounded-lg px-2.5 py-[5px] text-xs font-semibold cursor-pointer transition-colors",
                                  on
                                    ? "bg-white dark:bg-dark text-dark dark:text-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]"
                                    : mutedText,
                                )}
                              >
                                {mode}
                              </button>
                            );
                          })}
                        </span>
                      </div>
                      {customTime ? (
                        <>
                          <div className="flex items-center gap-2.5">
                            <input
                              type="number"
                              min={5}
                              max={600}
                              value={field.value ?? ""}
                              aria-label="Seconds per question"
                              onChange={(e) =>
                                field.onChange(
                                  e.target.value === ""
                                    ? ""
                                    : Number(e.target.value),
                                )
                              }
                              className={clsx(
                                inputClass,
                                "!px-3 !py-2.5 font-bold",
                              )}
                            />
                            <span
                              className={clsx(
                                "text-[13px] whitespace-nowrap",
                                mutedText,
                              )}
                            >
                              seconds
                            </span>
                          </div>
                          {formState.errors.time?.message && (
                            <span className="text-xs text-red-light dark:text-red-dark">
                              {formState.errors.time.message}
                            </span>
                          )}
                        </>
                      ) : (
                        <>
                          <span className="-mt-1 text-[22px] font-extrabold tracking-[-0.02em] leading-none text-lprimary dark:text-dprimary">
                            {t}
                            <small
                              className={clsx(
                                "ml-[3px] text-[13px] font-semibold",
                                mutedText,
                              )}
                            >
                              sec
                            </small>
                          </span>
                          <RangeSlider
                            label="Seconds per question"
                            min={5}
                            max={60}
                            value={Math.min(60, Math.max(5, t))}
                            onChange={field.onChange}
                            ticks={["5s", "15s", "30s", "45s", "60s"]}
                          />
                        </>
                      )}
                    </div>
                  )}
                />
              </div>
            </div>

            <div className="mt-[22px] flex flex-col md:flex-row items-stretch md:items-center gap-3.5 border-t border-lprimary/15 dark:border-white/10 px-5 pt-[18px] pb-6 md:px-7 md:pt-[22px] md:pb-[26px]">
              <p className={clsx("flex-1 text-[13px]", mutedText)}>
                {n} {n === 1 ? "question" : "questions"} · {t || "—"}s each ·
                about {Math.max(1, Math.round((n * t) / 60))} min to play
              </p>
              <button
                type="submit"
                disabled={!canGenerate}
                className={clsx(primaryButtonClass, "px-[26px]")}
              >
                <LuSparkles size={20} />
                {mutation.isPending ? "Generating..." : "Generate"}
              </button>
            </div>
          </form>
        </div>
      </Modal>
      {upgradePrompt}
    </>
  );
}
