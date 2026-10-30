"use client";

import clsx from "clsx";
import { DEFAULT_QUESTION_TIMEOUT } from "@/constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { LuCheck, LuImagePlus, LuPlus, LuTrash2, LuX } from "react-icons/lu";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_QUESTION_TYPE,
  MAX_POLL_OPTIONS,
  MIN_POLL_OPTIONS,
  RATING_LABEL_MAX,
  isQuestionType,
  multipleChoice,
  openText,
  poll,
  rating,
  trueFalse,
  wordCloud,
  type QuestionType,
} from "@buzrr/contract";
import { getApiErrorMessage } from "@/lib/api/errors";
import { addQuestionSchema } from "@/lib/modules/forms/schemas";
import { useUpsertQuestionMutation } from "@/lib/modules/questions/hooks";
import { useProFeature } from "@/lib/modules/billing/hooks";
import ProBadge from "@/components/Billing/ProBadge";
import { usePlanLimitPrompt } from "@/components/Billing/UpgradePrompt";
import RangeSlider from "@/components/ui/RangeSlider";
import { Segmented } from "@/components/ui/Segmented";
import { Switch } from "@/components/ui/Switch";
import {
  QUESTION_TYPE_META,
  QUESTION_TYPE_ORDER,
  QuestionTypeIcon,
} from "@/components/QuestionTypes";
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
  type?: string;
  config?: unknown;
  title?: string;
  quizId?: string | null;
  createdAt?: Date;
  timeOut?: number;
  media?: string | null;
  mediaType?: string | null;
  options?: Option[];
}

type FormValues = z.infer<typeof addQuestionSchema>;
type AuthoredOption = FormValues["options"][number];

const TITLE_MAX = 150;
const MCQ_OPTIONS = 4;
/**
 * The time slider per type. Typing an answer takes longer than tapping one,
 * so word cloud and open text get a longer range and default.
 */
function timeRangeFor(type: QuestionType) {
  return type === "word_cloud" || type === "open_text"
    ? {
        min: 15,
        max: 75,
        fallback: 45,
        ticks: ["15s", "30s", "45s", "60s", "75s"],
      }
    : {
        min: 5,
        max: 60,
        fallback: DEFAULT_QUESTION_TIMEOUT,
        ticks: ["5s", "15s", "30s", "45s", "60s"],
      };
}

const clampTime = (t: number, type: QuestionType) => {
  const { min, max } = timeRangeFor(type);
  return Math.min(max, Math.max(min, t));
};

const isSliderTime = (type: QuestionType, t?: number) => {
  const { min, max } = timeRangeFor(type);
  return t === undefined || (t >= min && t <= max);
};
const OPTION_TYPES: QuestionType[] = ["multiple_choice", "true_false", "poll"];

const blankOptions = (n: number): AuthoredOption[] =>
  Array.from({ length: n }, () => ({ title: "", isCorrect: false }));

/**
 * True / false is stored as `config.answer` with no options; the picker
 * edits it as this pair, converted on load and submit.
 */
const TRUE_FALSE: AuthoredOption[] = [
  { title: "True", isCorrect: true },
  { title: "False", isCorrect: false },
];

const truthOptions = (answer: boolean): AuthoredOption[] =>
  TRUE_FALSE.map((o) => ({ ...o, isCorrect: (o.title === "True") === answer }));

/** Keeps only the first correct option (or marks A), for single choice. */
function singleCorrect(options: AuthoredOption[]): AuthoredOption[] {
  const first = Math.max(
    0,
    options.findIndex((o) => o.isCorrect),
  );
  return options.map((o, i) => ({ ...o, isCorrect: i === first }));
}

