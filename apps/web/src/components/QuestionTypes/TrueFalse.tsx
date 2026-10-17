"use client";

import clsx from "clsx";
import { LuCheck, LuX } from "react-icons/lu";
import { subtleCardClass } from "@/components/Game/GameUI";
import { OptionsReveal } from "./MultipleChoice";
import type { QuestionRenderer } from "./types";

/** "True" gets the check, "False" the cross — by position, as authored. */
function TruthKey({ index, className }: { index: number; className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "shrink-0 flex items-center justify-center rounded-xl text-white",
        index === 0 ? "bg-[#2f9e6a]" : "bg-[#e5544e]",
        className,
      )}
    >
      {index === 0 ? (
        <LuCheck size={20} strokeWidth={3} />
      ) : (
        <LuX size={20} strokeWidth={3} />
      )}
    </span>
  );
}

function TruthLabel({ index, title }: { index: number; title: string }) {
  return (
    <>
      <TruthKey index={index} className="size-9" />
      <span>{title}</span>
    </>
  );
}

const cardClass =
  "flex items-center gap-4 rounded-[18px] border-[1.5px] px-4 py-4 md:px-[22px] md:py-6 min-h-16 md:min-h-[110px] text-xl md:text-[26px] font-bold";

export const trueFalseRenderer: QuestionRenderer<"true_false"> = {
  AnswerInput({ question, selected, disabled, onSubmit }) {
    return (
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-3.5 mt-4 md:mt-7">
        {question.options.map((option, index) => {
          const picked = option.id === selected?.optionId;
          return (
            <button
              key={option.id}
              type="button"
              disabled={disabled}
              aria-pressed={picked}
              onClick={() => {
                if (!disabled) onSubmit({ optionId: option.id });
              }}
              className={clsx(
                cardClass,
                "text-left transition-all duration-150",
                picked
                  ? "border-lprimary dark:border-dprimary bg-lprimary/10 dark:bg-dprimary/15 shadow-[0_10px_24px_-14px_#7c4ddb] animate-pop"
                  : subtleCardClass,
                !disabled &&
                  "cursor-pointer hover:border-dprimary hover:-translate-y-0.5 active:scale-[0.98]",
                disabled && !picked && "opacity-50 cursor-default",
              )}
            >
              <TruthKey index={index} className="size-11 md:size-14" />
              {option.title}
            </button>
          );
        })}
      </div>
    );
  },

  HostPrompt({ question }) {
    return (
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-7">
        {question.options.map((option, index) => (
          <div key={option.id} className={clsx(cardClass, subtleCardClass)}>
            <TruthKey index={index} className="size-11 md:size-14" />
            {option.title}
          </div>
        ))}
      </div>
    );
  },

  RevealBreakdown({ question, summary, hideCorrect }) {
    return (
      <OptionsReveal
        options={question.options}
        counts={summary.counts}
        correctOptionIds={hideCorrect ? [] : summary.correctOptionIds}
        renderKey={() => null}
      />
    );
  },

  revealStats(_question, { responses, correct }) {
    return { responses, correct };
  },

  describeAnswer(question, answer) {
    const index = question.options.findIndex((o) => o.id === answer.optionId);
    const option = question.options[index];
    return option ? <TruthLabel index={index} title={option.title} /> : null;
  },

  correctAnswers(question, summary) {
    return question.options.flatMap((option, index) =>
      summary.correctOptionIds.includes(option.id)
        ? [<TruthLabel key={option.id} index={index} title={option.title} />]
        : [],
    );
  },
};
