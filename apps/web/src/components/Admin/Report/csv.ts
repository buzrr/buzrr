import type { QuestionStats } from "@buzrr/contract";
import { commonWrongAnswer, correctRate } from "./stats";

export interface ReportEntry {
  rank: number;
  name: string;
  profilePic: string | null;
  score: number;
  correctCount: number;
}

/**
 * Builds a CSV in the browser and saves it. German spreadsheets expect `;`
 * (the comma is their decimal point); the BOM makes Excel read UTF-8.
 */
function download(fileName: string, rows: (string | number)[][]) {
  const sep = ",";
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const text = rows.map((r) => r.map(cell).join(sep)).join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF" + text], { type: "text/csv;charset=utf-8" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** A file-name-safe version of the quiz title. */
export const fileSlug = (title: string) =>
  title
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60) || "buzrr";

export function downloadPlayersCsv(fileName: string, entries: ReportEntry[]) {
  download(fileName, [
    ["Place", "Name", "Points", "Correct answers"],
    ...entries.map((e) => [e.rank, e.name, e.score, e.correctCount]),
  ]);
}

export function downloadQuestionsCsv(
  fileName: string,
  questions: QuestionStats[],
) {
  download(fileName, [
    [
      "No.",
      "Question",
      "Answers",
      "Right (%)",
      "Ø time (s)",
      "Most common wrong answer",
    ],
    ...questions.map((q) => {
      const rate = correctRate(q);
      const wrong = commonWrongAnswer(q);
      return [
        q.index + 1,
        q.title,
        q.responses,
        rate === null ? "" : Math.round(rate * 100),
        q.avgTimeMs === null ? "" : Math.round(q.avgTimeMs / 100) / 10,
        wrong ? `${wrong.text} (${wrong.count})` : "",
      ];
    }),
  ]);
}