/** The options a type starts with, carrying over what fits from `from`. */
function optionsFor(type: QuestionType, from: AuthoredOption[]) {
  if (type === "true_false") {
    const correct = from.length === 2 ? from.findIndex((o) => o.isCorrect) : 0;
    return TRUE_FALSE.map((o, i) => ({
      ...o,
      isCorrect: i === Math.max(0, correct),
    }));
  }
  // Coming from true/false, its fixed labels aren't worth keeping.
  const kept = from.filter((o) => !TRUE_FALSE.some((t) => t.title === o.title));
  const titles = kept.map((o) => o.title);
  if (type === "multiple_choice") {
    // Single choice is the default: one correct option, A until picked.
    return singleCorrect(
      blankOptions(MCQ_OPTIONS).map((o, i) => ({
        title: titles[i] ?? "",
        isCorrect: kept[i]?.isCorrect ?? false,
      })),
    );
  }
  if (type === "poll") {
    const n = Math.min(
      MAX_POLL_OPTIONS,
      Math.max(MIN_POLL_OPTIONS, titles.length),
    );
    return blankOptions(n).map((o, i) => ({ ...o, title: titles[i] ?? "" }));
  }
  return [];
}

/** Settings as stored, falling back to each type's defaults. */
function configOf<S extends z.ZodType>(
  schema: S,
  config: unknown,
  own: boolean,
) {
  const parsed = schema.safeParse(own ? (config ?? {}) : {});
  return parsed.success ? parsed.data : schema.parse({});
}

function valuesFor(
  question: Question | undefined,
  initialType: QuestionType,
): FormValues {
  const type =
    question?.type && isQuestionType(question.type)
      ? question.type
      : question
        ? DEFAULT_QUESTION_TYPE
        : initialType;
  const config = question?.config;
  const p = configOf(poll.config, config, type === "poll");
  const w = configOf(wordCloud.config, config, type === "word_cloud");
  const r = configOf(rating.config, config, type === "rating");
  const o = configOf(openText.config, config, type === "open_text");
  const m = configOf(multipleChoice.config, config, type === "multiple_choice");
  const t = trueFalse.config.safeParse(config);
  const stored =
    type === "true_false" && t.success
      ? truthOptions(t.data.answer)
      : (question?.options ?? []).map((opt) => ({
          title: opt.title ?? "",
          isCorrect: Boolean(opt.isCorrect),
        }));
  return {
    type,
    title: question?.title ?? "",
    time: question?.timeOut ?? timeRangeFor(type).fallback,
    options: question
      ? stored.length
        ? stored
        : optionsFor(type, [])
      : optionsFor(type, []),
    // Unset on older rows: multiple only if several options are correct.
    mcqMulti: m.multiSelect ?? stored.filter((opt) => opt.isCorrect).length > 1,
    pollMulti: p.multiSelect,
    cloudMaxAnswers: w.maxAnswers,
    cloudMaxLength: w.maxLength,
    ratingScale: r.scale,
    lowLabel: r.lowLabel,
    highLabel: r.highLabel,
    textMaxLength: o.maxLength,
    allowAnonymous: o.allowAnonymous,
    multipleSubmissions:
      type === "word_cloud" ? w.multipleSubmissions : o.multipleSubmissions,
  };
}

/** What gets stored as `Question.config` for the chosen type. */
function configFor(v: FormValues): Record<string, unknown> {
  switch (v.type) {
    case "multiple_choice":
      return { multiSelect: v.mcqMulti };
    case "true_false":
      return { answer: v.options.find((o) => o.isCorrect)?.title === "True" };
    case "poll":
      return { multiSelect: v.pollMulti };
    case "word_cloud":
      return {
        maxAnswers: v.cloudMaxAnswers,
        maxLength: v.cloudMaxLength,
        multipleSubmissions: v.multipleSubmissions,
      };
    case "rating":
      return {
        scale: v.ratingScale,
        lowLabel: v.lowLabel.trim(),
        highLabel: v.highLabel.trim(),
      };
    case "open_text":
      return {
        maxLength: v.textMaxLength,
        allowAnonymous: v.allowAnonymous,
        multipleSubmissions: v.multipleSubmissions,
      };
    default:
      return {};
  }
}

