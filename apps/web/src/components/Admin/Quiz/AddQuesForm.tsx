"use client";

import clsx from "clsx";
import { DEFAULT_QUESTION_TIMEOUT } from "@/constants";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { z } from "zod";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  LuCheck,
  LuGripVertical,
  LuImagePlus,
  LuMusic,
  LuPlus,
  LuShuffle,
  LuTrash2,
  LuX,
} from "react-icons/lu";
import { DragDropContext, Draggable, Droppable } from "@hello-pangea/dnd";
import AudioCueEditor from "@/components/Admin/Quiz/AudioCueEditor";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  DEFAULT_QUESTION_TYPE,
  MAX_ACCEPTED_ANSWERS,
  MAX_OPTIONS,
  MAX_POLL_OPTIONS,
  TYPE_ANSWER_MAX_LENGTH,
  UNLIMITED_TIME_OUT,
  answerPattern,
  isUnlimitedTime,
  MIN_OPTIONS,
  MIN_POLL_OPTIONS,
  RATING_LABEL_MAX,
  isQuestionType,
  multipleChoice,
  openText,
  poll,
  rating,
  trueFalse,
  typeAnswer,
  wordCloud,
  type QuestionType,
} from "@buzrr/contract";
import { getApiErrorMessage } from "@/lib/api/errors";
import { addQuestionSchema } from "@/lib/modules/forms/schemas";
import { useUpsertQuestionMutation } from "@/lib/modules/questions/hooks";
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
  audio?: string | null;
  audioStartMs?: number | null;
  audioRevealMs?: number | null;
  audioPlayOn?: string | null;
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
  return type === "word_cloud" || type === "open_text" || type === "type_answer"
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
  if (isUnlimitedTime(t)) return UNLIMITED_TIME_OUT;
  const { min, max } = timeRangeFor(type);
  return Math.min(max, Math.max(min, t));
};

const isSliderTime = (type: QuestionType, t?: number) => {
  const { min, max } = timeRangeFor(type);
  return t === undefined || isUnlimitedTime(t) || (t >= min && t <= max);
};

/** The slider's last step past the range: no time limit ("∞"). */
const SLIDER_UNLIMITED_STEP = 5;
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

