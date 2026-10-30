import { z } from "zod";
import { questionTypeSchema } from "./question-types";

// -- session report (Buzrr Pro) -------------------------------------------------
// What `GET /game-sessions/:roomId/report` (live, final leaderboard) and
// `GET /game-sessions/results/:resultId/report` (saved) return. The web app
// turns it into the downloadable PDF; nothing in it is recomputed client-side.

/** One answer tally line: "Paris" picked 12 times. */
const reportTallySchema = z.object({
  label: z.string(),
  count: z.number().int().nonnegative(),
  /** True for the key of a scored question. */
  isCorrect: z.boolean().optional(),
});

export const reportQuestionSchema = z.object({
  index: z.number().int().nonnegative(),
  title: z.string(),
  type: questionTypeSchema,
  scored: z.boolean(),
  /** Players who submitted anything. */
  answered: z.number().int().nonnegative(),
  /** Scored questions only; null otherwise. */
  correct: z.number().int().nonnegative().nullable(),
  avgTimeMs: z.number().nonnegative().nullable(),
  /** Most frequent answers first, capped. */
  breakdown: z.array(reportTallySchema),
  /** Rating questions: the mean of every rating given. */
  average: z.number().nullable(),
});

export const reportPlayerAnswerSchema = z.object({
  index: z.number().int().nonnegative(),
  /** Display text of what the player answered; null = no answer. */
  answer: z.string().nullable(),
  /** null for unscored questions or no answer. */
  isCorrect: z.boolean().nullable(),
  timeMs: z.number().nonnegative().nullable(),
  points: z.number().int(),
});

export const reportPlayerSchema = z.object({
  name: z.string(),
  profilePic: z.string().nullable(),
  rank: z.number().int().positive(),
  score: z.number().int(),
  answered: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
  /** Correct over scored questions; null when the quiz had none. */
  accuracy: z.number().min(0).max(1).nullable(),
  avgTimeMs: z.number().nonnegative().nullable(),
  fastestCorrectMs: z.number().nonnegative().nullable(),
  answers: z.array(reportPlayerAnswerSchema),
});

export const sessionReportSchema = z.object({
  quizTitle: z.string(),
  gameCode: z.string(),
  startedAt: z.string(),
  /** null while the room is still live on its final leaderboard. */
  endedAt: z.string().nullable(),
  generatedAt: z.string(),
  playerCount: z.number().int().nonnegative(),
  questionCount: z.number().int().nonnegative(),
  scoredQuestionCount: z.number().int().nonnegative(),
  avgScore: z.number().nonnegative(),
  /** Correct over every scored answer slot; null without scored questions. */
  accuracy: z.number().min(0).max(1).nullable(),
  avgTimeMs: z.number().nonnegative().nullable(),
  /** Answers submitted over players × questions. */
  participation: z.number().min(0).max(1),
  questions: z.array(reportQuestionSchema),
  /** Rank order. */
  players: z.array(reportPlayerSchema),
});

export type ReportQuestion = z.infer<typeof reportQuestionSchema>;
export type ReportPlayer = z.infer<typeof reportPlayerSchema>;
export type ReportPlayerAnswer = z.infer<typeof reportPlayerAnswerSchema>;
export type SessionReport = z.infer<typeof sessionReportSchema>;