/** The one-line recap in the footer. */
function summaryOf(v: FormValues): ReactNode {
  const secs = `${Number(v.time) || DEFAULT_QUESTION_TIMEOUT}s to answer`;
  const strong = (t: string) => (
    <b className="text-dark dark:text-white">{t}</b>
  );
  switch (v.type) {
    case "multiple_choice": {
      const keys = v.options.flatMap((o, i) =>
        o.isCorrect ? [OPTION_KEYS[i]!] : [],
      );
      return (
        <>
          {keys.length > 1 ? "Correct answers" : "Correct answer"}:{" "}
          {strong(keys.join(", ") || "—")} · {secs}
        </>
      );
    }
    case "true_false":
      return (
        <>
          Correct answer:{" "}
          {strong(v.options.find((o) => o.isCorrect)?.title ?? "—")} · {secs}
        </>
      );
    case "poll":
      return (
        <>
          {strong("Poll")} · not scored · {secs}
        </>
      );
    case "word_cloud":
      return (
        <>
          {strong("Word cloud")} · not scored ·{" "}
          {v.multipleSubmissions
            ? "multiple submissions"
            : `${v.cloudMaxAnswers} ${v.cloudMaxAnswers === 1 ? "answer" : "answers"} each`}
        </>
      );
    case "rating":
      return (
        <>
          {strong("Rating scale")} ·{" "}
          {v.ratingScale === "stars" ? "5 stars" : `1–${v.ratingScale}`} · not
          scored
        </>
      );
    case "open_text":
      return (
        <>
          {strong("Open text")} · not scored · up to {v.textMaxLength} chars
          {v.multipleSubmissions ? " · multiple submissions" : ""}
        </>
      );
  }
}

/** A labelled settings row: name (+ hint) on the left, its control right. */
function SettingRow({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm font-semibold">
      <span className="min-w-0">
        {label}
        {hint && (
          <small
            className={clsx(
              "block mt-0.5 text-[12.5px] font-medium",
              mutedText,
            )}
          >
            {hint}
          </small>
        )}
      </span>
      {children}
    </div>
  );
}

const settingsBoxClass = clsx(
  "flex flex-col gap-3.5 rounded-2xl p-4",
  subtleCardClass,
);