/** The options in a new random order — never the one they are in. */
function shuffled(options: AuthoredOption[]): AuthoredOption[] {
  if (options.length < 2) return options;
  for (;;) {
    const next = [...options];
    for (let i = next.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j]!, next[i]!];
    }
    if (next.some((o, i) => o !== options[i])) return next;
  }
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
    const n = Math.min(MAX_OPTIONS, Math.max(MCQ_OPTIONS, titles.length));
    return singleCorrect(
      blankOptions(n).map((o, i) => ({
        title: titles[i] ?? "",
        isCorrect: kept[i]?.isCorrect ?? false,
      })),
    );
  }
  if (type === "type_answer") {
    // Accepted answers: carry over the right ones, else one empty row.
    const right = kept.filter((o) => o.isCorrect && o.title.trim());
    const rows = (right.length ? right : [{ title: "" }]).slice(
      0,
      MAX_ACCEPTED_ANSWERS,
    );
    return rows.map((o) => ({ title: o.title, isCorrect: true }));
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
  const t = configOf(typeAnswer.config, config, type === "type_answer");
  const tf = trueFalse.config.safeParse(config);
  const stored =
    type === "true_false" && tf.success
      ? truthOptions(tf.data.answer)
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
    ignoreTypos: t.ignoreTypos,
    fixedLength: t.fixedLength,
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
    case "type_answer":
      return { ignoreTypos: v.ignoreTypos, fixedLength: v.fixedLength };
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
  const secs = isUnlimitedTime(Number(v.time))
    ? "no time limit"
    : `${Number(v.time) || DEFAULT_QUESTION_TIMEOUT}s to answer`;
  const strong = (text: string) => (
    <b className="text-dark dark:text-white">{text}</b>
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
    case "type_answer": {
      const n = v.options.filter((o) => o.title.trim()).length;
      return (
        <>
          {strong(n === 1 ? `${n} accepted answer` : `${n} accepted answers`)}
          {v.fixedLength ? ` · fixed length` : ""}
          {v.ignoreTypos ? ` · typos forgiven` : ` · exact match`} · {secs}
        </>
      );
    }
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
            : v.cloudMaxAnswers === 1
              ? `${v.cloudMaxAnswers} answer each`
              : `${v.cloudMaxAnswers} answers each`}
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
          {strong("Open text")} · not scored · up to {v.textMaxLength}{" "}
          characters
          {v.multipleSubmissions ? ` · multiple submissions` : ""}
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
  /** Called after a successful save of an existing question, and after
   *  "Done" on a new one (closes the dialog). */
  onDone?: () => void;
}) => {
  const { question } = props;
  const initialType = props.type ?? DEFAULT_QUESTION_TYPE;
  const mutation = useUpsertQuestionMutation(props.quizId);
  const [file, setFile] = useState<File | null>();
  const [fileLink, setFileLink] = useState(
    question?.media ? question.media : "",
  );
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Optional sound (MP3) with its two cue points (ms).
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioLink, setAudioLink] = useState(question?.audio ?? "");
  const [audioPreview, setAudioPreview] = useState<string | null>(null);
  const [audioCues, setAudioCues] = useState<{
    startMs: number;
    revealMs: number | null;
  }>({
    startMs: question?.audioStartMs ?? 0,
    revealMs: question?.audioRevealMs ?? null,
  });
  const audioInputRef = useRef<HTMLInputElement>(null);
  const [audioPlayOn, setAudioPlayOn] = useState(
    question?.audioPlayOn ?? "quiz",
  );
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
    setAudioFile(null);
    setAudioLink(question?.audio ?? "");
    setAudioCues({
      startMs: question?.audioStartMs ?? 0,
      revealMs: question?.audioRevealMs ?? null,
    });
    if (audioInputRef.current) audioInputRef.current.value = "";
    setAudioPlayOn(question?.audioPlayOn ?? "quiz");
  }, [question, initialType, reset]);

  useEffect(() => {
    if (!audioFile) {
      setAudioPreview(null);
      return;
    }
    const url = URL.createObjectURL(audioFile);
    setAudioPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [audioFile]);

  function removeAudio() {
    setAudioFile(null);
    setAudioLink("");
    setAudioCues({ startMs: 0, revealMs: null });
    if (audioInputRef.current) audioInputRef.current.value = "";
  }

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

  // Which button submitted a new question: "Done + Next" keeps the dialog open.
  const addNextRef = useRef(false);

  const onSubmit = handleSubmit((data) => {
    const fd = new FormData();
    fd.append("title", data.title.trim());
    fd.append("type", data.type);
    fd.append("config", JSON.stringify(configFor(data)));
    fd.append(
      "options",
      JSON.stringify(
        data.type === "type_answer"
          ? data.options
              .map((o) => ({ title: o.title.trim(), isCorrect: true }))
              .filter((o) => o.title !== "")
              .slice(0, MAX_ACCEPTED_ANSWERS)
          : OPTION_TYPES.includes(data.type) && data.type !== "true_false"
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
    if (audioFile) fd.append("audio", audioFile);
    else if (audioLink) fd.append("audio_link", audioLink);
    if (audioFile || audioLink) {
      fd.append("audio_start_ms", String(audioCues.startMs));
      if (audioCues.revealMs !== null) {
        fd.append("audio_reveal_ms", String(audioCues.revealMs));
      }
      if (audioPlayOn !== "quiz") fd.append("audio_play_on", audioPlayOn);
    }

    mutation.mutate(fd, {
      onSuccess: () => {
        toast.success(question?.id ? "Question updated" : "Question added");
        if (question?.id || !addNextRef.current) {
          props.onDone?.();
        } else {
          // Stay on the same type, ready for the next one.
          reset(valuesFor(undefined, data.type));
          setCustomTime(false);
          deleteFile();
          removeAudio();
        }
      },
      onError: (err) => {
        toast.error(getApiErrorMessage(err));
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
                    "flex items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed px-4 py-3 cursor-pointer transition-colors border-lprimary/25 dark:border-white/15 hover:border-dprimary bg-light-bg dark:bg-card-dark",
                  )}
                >
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
            <div className="mt-3 flex flex-col gap-2">
              <span className={fieldLabelClass}>
                Sound
                <span className={counterClass}>
                  Optional · plays on the host&apos;s screen
                </span>
              </span>
              {audioPreview || audioLink ? (
                <AudioCueEditor
                  src={audioPreview ?? audioLink}
                  name={audioFile?.name ?? "Current sound"}
                  questionMs={
                    (Number(values.time) || DEFAULT_QUESTION_TIMEOUT) * 1000
                  }
                  startMs={audioCues.startMs}
                  revealMs={audioCues.revealMs}
                  onChange={setAudioCues}
                  onRemove={removeAudio}
                />
              ) : null}
              {audioPreview || audioLink ? (
                <label className="flex items-center gap-2 text-[13px]">
                  Plays on
                  <select
                    aria-label="Where the sound plays"
                    value={audioPlayOn}
                    onChange={(e) => setAudioPlayOn(e.target.value)}
                    className="w-44 rounded-lg border border-lprimary/20 dark:border-white/10 bg-transparent dark:bg-dark px-2 py-1"
                  >
                    <option value="quiz">Like the quiz</option>
                    <option value="host">Host&apos;s screen</option>
                    <option value="players">Players&apos; devices</option>
                    <option value="both">Both</option>
                    <option value="off">Off</option>
                  </select>
                </label>
              ) : (
                <label className="flex items-center gap-3.5 rounded-2xl border-[1.5px] border-dashed px-4 py-3 cursor-pointer transition-colors border-lprimary/25 dark:border-white/15 hover:border-dprimary bg-light-bg dark:bg-card-dark">
                  <span className="size-10 shrink-0 rounded-xl flex items-center justify-center bg-lprimary/10 dark:bg-white/5 text-lprimary dark:text-dprimary">
                    <LuMusic size={20} />
                  </span>
                  <span className="flex flex-col">
                    <span className="text-sm font-semibold">
                      Upload a sound
                    </span>
                    <span className={clsx("text-[12.5px]", mutedText)}>
                      MP3, WAV, OGG, FLAC or M4A under 20MB
                    </span>
                  </span>
                  <input
                    type="file"
                    accept="audio/*,.mp3,.wav,.ogg,.oga,.opus,.flac,.m4a,.aac,.webm"
                    name="audio"
                    className="sr-only"
                    ref={audioInputRef}
                    onChange={(e) => {
                      const f = e.target.files?.[0] ?? null;
                      setAudioFile(f);
                      setAudioCues({ startMs: 0, revealMs: null });
                    }}
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
                  // Poll and multiple choice can grow/shrink their options.
                  const resizable = isPoll || type === "multiple_choice";
                  const minOpts = isPoll ? MIN_POLL_OPTIONS : MIN_OPTIONS;
                  const maxOpts = isPoll ? MAX_POLL_OPTIONS : MAX_OPTIONS;
                  const multi = values.mcqMulti;
                  // Drag a row by its grip to move it; the letters follow
                  // the order, so the correct mark moves with its text.
                  const move = (from: number, to: number) => {
                    if (from === to) return;
                    const next = [...opts];
                    const [moved] = next.splice(from, 1);
                    next.splice(to, 0, moved!);
                    field.onChange(next);
                  };
                  return (
                    <div className="flex flex-col gap-2">
                      <span className={fieldLabelClass}>
                        Options
                        <span className="flex items-center gap-2">
                          <span className={counterClass}>
                            {isPoll
                              ? "No correct answer"
                              : multi
                                ? "Tap letters to mark the correct ones"
                                : "Tap a letter to mark it correct"}
                          </span>
                          <button
                            type="button"
                            onClick={() => field.onChange(shuffled(opts))}
                            title="Put the options in a random order"
                            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-lprimary dark:text-dprimary hover:bg-lprimary/10 dark:hover:bg-dprimary/10 cursor-pointer"
                          >
                            <LuShuffle size={14} />
                            Shuffle
                          </button>
                        </span>
                      </span>
                      <DragDropContext
                        onDragEnd={(r) => {
                          if (r.destination) {
                            move(r.source.index, r.destination.index);
                          }
                        }}
                      >
                        <Droppable droppableId="options">
                          {(drop) => (
                            <div
                              ref={drop.innerRef}
                              {...drop.droppableProps}
                              role={
                                isPoll
                                  ? undefined
                                  : multi
                                    ? "group"
                                    : "radiogroup"
                              }
                              aria-label={
                                isPoll ? undefined : "Correct answers"
                              }
                              // Rows carry their gap as a margin (the drag
                              // measures it); the last one's is taken back.
                              className="flex flex-col -mb-2"
                            >
                              {opts.map((o, i) => {
                                const isCorrect = !isPoll && o.isCorrect;
                                return (
                                  <Draggable
                                    key={i}
                                    draggableId={`option-${i}`}
                                    index={i}
                                  >
                                    {(drag, snapshot) => (
                                      <div
                                        ref={drag.innerRef}
                                        {...drag.draggableProps}
                                        className={clsx(
                                          "mb-2 flex items-center gap-2.5 rounded-[14px] border-[1.5px] p-1.5 pl-1 pr-3 transition-colors",
                                          snapshot.isDragging &&
                                            "shadow-[0_12px_28px_-16px_rgba(0,0,0,0.5)]",
                                          isCorrect
                                            ? "border-green-500 bg-green-500/8"
                                            : titleError(i)
                                              ? "border-red-light dark:border-red-dark bg-light-bg dark:bg-card-dark"
                                              : "border-lprimary/15 dark:border-white/10 bg-light-bg dark:bg-card-dark focus-within:border-dprimary",
                                          snapshot.isDragging &&
                                            !isCorrect &&
                                            "border-lprimary dark:border-dprimary",
                                        )}
                                      >
                                        <span
                                          {...drag.dragHandleProps}
                                          aria-label={`Move option ${OPTION_KEYS[i]!}`}
                                          className="shrink-0 -mr-1 cursor-grab text-[#8a8896] dark:text-muted-dark"
                                        >
                                          <LuGripVertical size={18} />
                                        </span>
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
                                            aria-label={`Mark option ${OPTION_KEYS[i]!} correct`}
                                            onClick={() =>
                                              multi
                                                ? update(i, {
                                                    isCorrect: !o.isCorrect,
                                                  })
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
                                                <LuCheck
                                                  size={10}
                                                  strokeWidth={3.5}
                                                />
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
                                          placeholder={`Option ${OPTION_KEYS[i]!}`}
                                          aria-label={`Option ${OPTION_KEYS[i]!}`}
                                          className="flex-1 min-w-0 bg-transparent outline-none py-1.5 text-[15px] font-medium placeholder:text-[#8a8896] dark:placeholder:text-muted-dark"
                                        />
                                        {resizable && opts.length > minOpts && (
                                          <button
                                            type="button"
                                            aria-label={`Remove option ${OPTION_KEYS[i]!}`}
                                            onClick={() => {
                                              const rest = opts.filter(
                                                (_, j) => j !== i,
                                              );
                                              // Single choice must keep one correct option.
                                              field.onChange(
                                                !isPoll && !multi
                                                  ? singleCorrect(rest)
                                                  : rest,
                                              );
                                            }}
                                            className="shrink-0 text-[#8a8896] dark:text-muted-dark hover:text-[#e5544e] cursor-pointer"
                                          >
                                            <LuX size={16} />
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}
                              {drop.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                      {resizable && opts.length < maxOpts && (
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

            {type === "type_answer" && (
              <Controller
                name="options"
                control={control}
                render={({ field }) => {
                  const fixed = values.fixedLength;
                  const rows = field.value;
                  const set = (next: AuthoredOption[]) => field.onChange(next);
                  const filled = rows.filter((o) => o.title.trim());
                  const pattern =
                    fixed && filled[0] ? answerPattern(filled[0].title) : null;
                  // Fixed length: every answer must fit the same boxes.
                  const misfit =
                    pattern !== null &&
                    filled.some(
                      (o) =>
                        answerPattern(o.title).join(" ") !== pattern.join(" "),
                    );
                  return (
                    <div className="flex flex-col gap-2">
                      <span className={fieldLabelClass}>
                        Accepted answers
                        <span className={counterClass}>
                          {fixed
                            ? `${rows.length} / ${MAX_ACCEPTED_ANSWERS} · same length each, players see one box per letter`
                            : `${rows.length} / ${MAX_ACCEPTED_ANSWERS} · case and accents don't matter`}
                        </span>
                      </span>
                      {rows.map((o, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2.5 rounded-[14px] border-[1.5px] p-1.5 pl-3 pr-3 border-green-500 bg-green-500/8"
                        >
                          <LuCheck
                            size={16}
                            strokeWidth={3}
                            className="shrink-0 text-green-600 dark:text-green-500"
                          />
                          <input
                            type="text"
                            value={o.title}
                            onChange={(e) =>
                              set(
                                rows.map((x, j) =>
                                  j === i
                                    ? { title: e.target.value, isCorrect: true }
                                    : x,
                                ),
                              )
                            }
                            maxLength={TYPE_ANSWER_MAX_LENGTH}
                            autoComplete="off"
                            placeholder={
                              i === 0 ? "The answer" : "Also accepted"
                            }
                            aria-label={`Accepted answer ${i + 1}`}
                            className="flex-1 min-w-0 bg-transparent outline-none py-1.5 text-[15px] font-medium placeholder:text-[#8a8896] dark:placeholder:text-muted-dark"
                          />
                          {rows.length > 1 && (
                            <button
                              type="button"
                              aria-label={`Remove accepted answer ${i + 1}`}
                              onClick={() =>
                                set(rows.filter((_, j) => j !== i))
                              }
                              className="shrink-0 text-[#8a8896] dark:text-muted-dark hover:text-[#e5544e] cursor-pointer"
                            >
                              <LuX size={16} />
                            </button>
                          )}
                        </div>
                      ))}
                      {pattern && (
                        <p
                          aria-label="What players see"
                          className="font-mono text-lg font-bold tracking-[0.25em] text-center py-1"
                        >
                          {pattern.map((n) => "_".repeat(n)).join(" ")}
                        </p>
                      )}
                      {misfit && (
                        <span className="text-xs text-red-light dark:text-red-dark">
                          All answers need the same length per word as the first
                          ({pattern!.join(" + ")} letters).
                        </span>
                      )}
                      {rows.length < MAX_ACCEPTED_ANSWERS && (
                        <button
                          type="button"
                          onClick={() =>
                            set([...rows, { title: "", isCorrect: true }])
                          }
                          className="flex items-center justify-center gap-2 rounded-[14px] border-[1.5px] border-dashed border-lprimary/25 dark:border-white/15 p-2.5 text-sm font-bold text-lprimary dark:text-dprimary cursor-pointer hover:border-dprimary"
                        >
                          <LuPlus size={16} />
                          Add accepted answer
                        </button>
                      )}
                      {optionsError && (
                        <span className="text-xs text-red-light dark:text-red-dark">
                          {optionsError}
                        </span>
                      )}
                      <div className={settingsBoxClass}>
                        <SettingRow
                          label="Fixed length"
                          hint="Players see the answer's letters as boxes"
                        >
                          <Controller
                            name="fixedLength"
                            control={control}
                            render={({ field: f }) => (
                              <Switch
                                checked={f.value}
                                onCheckedChange={f.onChange}
                                aria-label="Fixed length"
                              />
                            )}
                          />
                        </SettingRow>
                        <SettingRow
                          label="Ignore typos"
                          hint="Close answers count, but score less"
                        >
                          <Controller
                            name="ignoreTypos"
                            control={control}
                            render={({ field: f }) => (
                              <Switch
                                checked={f.value}
                                onCheckedChange={f.onChange}
                                aria-label="Ignore typos"
                              />
                            )}
                          />
                        </SettingRow>
                      </div>
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
                const secs = Number(field.value) || 0;
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
                              clampTime(secs || range.fallback, type),
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
                          {isUnlimitedTime(secs) ? "∞" : secs}
                          {!isUnlimitedTime(secs) && (
                            <small
                              className={clsx(
                                "ml-[3px] text-[13px] font-semibold",
                                mutedText,
                              )}
                            >
                              sec
                            </small>
                          )}
                        </span>
                        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                          <RangeSlider
                            label="Seconds to answer"
                            min={range.min}
                            max={range.max + SLIDER_UNLIMITED_STEP}
                            value={
                              isUnlimitedTime(secs)
                                ? range.max + SLIDER_UNLIMITED_STEP
                                : clampTime(secs, type)
                            }
                            onChange={(v) =>
                              field.onChange(
                                v > range.max ? UNLIMITED_TIME_OUT : v,
                              )
                            }
                            ticks={[...range.ticks, "∞"]}
                          />
                          {isUnlimitedTime(secs) && (
                            <span className={clsx("text-xs", mutedText)}>
                              No time limit and no countdown: the question stays
                              open until everyone answered or you move on.
                            </span>
                          )}
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
        {question?.id ? (
          <button
            type="submit"
            disabled={mutation.isPending}
            className={clsx(primaryButtonClass, "px-[26px]")}
          >
            {mutation.isPending ? "Saving..." : "Save changes"}
          </button>
        ) : (
          <>
            <button
              type="submit"
              disabled={mutation.isPending}
              onClick={(e) => {
                // Nothing written yet (no question, no answers, no media):
                // "Done" just closes instead of failing validation.
                const blank =
                  !values.title?.trim() &&
                  !file &&
                  !fileLink &&
                  !audioFile &&
                  !audioLink &&
                  (values.type === "true_false" ||
                    (values.options ?? []).every((o) => !o.title.trim()));
                if (blank) {
                  e.preventDefault();
                  props.onDone?.();
                  return;
                }
                addNextRef.current = false;
              }}
              className="rounded-[14px] border-2 border-lprimary dark:border-dprimary px-[22px] py-3 font-bold text-lprimary dark:text-dprimary cursor-pointer hover:bg-lprimary/10 dark:hover:bg-dprimary/10 disabled:opacity-60"
            >
              Done
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              onClick={() => (addNextRef.current = true)}
              className={clsx(primaryButtonClass, "px-[26px]")}
            >
              {mutation.isPending ? "Saving…" : "Done + Next"}
            </button>
          </>
        )}
      </div>
    </form>
  );
};

export default AddQuesForm;
