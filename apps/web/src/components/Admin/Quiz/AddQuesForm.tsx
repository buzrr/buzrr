"use client";

import clsx from "clsx";
import { DEFAULT_QUESTION_TIMEOUT } from "@/constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { LuCheck, LuImagePlus, LuTrash2 } from "react-icons/lu";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { getApiErrorMessage } from "@/lib/api/errors";
import { addQuestionSchema } from "@/lib/modules/forms/schemas";
import { useUpsertQuestionMutation } from "@/lib/modules/questions/hooks";
import RangeSlider from "@/components/ui/RangeSlider";
import {
  OPTION_KEYS,
  OptionKey,
  counterClass,
  fieldLabelClass,
  inputClass,
  mutedText,
  primaryButtonClass,
  subtleCardClass,
} from "@/components/Game/GameUI";

interface Option {
  id?: string;
  title?: string;
  isCorrect?: boolean;
  questionId?: string;
  createdAt?: Date;
}

interface Question {
  id: string;
  title?: string;
  quizId?: string;
  createdAt?: Date;
  timeOut?: number;
  media?: string | null;
  mediaType?: string | null;
  options?: Option[];
}

type FormValues = z.infer<typeof addQuestionSchema>;

const TITLE_MAX = 150;
const OPTION_FIELDS = [
  ["option1", "a"],
  ["option2", "b"],
  ["option3", "c"],
  ["option4", "d"],
] as const;

const isSliderTime = (t?: number) => t === undefined || (t >= 5 && t <= 60);

function defaultCorrectLetter(options?: Option[]): "a" | "b" | "c" | "d" {
  if (!options?.length) return "a";
  const idx = options.findIndex((o) => o.isCorrect);
  const letters: ("a" | "b" | "c" | "d")[] = ["a", "b", "c", "d"];
  return letters[idx] ?? "a";
}

