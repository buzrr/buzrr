"use client";

import clsx from "clsx";
import Image from "next/image";
import { useMemo, useState } from "react";
import { LuCheck, LuClock, LuUsers } from "react-icons/lu";
import type { QuestionStats } from "@buzrr/contract";
import { QuestionTypePill } from "@/components/QuestionTypes";
import Segmented from "@/components/ui/Segmented";
import { commonWrongAnswer, correctRate, ratingAverage } from "./stats";

type Order = "quiz" | "hardest";

/** How each question went: right answers, time, what was picked. */
export default function QuestionStatsList({
  questions,
}: {
  questions: QuestionStats[];
}) {
  const [order, setOrder] = useState<Order>("quiz");
  const sorted = useMemo(() => {
    if (order === "quiz") return questions;
    // Hardest first; unscored questions (no rate) at the end.
    return [...questions].sort(
      (a, b) => (correctRate(a) ?? 2) - (correctRate(b) ?? 2),
    );
  }, [questions, order]);

  if (questions.length === 0) {
    return (
      <div className="border border-gray border-dashed rounded-lg p-6 text-center text-dark dark:text-white">
        Question statistics are kept for games from now on.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="self-end">
        <Segmented<Order>
          label="Order"
          value={order}
          onChange={setOrder}
          options={[
            { value: "quiz", label: "Quiz order" },
            { value: "hardest", label: "Hardest first" },
          ]}
        />
      </div>
      {sorted.map((q) => (
        <QuestionCard key={q.index} q={q} />
      ))}
    </div>
  );
}

function QuestionCard({ q }: { q: QuestionStats }) {
  const rate = correctRate(q);
  const wrong = commonWrongAnswer(q);
  return (
    <div className="rounded-xl shadow bg-white dark:bg-card-dark text-dark dark:text-white p-4 flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="font-black text-lg text-lprimary dark:text-dprimary shrink-0">
          {q.index + 1}.
        </span>
        <div className="min-w-0 flex-1 flex flex-col gap-1.5">
          <QuestionTypePill
            type={q.type}
            className="!text-[11px] !px-2 !py-1"
          />
          <p className="font-bold break-words">{q.title}</p>
        </div>
        {q.image && (
          <Image
            src={q.image}
            alt=""
            width={64}
            height={64}
            className="size-16 rounded-lg object-cover shrink-0"
          />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-off-dark dark:text-off-white">
        {rate !== null && (
          <span
            className={clsx(
              "font-bold",
              rate >= 0.7
                ? "text-green-600 dark:text-green-400"
                : rate >= 0.4
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-red-light dark:text-red-dark",
            )}
          >
            {Math.round(rate * 100)}% right
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <LuUsers size={14} />
          {q.responses === 1
            ? `${q.responses} answer`
            : `${q.responses} answers`}
        </span>
        {q.avgTimeMs !== null && (
          <span className="inline-flex items-center gap-1">
            <LuClock size={14} />Ø {(q.avgTimeMs / 1000).toFixed(1)} s
          </span>
        )}
      </div>

      {rate !== null && (
        <div className="h-2 rounded-full bg-lprimary/10 dark:bg-white/10 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500"
            style={{ width: `${Math.round(rate * 100)}%` }}
          />
        </div>
      )}

      <Breakdown q={q} />

      {wrong && (
        <p className="text-sm">
          <span className="text-off-dark dark:text-off-white">
            Most common wrong answer:
          </span>{" "}
          <strong>{wrong.text}</strong> ({wrong.count})
        </p>
      )}
    </div>
  );
}

/** Bars for what was picked (options, true / false, ratings, words…). */
function Breakdown({ q }: { q: QuestionStats }) {
  const s = q.summary;
  let rows: { label: string; count: number; correct?: boolean }[] = [];
  if (s.type === "multiple_choice" || s.type === "poll") {
    rows = q.options.map((o, i) => ({
      label: o.title,
      count: s.counts[i] ?? 0,
      correct: s.type === "multiple_choice" ? o.isCorrect : undefined,
    }));
  } else if (s.type === "true_false") {
    rows = [
      { label: "True", count: s.trueCount, correct: s.answer },
      { label: "False", count: s.falseCount, correct: !s.answer },
    ];
  } else if (s.type === "rating") {
    const avg = ratingAverage(s.counts);
    return avg === null ? null : (
      <p className="text-sm">
        Average rating: {avg.toFixed(1)} of {s.counts.length}
      </p>
    );
  } else if (s.type === "word_cloud") {
    rows = s.words.slice(0, 5).map((w) => ({ label: w.word, count: w.count }));
  } else if (s.type === "type_answer") {
    rows = s.answers
      .slice(0, 5)
      .map((a) => ({ label: a.text, count: a.count, correct: a.correct }));
  } else if (s.type === "open_text") {
    return s.entries.length === 0 ? null : (
      <ul className="text-sm flex flex-col gap-1">
        {s.entries.slice(0, 5).map((e, i) => (
          <li key={i} className="truncate">
            „{e.text}“{e.name ? ` — ${e.name}` : ""}
          </li>
        ))}
      </ul>
    );
  }
  if (rows.length === 0) return null;
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <ul className="flex flex-col gap-1.5">
      {rows.map((r, i) => (
        <li
          key={i}
          className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 text-sm"
        >
          <div className="relative min-w-0 rounded-md overflow-hidden bg-lprimary/5 dark:bg-white/5">
            <div
              className={clsx(
                "absolute inset-y-0 left-0",
                r.correct
                  ? "bg-green-500/30"
                  : "bg-lprimary/15 dark:bg-dprimary/20",
              )}
              style={{ width: `${(r.count / max) * 100}%` }}
            />
            <span className="relative flex items-center gap-1.5 px-2 py-1 truncate">
              {r.correct && (
                <LuCheck
                  size={14}
                  className="shrink-0 text-green-600 dark:text-green-400"
                  aria-label="Correct answer"
                />
              )}
              <span className="truncate">{r.label}</span>
            </span>
          </div>
          <span className="font-bold tabular-nums">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}
