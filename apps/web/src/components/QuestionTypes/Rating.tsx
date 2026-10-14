"use client";

import clsx from "clsx";
import { useState } from "react";
import { ratingMax } from "@buzrr/contract";
import { mutedText, subtleCardClass } from "@/components/Game/GameUI";
import { SubmitButton } from "./Inputs";
import type { QuestionRenderer } from "./types";
import { RatingView, Star } from "./Visuals";

export const ratingRenderer: QuestionRenderer<"rating"> = {
  AnswerInput({ question, selected, disabled, onSubmit }) {
    const [draft, setDraft] = useState<number | null>(null);
    const value = selected?.value ?? draft;
    const max = ratingMax(question.scale);
    const stars = question.scale === "stars";
    return (
      <>
        <div
          role="radiogroup"
          className={clsx(
            "grid grid-cols-5 gap-[7px] md:gap-2.5 mt-4 md:mt-7",
            stars && "max-w-[520px] w-full mx-auto",
          )}
        >
          {Array.from({ length: max }, (_, i) => i + 1).map((k) => {
            const on = stars ? value !== null && k <= value : value === k;
            return (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={value === k}
                aria-label={stars ? `${k} star${k === 1 ? "" : "s"}` : `${k}`}
                disabled={disabled || Boolean(selected)}
                onClick={() => setDraft(k)}
                className={clsx(
                  "aspect-square rounded-xl md:rounded-2xl border-[1.5px] flex items-center justify-center text-xl md:text-[26px] font-extrabold transition-colors",
                  stars
                    ? clsx(
                        "border-transparent bg-transparent",
                        on
                          ? "text-[#e0a020]"
                          : "text-lprimary/25 dark:text-white/20",
                      )
                    : on
                      ? "bg-lprimary dark:bg-dprimary border-lprimary dark:border-dprimary text-white"
                      : subtleCardClass,
                  !disabled &&
                    !selected &&
                    "cursor-pointer hover:border-dprimary",
                )}
              >
                {stars ? (
                  <svg
                    viewBox="0 0 24 24"
                    className="size-4/5"
                    aria-hidden="true"
                  >
                    <path
                      d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z"
                      fill="currentColor"
                    />
                  </svg>
                ) : (
                  k
                )}
              </button>
            );
          })}
        </div>
        {(question.lowLabel || question.highLabel) && (
          <div
            className={clsx(
              "flex justify-between gap-4 mt-2.5 text-[13.5px] font-semibold",
              mutedText,
            )}
          >
            <span>{question.lowLabel}</span>
            <span className="text-right">{question.highLabel}</span>
          </div>
        )}
        {!selected && (
          <SubmitButton
            disabled={disabled || draft === null}
            onClick={() => {
              if (draft !== null) onSubmit({ value: draft });
            }}
          />
        )}
      </>
    );
  },

  HostPrompt({ live }) {
    return (
      <RatingView
        counts={live?.counts ?? []}
        responses={live?.responses ?? 0}
      />
    );
  },

  RevealBreakdown({ summary }) {
    return <RatingView counts={summary.counts} responses={summary.responses} />;
  },

  revealStats(_question, { responses }) {
    return { responses, correct: 0 };
  },

  describeAnswer(question, answer) {
    if (question.scale === "stars") {
      return (
        <span className="flex gap-1 text-[#e0a020]">
          {[1, 2, 3, 4, 5].map((k) => (
            <Star key={k} filled={k <= answer.value} size={22} />
          ))}
        </span>
      );
    }
    return (
      <span>
        {answer.value}{" "}
        <span className={mutedText}>/ {ratingMax(question.scale)}</span>
      </span>
    );
  },

  correctAnswers() {
    return [];
  },
};
