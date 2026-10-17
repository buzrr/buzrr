"use client";

import clsx from "clsx";
import { LuCheck, LuX } from "react-icons/lu";
import { subtleCardClass } from "@/components/Game/GameUI";
import { OptionsReveal } from "./MultipleChoice";
import type { QuestionRenderer } from "./types";

/** The two fixed answers, "True" first; questions carry no options. */
const TRUTHS = [
  { id: "true", value: true, title: "True" },
  { id: "false", value: false, title: "False" },
] as const;

const titleOf = (value: boolean) => (value ? "True" : "False");

/** "True" gets the check, "False" the cross. */
function TruthKey({
  truth,
  className,
}: {
  truth: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "shrink-0 flex items-center justify-center rounded-xl text-white",
        truth ? "bg-[#2f9e6a]" : "bg-[#e5544e]",
        className,
      )}
    >
      {truth ? (
        <LuCheck size={20} strokeWidth={3} />
      ) : (
        <LuX size={20} strokeWidth={3} />
      )}
    </span>
  );
}

function TruthLabel({ value }: { value: boolean }) {
  return (
    <>
      <TruthKey truth={value} className="size-9" />
      <span>{titleOf(value)}</span>
    </>
  );
}

const cardClass =
  "flex items-center gap-4 rounded-[18px] border-[1.5px] px-4 py-4 md:px-[22px] md:py-6 min-h-16 md:min-h-[110px] text-xl md:text-[26px] font-bold";

export const trueFalseRenderer: QuestionRenderer<"true_false"> = {
  AnswerInput({ selected, disabled, onSubmit }) {
    return (
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2.5 md:gap-3.5 mt-4 md:mt-7">
        {TRUTHS.map((truth) => {
          const picked = truth.value === selected?.value;
          return (
            <button
              key={truth.id}
              type="button"
              disabled={disabled}
              aria-pressed={picked}
              onClick={() => {
                if (!disabled) onSubmit({ value: truth.value });
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
              <TruthKey truth={truth.value} className="size-11 md:size-14" />
              {truth.title}
            </button>
          );
        })}
      </div>
    );
  },

  HostPrompt() {
    return (
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3.5 mt-7">
        {TRUTHS.map((truth) => (
          <div key={truth.id} className={clsx(cardClass, subtleCardClass)}>
            <TruthKey truth={truth.value} className="size-11 md:size-14" />
            {truth.title}
          </div>
        ))}
      </div>
    );
  },

  RevealBreakdown({ summary }) {
    return (
      <OptionsReveal
        options={[...TRUTHS]}
        counts={[summary.trueCount, summary.falseCount]}
        correctOptionIds={[String(summary.answer)]}
        renderKey={() => null}
      />
    );
  },

  revealStats(_question, { responses, correct }) {
    return { responses, correct };
  },

  describeAnswer(_question, answer) {
    return <TruthLabel value={answer.value} />;
  },

  correctAnswers(_question, summary) {
    return [<TruthLabel key="answer" value={summary.answer} />];
  },
};
