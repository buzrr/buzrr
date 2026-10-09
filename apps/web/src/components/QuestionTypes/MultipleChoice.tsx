"use client";

import clsx from "clsx";
import { LuCheck } from "react-icons/lu";
import {
  OPTION_KEYS,
  OptionKey,
  mutedText,
  subtleCardClass,
} from "@/components/Game/GameUI";
import { Tooltip } from "@/components/ui/Tooltip";
import { AnimatedNumber, useEntered } from "@/components/Game/motion";
import type { QuestionRenderer } from "./types";

function OptionLabel({ index, title }: { index: number; title: string }) {
  return (
    <>
      <OptionKey index={index} className="size-9 text-base" />
      <span className="min-w-0 wrap-break-word">{title}</span>
    </>
  );
}

const BAR_MS = 900;

/** A reveal bar that grows from empty, its percentage counting up alongside. */
function ResultBar({
  fill,
  pct,
  correct,
  delayMs,
}: {
  /** 0–1, relative to the most-picked option. */
  fill: number;
  pct: number;
  correct: boolean;
  delayMs: number;
}) {
  const entered = useEntered();
  return (
    <div className="relative h-[38px] rounded-xl overflow-hidden bg-lprimary/8 dark:bg-white/5">
      <div
        className={clsx(
          "h-full rounded-xl transition-[width] ease-out motion-reduce:transition-none",
          correct ? "bg-green-500" : "bg-[#8a8896]/45 dark:bg-[#71717a]/45",
        )}
        style={{
          width: `${entered ? fill * 100 : 0}%`,
          transitionDuration: `${BAR_MS}ms`,
          transitionDelay: `${delayMs}ms`,
        }}
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13.5px] font-bold tabular-nums">
        <AnimatedNumber
          value={entered ? pct : 0}
          from={0}
          duration={BAR_MS}
          delay={delayMs}
        />
        %
      </span>
    </div>
  );
}

/** Steps option text down as the longest option grows, so four still fit. */
function optionTextClass(options: { title: string }[]) {
  const longest = Math.max(0, ...options.map((o) => o.title.length));
  if (longest > 80) return "text-[15px] md:text-base";
  if (longest > 40) return "text-base md:text-lg";
  return "text-[17px] md:text-xl";
}

export const multipleChoiceRenderer: QuestionRenderer<"multiple_choice"> = {
  AnswerInput({ question, selected, disabled, onSubmit }) {
    const textClass = optionTextClass(question.options);
    return (
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 md:auto-rows-fr gap-2.5 md:gap-3.5 mt-4 md:mt-7">
        {question.options.map((option, index) => {
          const picked = option.id === selected?.optionId;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (!disabled) onSubmit({ optionId: option.id });
              }}
              aria-pressed={picked}
              className={clsx(
                "flex items-center gap-4 rounded-[18px] border-[1.5px] px-3.5 py-2.5 md:px-[22px] md:py-[18px] min-h-14 md:min-h-[84px] font-semibold leading-snug text-left text-pretty wrap-break-word min-w-0 transition-all duration-150",
                textClass,
                picked
                  ? "border-lprimary dark:border-dprimary bg-lprimary/10 dark:bg-dprimary/15 shadow-[0_10px_24px_-14px_#7c4ddb] animate-pop"
                  : subtleCardClass,
                !disabled &&
                  "cursor-pointer hover:border-dprimary hover:-translate-y-0.5 active:scale-[0.98]",
                disabled && !picked && "opacity-50 cursor-default",
              )}
            >
              <OptionKey index={index} className="size-9 md:size-11 text-lg" />
              <span className="min-w-0">{option.title}</span>
            </button>
          );
        })}
      </div>
    );
  },

  HostPrompt({ question }) {
    // Rows size to their content; the panel scrolls if it ever overflows.
    return (
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 md:auto-rows-fr gap-3.5 mt-7">
        {question.options.map((opt, index) => (
          <div
            key={opt.id}
            className={clsx(
              "flex items-center gap-4 rounded-[18px] border-[1.5px] px-4 py-3.5 md:px-[22px] md:py-[18px] min-h-16 md:min-h-[84px] font-semibold leading-snug text-pretty wrap-break-word min-w-0",
              optionTextClass(question.options),
              subtleCardClass,
            )}
          >
            <OptionKey index={index} className="size-10 md:size-11 text-lg" />
            <span className="min-w-0">{opt.title}</span>
          </div>
        ))}
      </div>
    );
  },

  RevealBreakdown({ question, summary }) {
    const { counts, correctOptionIds } = summary;
    const responses = counts.reduce((sum, c) => sum + c, 0);
    const maxCount = Math.max(1, ...counts);
    return (
      <div className="flex-1 flex flex-col justify-center gap-3.5">
        {question.options.map((opt, i) => {
          const count = counts[i] ?? 0;
          const ok = correctOptionIds.includes(opt.id);
          const pct = responses > 0 ? Math.round((count / responses) * 100) : 0;
          return (
            <div key={opt.id} className="flex flex-col gap-[7px]">
              <div
                className={clsx(
                  "flex items-center gap-2.5 text-[15px] font-semibold",
                  ok && "text-green-600 dark:text-green-500",
                )}
              >
                <Tooltip
                  content={opt.title}
                  onlyWhenTruncated
                  className="flex-1 min-w-0 truncate"
                >
                  {OPTION_KEYS[i]}. {opt.title}
                </Tooltip>
                {ok && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-green-500 px-2 py-0.5 text-[11.5px] font-bold tracking-[0.04em] uppercase text-white">
                    <LuCheck size={13} strokeWidth={3} />
                    Correct
                  </span>
                )}
                <span className={clsx("text-sm font-medium", mutedText)}>
                  {count} {count === 1 ? "vote" : "votes"}
                </span>
              </div>
              <ResultBar
                fill={count / maxCount}
                pct={pct}
                correct={ok}
                delayMs={i * 90}
              />
            </div>
          );
        })}
      </div>
    );
  },

  revealStats(question, { counts, correctOptionIds }) {
    return {
      responses: counts.reduce((sum, c) => sum + c, 0),
      correct: question.options.reduce(
        (sum, o, i) =>
          sum + (correctOptionIds.includes(o.id) ? (counts[i] ?? 0) : 0),
        0,
      ),
    };
  },

  describeAnswer(question, answer) {
    const index = question.options.findIndex((o) => o.id === answer.optionId);
    const option = question.options[index];
    return option ? <OptionLabel index={index} title={option.title} /> : null;
  },

  correctAnswers(question, summary) {
    return question.options.flatMap((option, index) =>
      summary.correctOptionIds.includes(option.id)
        ? [<OptionLabel key={option.id} index={index} title={option.title} />]
        : [],
    );
  },
};