const AddQuesForm = (props: {
  quizId: string;
  question?: Question;
  /** The type a new question starts as (from the Add Question menu). */
  type?: QuestionType;
  /** Called after a successful save of an existing question. */
  onDone?: () => void;
}) => {
  const { question } = props;
  const initialType = props.type ?? DEFAULT_QUESTION_TYPE;
  const mutation = useUpsertQuestionMutation(props.quizId);
  const { isPro, showBadge } = useProFeature();
  const { handlePlanLimit, promptForFeature, upgradePrompt } =
    usePlanLimitPrompt();
  const [file, setFile] = useState<File | null>();
  const [fileLink, setFileLink] = useState(
    question?.media ? question.media : "",
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [customTime, setCustomTime] = useState(
    !isSliderTime(
      question?.type && isQuestionType(question.type)
        ? question.type
        : initialType,
      question?.timeOut,
    ),
  );

  const {
    control,
    handleSubmit,
    reset,
    watch,
    setValue,
    getValues,
    formState,
  } = useForm<FormValues>({
    resolver: zodResolver(addQuestionSchema) as Resolver<FormValues>,
    defaultValues: valuesFor(question, initialType),
  });

  useEffect(() => {
    reset(valuesFor(question, initialType));
    setFile(null);
    setFileLink(question?.media ? question.media : "");
    setPreviewUrl(null);
    setCustomTime(
      !isSliderTime(
        question?.type && isQuestionType(question.type)
          ? question.type
          : initialType,
        question?.timeOut,
      ),
    );
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [question, initialType, reset]);

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

  function changeType(next: QuestionType) {
    const current = getValues("type");
    if (next === current) return;
    setValue("type", next);
    setValue("options", optionsFor(next, getValues("options")));
    // A new question picks up the type's usual time until the author sets
    // one; otherwise the time is kept, pulled onto the new slider's range.
    if (!question && !formState.dirtyFields.time) {
      setValue("time", timeRangeFor(next).fallback);
    } else if (!customTime) {
      setValue("time", clampTime(Number(getValues("time")) || 0, next));
    }
  }

  const mediaSrc = previewUrl || fileLink;
  const values = watch();
  const type = values.type;
  const meta = QUESTION_TYPE_META[type];
  const multipleSubmissionsRow = (
    <SettingRow
      label="Allow multiple submissions"
      hint="Players can keep answering until time runs out"
    >
      <Controller
        name="multipleSubmissions"
        control={control}
        render={({ field }) => (
          <Switch
            checked={field.value}
            onCheckedChange={field.onChange}
            aria-label="Allow multiple submissions"
          />
        )}
      />
    </SettingRow>
  );

  // The type's one switch, shown under its options.
  const toggle =
    type === "multiple_choice" ? (
      <SettingRow
        label="Multiple correct answers"
        hint="Players select every correct option"
      >
        <Controller
          name="mcqMulti"
          control={control}
          render={({ field }) => (
            <Switch
              checked={field.value}
              onCheckedChange={(on) => {
                field.onChange(on);
                // Back to single choice: keep one answer.
                if (!on)
                  setValue("options", singleCorrect(getValues("options")));
              }}
              aria-label="Multiple correct answers"
            />
          )}
        />
      </SettingRow>
    ) : type === "poll" ? (
      <SettingRow
        label="Allow multiple choices"
        hint="Players can pick more than one"
      >
        <Controller
          name="pollMulti"
          control={control}
          render={({ field }) => (
            <Switch
              checked={field.value}
              onCheckedChange={field.onChange}
              aria-label="Allow multiple choices"
            />
          )}
        />
      </SettingRow>
    ) : null;
  const optionsError = (
    formState.errors.options as { message?: string } | undefined
  )?.message;

  const onSubmit = handleSubmit((data) => {
    const fd = new FormData();
    fd.append("title", data.title.trim());
    fd.append("type", data.type);
    fd.append("config", JSON.stringify(configFor(data)));
    fd.append(
      "options",
      JSON.stringify(
        OPTION_TYPES.includes(data.type) && data.type !== "true_false"
          ? data.options.map((o) => ({
              title: o.title.trim(),
              isCorrect: data.type === "poll" ? false : o.isCorrect,
            }))
          : [],
      ),
    );
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
          // Stay on the same type, ready for the next one.
          reset(valuesFor(undefined, data.type));
          setCustomTime(false);
          deleteFile();
        }
      },
      onError: (err) => {
        if (!handlePlanLimit(err)) toast.error(getApiErrorMessage(err));
      },
    });
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col">
      <div className="flex flex-col gap-4 px-5 pt-[18px] md:px-7 md:pt-4">
        <div className="flex flex-col gap-2">
          <span className={fieldLabelClass}>
            Question type
            <span className={counterClass}>
              {meta.scored ? "Scored" : "Not scored"}
            </span>
          </span>
          <div
            role="radiogroup"
            aria-label="Question type"
            className="flex gap-2 overflow-x-auto md:flex-wrap md:overflow-visible pb-1 md:pb-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {QUESTION_TYPE_ORDER.map((t) => {
              const on = t === type;
              return (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => changeType(t)}
                  className={clsx(
                    "flex shrink-0 items-center gap-[7px] rounded-xl border-[1.5px] px-3 py-2 text-[13.5px] font-semibold whitespace-nowrap cursor-pointer transition-colors",
                    on
                      ? "bg-lprimary dark:bg-dprimary border-lprimary dark:border-dprimary text-white"
                      : clsx(subtleCardClass, "hover:border-dprimary"),
                  )}
                >
                  <QuestionTypeIcon type={t} size={15} />
                  {QUESTION_TYPE_META[t].name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Desktop: two columns — question, image and time on the left, the
            type's options/settings on the right — so every type fits without
            scrolling. Mobile is one column in reading order. */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-x-6 md:gap-y-4 md:grid-rows-[auto_auto_1fr] md:[grid-template-areas:'title_body'_'image_body'_'time_body']">
          <div className="min-w-0 md:[grid-area:title]">
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
          </div>
          <div className="min-w-0 md:[grid-area:image]">
            <div className="flex flex-col gap-2">
              <span className={fieldLabelClass}>
                Image
                <span className={counterClass}>Optional</span>
              </span>
              {mediaSrc ? (
                <div
                  className={clsx(
                    "relative flex items-center gap-3 rounded-2xl p-2.5",
                    subtleCardClass,
                  )}
                >
                  <Image
                    src={mediaSrc}
                    alt="Question media"
                    width={160}
                    height={96}
                    className="h-12 w-20 rounded-lg object-cover"
                  />
                  <span
                    className={clsx(
                      "flex-1 min-w-0 truncate text-sm",
                      mutedText,
                    )}
                  >
                    {file?.name ?? "Current image"}
                  </span>
                  <button
                    type="button"
                    aria-label="Remove image"
                    onClick={deleteFile}
                    className="size-9 shrink-0 rounded-[10px] flex items-center justify-center text-off-dark dark:text-muted-dark hover:bg-[#e5544e]/14 hover:text-[#e5544e] transition-colors cursor-pointer"
                  >
                    <LuTrash2 size={17} />
                  </button>
                </div>
              ) : (
                <label
                  className={clsx(
                    "relative flex items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed px-4 py-3 cursor-pointer transition-colors border-lprimary/25 dark:border-white/15 hover:border-dprimary bg-light-bg dark:bg-card-dark",
                  )}
                  onClick={(e) => {
                    // Free accounts get the upgrade prompt, not the picker.
                    if (isPro) return;
                    e.preventDefault();
                    promptForFeature("image_upload");
                  }}
                >
                  {showBadge && <ProBadge />}
                  <span className="size-10 shrink-0 rounded-xl flex items-center justify-center bg-lprimary/10 dark:bg-white/5 text-lprimary dark:text-dprimary">
                    <LuImagePlus size={20} />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">
                      Upload an image
                    </span>
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
          </div>
          <div className="min-w-0 flex flex-col gap-4 md:[grid-area:body]">
            {OPTION_TYPES.includes(type) && (
              <Controller
                name="options"
                control={control}
                render={({ field, fieldState }) => {
                  const opts = field.value;
                  const update = (i: number, patch: Partial<AuthoredOption>) =>
                    field.onChange(
                      opts.map((o, j) => (j === i ? { ...o, ...patch } : o)),
                    );
                  const titleError = (i: number) =>
                    Boolean(
                      (
                        fieldState.error as unknown as
                          | { [k: number]: { title?: unknown } }
                          | undefined
                      )?.[i]?.title,
                    );

                  if (type === "true_false") {
                    return (
                      <div className="flex flex-col gap-2">
                        <span className={fieldLabelClass}>
                          Answer
                          <span className={counterClass}>
                            Tap to mark it correct
                          </span>
                        </span>
                        <div
                          role="radiogroup"
                          aria-label="Correct answer"
                          className="grid grid-cols-2 gap-2.5"
                        >
                          {opts.map((o, i) => (
                            <button
                              key={i}
                              type="button"
                              role="radio"
                              aria-checked={o.isCorrect}
                              onClick={() =>
                                field.onChange(
                                  opts.map((x, j) => ({
                                    ...x,
                                    isCorrect: j === i,
                                  })),
                                )
                              }
                              className={clsx(
                                "flex items-center gap-3 rounded-2xl border-[1.5px] p-4 md:p-5 text-base md:text-lg font-bold cursor-pointer transition-colors",
                                o.isCorrect
                                  ? "border-green-500 bg-green-500/8"
                                  : "border-lprimary/15 dark:border-white/10 bg-light-bg dark:bg-card-dark hover:border-dprimary",
                              )}
                            >
                              <span
                                className={clsx(
                                  "size-10 shrink-0 rounded-xl flex items-center justify-center text-white",
                                  i === 0 ? "bg-[#2f9e6a]" : "bg-[#e5544e]",
                                )}
                              >
                                {i === 0 ? (
                                  <LuCheck size={18} strokeWidth={3} />
                                ) : (
                                  <LuX size={18} strokeWidth={3} />
                                )}
                              </span>
                              {o.title}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  }

                  const isPoll = type === "poll";
                  const multi = values.mcqMulti;
                  return (
                    <div className="flex flex-col gap-2">
                      <span className={fieldLabelClass}>
                        Options
                        <span className={counterClass}>
                          {isPoll
                            ? "No correct answer"
                            : multi
                              ? "Tap letters to mark the correct ones"
                              : "Tap a letter to mark it correct"}
                        </span>
                      </span>
                      <div
                        role={
                          isPoll ? undefined : multi ? "group" : "radiogroup"
                        }
                        aria-label={isPoll ? undefined : "Correct answers"}
                        className="grid grid-cols-1 gap-2"
                      >
                        {opts.map((o, i) => {
                          const isCorrect = !isPoll && o.isCorrect;
                          return (
                            <div
                              key={i}
                              className={clsx(
                                "flex items-center gap-2.5 rounded-[14px] border-[1.5px] p-1.5 pr-3 transition-colors",
                                isCorrect
                                  ? "border-green-500 bg-green-500/8"
                                  : titleError(i)
                                    ? "border-red-light dark:border-red-dark bg-light-bg dark:bg-card-dark"
                                    : "border-lprimary/15 dark:border-white/10 bg-light-bg dark:bg-card-dark focus-within:border-dprimary",
                              )}
                            >
                              {isPoll ? (
                                <OptionKey
                                  index={i}
                                  className="size-8 text-[15px]"
                                />
                              ) : (
                                <button
                                  type="button"
                                  role={multi ? "checkbox" : "radio"}
                                  aria-checked={isCorrect}
                                  aria-label={`Mark option ${OPTION_KEYS[i]} correct`}
                                  onClick={() =>
                                    multi
                                      ? update(i, { isCorrect: !o.isCorrect })
                                      : field.onChange(
                                          opts.map((x, j) => ({
                                            ...x,
                                            isCorrect: j === i,
                                          })),
                                        )
                                  }
                                  className="relative shrink-0 cursor-pointer"
                                >
                                  <OptionKey
                                    index={i}
                                    className={clsx(
                                      "size-8 text-[15px] transition-opacity",
                                      !isCorrect &&
                                        "opacity-80 hover:opacity-100",
                                    )}
                                  />
                                  {isCorrect && (
                                    <span className="absolute -right-1.5 -bottom-1.5 size-[18px] rounded-full bg-green-500 text-white flex items-center justify-center border-2 border-white dark:border-dark">
                                      <LuCheck size={10} strokeWidth={3.5} />
                                    </span>
                                  )}
                                </button>
                              )}
                              <input
                                type="text"
                                value={o.title}
                                onChange={(e) =>
                                  update(i, { title: e.target.value })
                                }
                                required
                                maxLength={500}
                                autoComplete="off"
                                placeholder={`Option ${OPTION_KEYS[i]}`}
                                aria-label={`Option ${OPTION_KEYS[i]}`}
                                className="flex-1 min-w-0 bg-transparent outline-none py-1.5 text-[15px] font-medium placeholder:text-[#8a8896] dark:placeholder:text-muted-dark"
                              />
                              {isPoll && opts.length > MIN_POLL_OPTIONS && (
                                <button
                                  type="button"
                                  aria-label={`Remove option ${OPTION_KEYS[i]}`}
                                  onClick={() =>
                                    field.onChange(
                                      opts.filter((_, j) => j !== i),
                                    )
                                  }
                                  className="shrink-0 text-[#8a8896] dark:text-muted-dark hover:text-[#e5544e] cursor-pointer"
                                >
                                  <LuX size={16} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                        {isPoll && opts.length < MAX_POLL_OPTIONS && (
                          <button
                            type="button"
                            onClick={() =>
                              field.onChange([
                                ...opts,
                                { title: "", isCorrect: false },
                              ])
                            }
                            className="flex items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-lprimary/25 dark:border-white/15 p-2.5 text-sm font-bold text-lprimary dark:text-dprimary cursor-pointer hover:border-dprimary"
                          >
                            <LuPlus size={16} />
                            Add option
                          </button>
                        )}
                      </div>
                      {optionsError && (
                        <span className="text-xs text-red-light dark:text-red-dark">
                          {optionsError}
                        </span>
                      )}
                    </div>
                  );
                }}
              />
            )}

            {type === "word_cloud" && (
              <div className={settingsBoxClass}>
                {multipleSubmissionsRow}
                {!values.multipleSubmissions && (
                  <SettingRow label="Answers per player">
                    <Segmented
                      label="Answers per player"
                      value={values.cloudMaxAnswers}
                      options={[1, 2, 3].map((n) => ({ value: n, label: n }))}
                      onChange={(n) => setValue("cloudMaxAnswers", n)}
                    />
                  </SettingRow>
                )}
                <SettingRow label="Max length" hint="Characters per answer">
                  <Segmented
                    label="Max length"
                    value={values.cloudMaxLength}
                    options={[20, 40].map((n) => ({
                      value: n as 20 | 40,
                      label: n,
                    }))}
                    onChange={(n) => setValue("cloudMaxLength", n)}
                  />
                </SettingRow>
              </div>
            )}

            {type === "rating" && (
              <div className={settingsBoxClass}>
                <SettingRow label="Scale">
                  <Segmented
                    label="Scale"
                    value={values.ratingScale}
                    options={[
                      { value: "5", label: "1–5" },
                      { value: "10", label: "1–10" },
                      { value: "stars", label: "Stars" },
                    ]}
                    onChange={(scale) => setValue("ratingScale", scale)}
                  />
                </SettingRow>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {(
                    [
                      ["lowLabel", "Low label", "Not at all"],
                      ["highLabel", "High label", "Very"],
                    ] as const
                  ).map(([name, label, placeholder]) => (
                    <Controller
                      key={name}
                      name={name}
                      control={control}
                      render={({ field }) => (
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[13.5px] font-semibold">
                            {label}
                          </span>
                          <input
                            {...field}
                            maxLength={RATING_LABEL_MAX}
                            placeholder={placeholder}
                            autoComplete="off"
                            className={clsx(
                              inputClass,
                              "!px-3.5 !py-2.5 text-[15px] font-semibold",
                            )}
                          />
                        </label>
                      )}
                    />
                  ))}
                </div>
              </div>
            )}

            {type === "open_text" && (
              <div className={settingsBoxClass}>
                <SettingRow label="Max length">
                  <Segmented
                    label="Max length"
                    value={values.textMaxLength}
                    options={[100, 200, 500].map((n) => ({
                      value: n as 100 | 200 | 500,
                      label: n,
                    }))}
                    onChange={(n) => setValue("textMaxLength", n)}
                  />
                </SettingRow>
                {multipleSubmissionsRow}
                <SettingRow label="Allow anonymous answers">
                  <Controller
                    name="allowAnonymous"
                    control={control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        aria-label="Allow anonymous answers"
                      />
                    )}
                  />
                </SettingRow>
              </div>
            )}
            {toggle && (
              <div className={clsx(settingsBoxClass, "!py-3")}>{toggle}</div>
            )}
          </div>
          <div className="min-w-0 md:self-start md:[grid-area:time]">
            <Controller
              name="time"
              control={control}
              render={({ field, fieldState }) => {
                const t = Number(field.value) || 0;
                const range = timeRangeFor(type);
                return (
                  <div
                    className={clsx(
                      "flex flex-col gap-2 rounded-2xl p-3.5",
                      subtleCardClass,
                    )}
                  >
                    <div className={fieldLabelClass}>
                      Time to answer
                      <Segmented
                        label="Time input"
                        value={customTime ? "Custom" : "Slider"}
                        options={[
                          { value: "Slider", label: "Slider" },
                          { value: "Custom", label: "Custom" },
                        ]}
                        onChange={(mode) => {
                          setCustomTime(mode === "Custom");
                          if (mode === "Slider") {
                            field.onChange(
                              clampTime(t || range.fallback, type),
                            );
                          }
                        }}
                      />
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
                    ) : (
                      <div className="flex items-center gap-3.5">
                        <span className="shrink-0 w-[58px] text-[22px] font-extrabold tracking-[-0.02em] leading-none text-lprimary dark:text-dprimary">
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
                        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                          <RangeSlider
                            label="Seconds to answer"
                            min={range.min}
                            max={range.max}
                            value={clampTime(t, type)}
                            onChange={field.onChange}
                            ticks={range.ticks}
                          />
                        </div>
                      </div>
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
        </div>
      </div>

      <div className="mt-5 flex flex-col md:flex-row items-stretch md:items-center gap-3.5 border-t border-lprimary/15 dark:border-white/10 px-5 pt-[18px] pb-6 md:px-7 md:py-4">
        <p className={clsx("flex-1 text-[13px]", mutedText)}>
          {summaryOf(values)}
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
      {upgradePrompt}
    </form>
  );
};

export default AddQuesForm;
