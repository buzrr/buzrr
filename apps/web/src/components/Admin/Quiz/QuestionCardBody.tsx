"use client";

import clsx from "clsx";
import {
  isQuestionType,
  openText,
  rating,
  ratingMax,
  wordCloud,
  type QuestionType,
} from "@buzrr/contract";
import { OptionKey, mutedText } from "@/components/Game/GameUI";
import { useT, tx, pl } from "@/lib/i18n/context";
import {
  QUESTION_TYPE_META,
  QuestionTypeIcon,
} from "@/components/QuestionTypes";

interface CardQuestion {
  type: string;
  config: unknown;
  options?: { title?: string; isCorrect?: boolean }[];
}

/** Rows written before `type` existed are multiple choice. */
export function cardType(q: CardQuestion): QuestionType {
  return isQuestionType(q.type) ? q.type : "multiple_choice";
}

/** The type tag shown beside the time on a question card. */
export function QuestionTypeTag({ type }: { type: QuestionType }) {
  return (
    <span className="shrink-0 inline-flex items-center gap-1.5 whitespace-nowrap rounded-[9px] px-3 py-1.5 text-[13px] font-bold bg-lprimary/10 dark:bg-white/5 text-lprimary dark:text-dprimary">
      <QuestionTypeIcon type={type} size={14} />
      {tx(QUESTION_TYPE_META[type].name)}
    </span>
  );
}

const dashClass = clsx(
  "flex flex-wrap items-center gap-2 rounded-xl border-[1.5px] border-dashed border-lprimary/20 dark:border-white/10 p-3.5 text-sm",
  mutedText,
);
const chipClass =
  "rounded-full px-3 py-1 text-[13px] font-bold bg-lprimary/10 dark:bg-white/5 text-lprimary dark:text-dprimary";

function configOf<T>(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  config: unknown,
  fallback: T,
): T {
  const parsed = schema.safeParse(config ?? {});
  return parsed.success && parsed.data ? parsed.data : fallback;
}

/** What a question card shows under its title, by type. */
export default function QuestionCardBody({
  question,
}: {
  question: CardQuestion;
}) {
  const t = useT();
  const type = cardType(question);
  const options = question.options ?? [];

  if (type === "multiple_choice" || type === "true_false") {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
        {options.map((op, opIndex) => (
          <p
            key={opIndex}
            className={clsx(
              "flex items-center gap-[11px] rounded-xl border-[1.5px] px-3.5 py-3 text-[14.5px] wrap-break-word min-w-0",
              op.isCorrect
                ? "font-semibold border-lprimary dark:border-dprimary bg-lprimary/10 dark:bg-dprimary/15"
                : "font-medium border-lprimary/15 dark:border-white/10",
            )}
          >
            <span
              aria-hidden="true"
              className={clsx(
                "relative size-5 shrink-0 rounded-full border-2",
                op.isCorrect
                  ? "border-lprimary dark:border-dprimary after:absolute after:inset-[3px] after:rounded-full after:bg-lprimary dark:after:bg-dprimary"
                  : "border-[#8a8896] dark:border-off-dark",
              )}
            />
            <span className="min-w-0">{op.title}</span>
            {op.isCorrect && <span className="sr-only">{t("(correct)")}</span>}
          </p>
        ))}
      </div>
    );
  }

  if (type === "poll") {
    return (
      <>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {options.map((op, opIndex) => (
            <p
              key={opIndex}
              className="flex items-center gap-3 rounded-xl border-[1.5px] px-3.5 py-3 text-[14.5px] font-medium wrap-break-word min-w-0 border-lprimary/15 dark:border-white/10"
            >
              <OptionKey
                index={opIndex}
                className="size-[22px] rounded-md text-[11px]"
              />
              <span className="min-w-0">{op.title}</span>
            </p>
          ))}
        </div>
        <p className={clsx("mt-3 text-[13px]", mutedText)}>
          {t("No correct answer · votes shown live")}
        </p>
      </>
    );
  }

  if (type === "word_cloud") {
    const { maxAnswers, multipleSubmissions } = configOf(
      wordCloud.config,
      question.config,
      { maxAnswers: 3, maxLength: 20 as const, multipleSubmissions: false },
    );
    return (
      <div className={dashClass}>
        {multipleSubmissions
          ? t("Players send words one at a time, as many as they like")
          : tx(
              pl(
                maxAnswers,
                "Players type up to {n} word",
                "Players type up to {n} words",
              ),
              { n: maxAnswers },
            )}
        <span className={chipClass}>{t("word")}</span>
        <span className={chipClass}>…</span>
      </div>
    );
  }

  if (type === "rating") {
    const cfg = configOf(rating.config, question.config, {
      scale: "5" as const,
      lowLabel: t("Not at all"),
      highLabel: "Very",
    });
    const max = ratingMax(cfg.scale);
    return (
      <div className="flex flex-wrap items-center gap-2">
        {cfg.lowLabel && (
          <small className={clsx("text-[12.5px]", mutedText)}>
            {cfg.lowLabel}
          </small>
        )}
        {Array.from({ length: max }, (_, i) => (
          <i
            key={i}
            className="not-italic size-9 md:size-10 rounded-[10px] border-[1.5px] border-lprimary/15 dark:border-white/10 flex items-center justify-center font-bold text-sm"
          >
            {cfg.scale === "stars" ? "★" : i + 1}
          </i>
        ))}
        {cfg.highLabel && (
          <small className={clsx("text-[12.5px]", mutedText)}>
            {cfg.highLabel}
          </small>
        )}
      </div>
    );
  }

  const cfg = configOf(openText.config, question.config, {
    maxLength: 200 as const,
    allowAnonymous: true,
    multipleSubmissions: false,
  });
  return (
    <div className={dashClass}>
      {t("Free text · up to {n} characters", { n: cfg.maxLength })}
      {cfg.allowAnonymous ? ` · ${t("anonymous allowed")}` : ""}
      {cfg.multipleSubmissions ? ` · ${t("multiple answers")}` : ""}
    </div>
  );
}