const AddQuesForm = (props: {
  quizId: string;
  question?: Question;
  /** Called after a successful save of an existing question. */
  onDone?: () => void;
}) => {
  const { question } = props;
  const options = question?.options;
  const mutation = useUpsertQuestionMutation(props.quizId);
  const [file, setFile] = useState<File | null>();
  const [fileLink, setFileLink] = useState(
    question?.media ? question.media : "",
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customTime, setCustomTime] = useState(
    !isSliderTime(question?.timeOut),
  );

  const { control, handleSubmit, reset, watch } = useForm<FormValues>({
    resolver: zodResolver(addQuestionSchema) as Resolver<FormValues>,
    defaultValues: {
      title: question?.title ?? "",
      option1: options?.[0]?.title ?? "",
      option2: options?.[1]?.title ?? "",
      option3: options?.[2]?.title ?? "",
      option4: options?.[3]?.title ?? "",
      choose_option: defaultCorrectLetter(options),
      time: question?.timeOut ?? DEFAULT_QUESTION_TIMEOUT,
    },
  });

  useEffect(() => {
    reset({
      title: question?.title ?? "",
      option1: options?.[0]?.title ?? "",
      option2: options?.[1]?.title ?? "",
      option3: options?.[2]?.title ?? "",
      option4: options?.[3]?.title ?? "",
      choose_option: defaultCorrectLetter(options),
      time: question?.timeOut ?? DEFAULT_QUESTION_TIMEOUT,
    });
    setFile(null);
    setFileLink(question?.media ? question.media : "");
    setPreviewUrl(null);
    setCustomTime(!isSliderTime(question?.timeOut));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [question, options, reset]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0] || null;
    setFile(selectedFile);
  }

  function deleteFile() {
    setFile(null);
    setPreviewUrl(null);
    setFileLink("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const mediaSrc = previewUrl || fileLink;
  const correctLetter = watch("choose_option");
  const correctKey =
    OPTION_KEYS[OPTION_FIELDS.findIndex(([, l]) => l === correctLetter)] ?? "A";

  const onSubmit = handleSubmit((data) => {
    const fd = new FormData();
    fd.append("title", data.title);
    fd.append("option1", data.option1);
    fd.append("option2", data.option2);
    fd.append("option3", data.option3);
    fd.append("option4", data.option4);
    fd.append("choose_option", data.choose_option);
    fd.append(
      "time",
      String(
        data.time !== undefined && !Number.isNaN(data.time)
          ? data.time
          : DEFAULT_QUESTION_TIMEOUT,
      ),
    );
    fd.append("file_link", fileLink);
    fd.append("media_type", file ? "" : (question?.mediaType ?? ""));
    if (question?.id) fd.append("ques_id", question.id);
    if (file) fd.append("file", file);

    mutation.mutate(fd, {
      onSuccess: () => {
        toast.success(question?.id ? "Question updated" : "Question added");
        if (question?.id) {
          props.onDone?.();
        } else {
          reset({
            title: "",
            option1: "",
            option2: "",
            option3: "",
            option4: "",
            choose_option: "a",
            time: DEFAULT_QUESTION_TIMEOUT,
          });
          setCustomTime(false);
          deleteFile();
        }
      },
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
      },
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col">
      <div className="flex flex-col gap-[18px] px-5 pt-[18px] md:px-7 md:pt-5">
        <Controller
          name="title"
          control={control}
          render={({ field, fieldState }) => (
            <label className="flex flex-col gap-2">
              <span className={fieldLabelClass}>
                Question
                <span className={counterClass}>
                  {field.value.length}/{TITLE_MAX}
                </span>
              </span>
              <textarea
                {...field}
                rows={2}
                maxLength={TITLE_MAX}
                required
                autoComplete="off"
                placeholder="What do you want to ask?"
                aria-invalid={!!fieldState.error}
                className={clsx(inputClass, "resize-none")}
              />
            </label>
          )}
        />

        <div className="flex flex-col gap-2">
          <span className={fieldLabelClass}>
            Image
            <span className={counterClass}>Optional</span>
          </span>
          {mediaSrc ? (
            <div
              className={clsx(
                "relative flex items-center gap-4 rounded-2xl p-3",
                subtleCardClass,
              )}
            >
              <Image
                src={mediaSrc}
                alt="Question media"
                width={160}
                height={96}
                className="h-20 w-32 rounded-xl object-cover"
              />
              <span
                className={clsx("flex-1 min-w-0 truncate text-sm", mutedText)}
              >
                {file?.name ?? "Current image"}
              </span>
              <button
                type="button"
                aria-label="Remove image"
                onClick={deleteFile}
                className="size-9 shrink-0 rounded-[10px] flex items-center justify-center text-off-dark dark:text-[#a1a1aa] hover:bg-[#e5544e]/14 hover:text-[#e5544e] transition-colors cursor-pointer"
              >
                <LuTrash2 size={17} />
              </button>
            </div>
          ) : (
            <label
              className={clsx(
                "flex items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed px-4 py-3.5 cursor-pointer transition-colors border-lprimary/25 dark:border-white/15 hover:border-dprimary bg-light-bg dark:bg-card-dark",
              )}
            >
              <span className="size-10 shrink-0 rounded-xl flex items-center justify-center bg-lprimary/10 dark:bg-white/5 text-lprimary dark:text-dprimary">
                <LuImagePlus size={20} />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-semibold">Upload an image</span>
                <span className={clsx("text-[12.5px]", mutedText)}>
                  PNG, JPG or GIF under 10MB
                </span>
              </span>
              <input
                type="file"
                accept="image/*"
                name="file"
                className="sr-only"
                ref={fileInputRef}
                onChange={handleFile}
              />
            </label>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <span className={fieldLabelClass}>
            Options
            <span className={counterClass}>
              Tap a letter to mark it correct
            </span>
          </span>
          <Controller
            name="choose_option"
            control={control}
            render={({ field: correct }) => (
              <div
                role="radiogroup"
                aria-label="Correct answer"
                className="grid grid-cols-1 md:grid-cols-2 gap-2.5"
              >
                {OPTION_FIELDS.map(([name, letter], i) => {
                  const isCorrect = correct.value === letter;
                  return (
                    <Controller
                      key={name}
                      name={name}
                      control={control}
                      render={({ field, fieldState }) => (
                        <div
                          className={clsx(
                            "flex items-center gap-2.5 rounded-2xl border-[1.5px] p-2 pr-3 transition-colors",
                            isCorrect
                              ? "border-green-500 bg-green-500/8"
                              : fieldState.error
                                ? "border-red-light dark:border-red-dark bg-light-bg dark:bg-card-dark"
                                : "border-lprimary/15 dark:border-white/10 bg-light-bg dark:bg-card-dark focus-within:border-dprimary",
                          )}
                        >
                          <button
                            type="button"
                            role="radio"
                            aria-checked={isCorrect}
                            aria-label={`Mark option ${OPTION_KEYS[i]} correct`}
                            onClick={() => correct.onChange(letter)}
                            className="relative shrink-0 cursor-pointer"
                          >
                            <OptionKey
                              index={i}
                              className={clsx(
                                "size-9 text-base transition-opacity",
                                !isCorrect && "opacity-80 hover:opacity-100",
                              )}
                            />
                            {isCorrect && (
                              <span className="absolute -right-1.5 -bottom-1.5 size-[18px] rounded-full bg-green-500 text-white flex items-center justify-center border-2 border-white dark:border-dark">
                                <LuCheck size={10} strokeWidth={3.5} />
                              </span>
                            )}
                          </button>
                          <input
                            {...field}
                            type="text"
                            required
                            autoComplete="off"
                            placeholder={`Option ${OPTION_KEYS[i]}`}
                            aria-label={`Option ${OPTION_KEYS[i]}`}
                            className="flex-1 min-w-0 bg-transparent outline-none py-2 text-[15px] font-medium placeholder:text-[#8a8896] dark:placeholder:text-[#71717a]"
                          />
                        </div>
                      )}
                    />
                  );
                })}
              </div>
            )}
          />
        </div>

        <Controller
          name="time"
          control={control}
          render={({ field, fieldState }) => {
            const t = Number(field.value) || 0;
            return (
              <div
                className={clsx(
                  "flex flex-col gap-3 rounded-2xl p-4",
                  subtleCardClass,
                )}
              >
                <div className={fieldLabelClass}>
                  Time to answer
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
                                Math.min(
                                  60,
                                  Math.max(5, t || DEFAULT_QUESTION_TIMEOUT),
                                ),
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
                  <div className="flex items-center gap-2.5">
                    <input
                      type="number"
                      min={1}
                      value={field.value ?? ""}
                      aria-label="Seconds to answer"
                      onChange={(e) =>
                        field.onChange(
                          e.target.value === ""
                            ? undefined
                            : Number(e.target.value),
                        )
                      }
                      className={clsx(inputClass, "!px-3 !py-2.5 font-bold")}
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
                      label="Seconds to answer"
                      min={5}
                      max={60}
                      value={Math.min(60, Math.max(5, t))}
                      onChange={field.onChange}
                      ticks={["5s", "15s", "30s", "45s", "60s"]}
                    />
                  </>
                )}
                {fieldState.error?.message && (
                  <span className="text-xs text-red-light dark:text-red-dark">
                    {fieldState.error.message}
                  </span>
                )}
              </div>
            );
          }}
        />
      </div>

      <div className="mt-[22px] flex flex-col md:flex-row items-stretch md:items-center gap-3.5 border-t border-lprimary/15 dark:border-white/10 px-5 pt-[18px] pb-6 md:px-7 md:pt-[22px] md:pb-[26px]">
        <p className={clsx("flex-1 text-[13px]", mutedText)}>
          Correct answer:{" "}
          <b className="text-dark dark:text-white">{correctKey}</b> ·{" "}
          {Number(watch("time")) || DEFAULT_QUESTION_TIMEOUT}s to answer
        </p>
        <button
          type="submit"
          disabled={mutation.isPending}
          className={clsx(primaryButtonClass, "px-[26px]")}
        >
          {mutation.isPending
            ? "Saving..."
            : question?.id
              ? "Save changes"
              : "Add question"}
        </button>
      </div>
    </form>
  );
};

export default AddQuesForm;
