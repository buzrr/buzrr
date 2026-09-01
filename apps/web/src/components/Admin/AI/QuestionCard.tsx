"use client";

import clsx from "clsx";
import { LuCheck, LuTrash2, LuUndo2 } from "react-icons/lu";
import CitationChip from "./CitationChip";
import { Badge } from "@/components/ui/Badge";
import type { GeneratedQuestion } from "@/lib/modules/ai/api";

export default function QuestionCard({
  question,
  index,
  onToggleDiscard,
  isBusy,
}: {
  question: GeneratedQuestion;
  index: number;
  onToggleDiscard: () => void;
  isBusy?: boolean;
}) {
  return (
    <article
      className={clsx(
        "rounded-xl p-4 bg-white dark:bg-card-dark transition-opacity",
        question.discarded && "opacity-50",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-black text-off-dark dark:text-off-white">
            Q{index + 1}
          </span>
          <Badge tone="info">
            {question.type === "MCQ" ? "Multiple choice" : "True / False"}
          </Badge>
          {question.difficulty && (
            <Badge tone="neutral">{question.difficulty}</Badge>
          )}
        </div>
        <button
          type="button"
          onClick={onToggleDiscard}
          disabled={isBusy}
          aria-label={
            question.discarded
              ? "Restore this question"
              : "Discard this question"
          }
          className="shrink-0 p-1.5 rounded-md text-off-dark dark:text-off-white hover:bg-card-light dark:hover:bg-dark transition-colors disabled:opacity-50"
        >
          {question.discarded ? <LuUndo2 size={16} /> : <LuTrash2 size={16} />}
        </button>
      </div>

      <p className="mt-2 font-bold text-dark dark:text-white">
        {question.stem}
      </p>

      <ul className="mt-3 grid gap-1.5 sm:grid-cols-2">
        {question.options.map((option) => (
          <li
            key={option.title}
            className={clsx(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
              option.isCorrect
                ? "bg-[#20A97C]/15 text-dark dark:text-white font-bold"
                : "bg-card-light dark:bg-dark text-off-dark dark:text-off-white",
            )}
          >
            {option.isCorrect && (
              <LuCheck
                size={14}
                className="shrink-0 text-[#20A97C]"
                aria-label="Correct"
              />
            )}
            <span className="min-w-0 break-words">{option.title}</span>
          </li>
        ))}
      </ul>

      {question.explanation && (
        <p className="mt-3 text-xs text-off-dark dark:text-off-white">
          {question.explanation}
        </p>
      )}

      {question.citations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {question.citations.map((citation, i) => (
            <CitationChip
              key={`${citation.documentId}-${i}`}
              citation={citation}
            />
          ))}
        </div>
      )}
    </article>
  );
}
