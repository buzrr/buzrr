"use client";

import clsx from "clsx";
import { useState } from "react";
import { mutedText } from "@/components/Game/GameUI";
import { ChoiceList, SubmitButton, toggleChoice } from "./Inputs";
import { OptionLabel } from "./MultipleChoice";
import type { QuestionRenderer } from "./types";
import { PollBars } from "./Visuals";

export const pollRenderer: QuestionRenderer<"poll"> = {
  AnswerInput({ question, selected, disabled, onSubmit }) {
    const [draft, setDraft] = useState<string[]>([]);
    const chosen = selected?.optionIds ?? draft;
    return (
      <>
        {question.multiSelect && (
          <p className={clsx("mt-3 text-sm font-medium", mutedText)}>
            Pick as many as you like.
          </p>
        )}
        <ChoiceList
          options={question.options}
          multi={question.multiSelect}
          chosen={chosen}
          disabled={disabled}
          onToggle={(id) =>
            setDraft((d) => toggleChoice(d, id, question.multiSelect))
          }
        />
        {!selected && (
          <SubmitButton
            disabled={disabled || draft.length === 0}
            onClick={() => onSubmit({ optionIds: draft })}
          >
            Submit vote
          </SubmitButton>
        )}
      </>
    );
  },

  HostPrompt({ question, live }) {
    return (
      <PollBars
        options={question.options}
        counts={live?.counts ?? question.options.map(() => 0)}
        responses={live?.responses ?? 0}
      />
    );
  },

  RevealBreakdown({ question, summary }) {
    return (
      <PollBars
        options={question.options}
        counts={summary.counts}
        responses={summary.responses}
      />
    );
  },

  revealStats(_question, { responses }) {
    return { responses, correct: 0 };
  },

  describeAnswer(question, answer) {
    const labels = question.options.flatMap((option, index) =>
      answer.optionIds.includes(option.id)
        ? [
            <span key={option.id} className="flex items-center gap-3.5">
              <OptionLabel index={index} title={option.title} />
            </span>,
          ]
        : [],
    );
    if (labels.length === 0) return null;
    return <div className="flex flex-col gap-2.5">{labels}</div>;
  },

  correctAnswers() {
    return [];
  },
};
