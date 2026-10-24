import type { QuestionType, RevealSummary } from "./question-types";

// ---------------------------------------------------------------------------
// The host's report on a played game or test: how each question went. Kept
// with the result (a snapshot), so later quiz edits don't change it.
// ---------------------------------------------------------------------------

export interface ReportOption {
  id: string;
  title: string;
  isCorrect: boolean;
}

export interface QuestionStats {
  /** Position in the game (0-based). */
  index: number;
  title: string;
  type: QuestionType;
  /** The question's picture, when it had one. */
  image: string | null;
  options: ReportOption[];
  /** What the reveal showed: counts, words, typed answers… per type. */
  summary: RevealSummary;
  /** Players who answered. */
  responses: number;
  /** Players who were right; null for unscored types (poll, rating…). */
  correct: number | null;
  avgTimeMs: number | null;
}
