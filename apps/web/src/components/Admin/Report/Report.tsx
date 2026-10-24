"use client";

import Image from "next/image";
import { useState } from "react";
import { LuDownload } from "react-icons/lu";
import type { QuestionStats } from "@buzrr/contract";
import { DEFAULT_AVATAR } from "@/constants";
import Segmented from "@/components/ui/Segmented";
import {
  downloadPlayersCsv,
  downloadQuestionsCsv,
  fileSlug,
  type ReportEntry,
} from "./csv";
import QuestionStatsList from "./QuestionStatsList";

export type { ReportEntry } from "./csv";

type Tab = "standings" | "questions";

function rankBadge(rank: number) {
  if (rank === 1) return <span className="text-3xl overflow-hidden">🥇</span>;
  if (rank === 2) return <span className="text-3xl overflow-hidden">🥈</span>;
  if (rank === 3) return <span className="text-3xl overflow-hidden">🥉</span>;
  return <span className="font-bold">#{rank}</span>;
}

/**
 * A played game's (or test's) report: the standings and how each question
 * went, both downloadable as CSV.
 */
export default function Report({
  title,
  entries,
  questions,
  emptyText,
}: {
  /** The quiz title (names the CSV files). */
  title: string;
  entries: ReportEntry[];
  questions: QuestionStats[];
  emptyText: string;
}) {
  const [tab, setTab] = useState<Tab>("standings");
  const slug = fileSlug(title);

  const csvButton = (label: string, onClick: () => void) => (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-lprimary dark:text-dprimary hover:bg-lprimary/8 dark:hover:bg-white/5 cursor-pointer"
    >
      <LuDownload size={14} />
      {label}
    </button>
  );

  return (
    <div className="flex flex-col gap-3 my-4 w-full max-w-2xl">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Segmented<Tab>
          label="Report"
          value={tab}
          onChange={setTab}
          options={[
            { value: "standings", label: "Standings" },
            { value: "questions", label: "Questions" },
          ]}
        />
        <span className="flex flex-wrap gap-1">
          {entries.length > 0 &&
            csvButton("Players (CSV)", () =>
              downloadPlayersCsv(`${slug}-players`, entries),
            )}
          {questions.length > 0 &&
            csvButton("Questions (CSV)", () =>
              downloadQuestionsCsv(`${slug}-questions`, questions),
            )}
        </span>
      </div>

      {tab === "questions" ? (
        <QuestionStatsList questions={questions} />
      ) : entries.length > 0 ? (
        entries.map((entry, i) => (
          <div
            key={i}
            className="grid grid-cols-[48px_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-2 w-full rounded-xl shadow bg-white dark:bg-card-dark text-dark dark:text-white"
          >
            {rankBadge(entry.rank)}
            <div className="flex flex-row items-center gap-x-2 min-w-0">
              <Image
                src={entry.profilePic || DEFAULT_AVATAR}
                className="w-12 h-12 rounded-full shrink-0"
                width={50}
                height={50}
                alt="profile pic"
              />
              <div className="min-w-0">
                <p className="truncate">{entry.name}</p>
                <p className="text-xs text-off-dark dark:text-off-white">
                  {entry.correctCount} correct
                </p>
              </div>
            </div>
            <p className="font-bold">{entry.score}</p>
          </div>
        ))
      ) : (
        <div className="border border-gray border-dashed rounded-lg p-6 text-center text-dark dark:text-white">
          {emptyText}
        </div>
      )}
    </div>
  );
}
