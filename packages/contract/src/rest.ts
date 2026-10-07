import { z } from "zod";
import {
  DEFAULT_QUESTION_TYPE,
  MAX_OPTIONS,
  MIN_TIME_OUT,
  questionTypeSchema,
} from "./question-types";

// ---------------------------------------------------------------------------
// REST bodies that carry questions. Type-specific rules (how many options,
// how many correct, what the config may hold) are checked by the question
// type's server handler — these schemas only fix the envelope.
// ---------------------------------------------------------------------------

export const authoredOptionSchema = z.object({
  title: z.string().trim().min(1).max(500),
  isCorrect: z.boolean(),
});

export const questionDefinitionSchema = z.object({
  type: questionTypeSchema.default(DEFAULT_QUESTION_TYPE),
  title: z.string().trim().min(1).max(2000),
  timeOut: z.number().int().min(MIN_TIME_OUT).optional(),
  options: z.array(authoredOptionSchema).max(MAX_OPTIONS).default([]),
  config: z.record(z.string(), z.unknown()).default({}),
});

/**
 * `POST /api/quizzes/import` — a whole generated quiz in one transaction
 * (Buzrr-AI Knowledge Spaces). Questions without a `type` are multiple choice.
 */
export const importQuizSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional(),
  questions: z.array(questionDefinitionSchema).min(1).max(100),
});

export type AuthoredOption = z.infer<typeof authoredOptionSchema>;
export type QuestionDefinition = z.infer<typeof questionDefinitionSchema>;
export type QuestionDefinitionInput = z.input<typeof questionDefinitionSchema>;
/** What a client sends (defaults optional). */
export type ImportQuizBody = z.input<typeof importQuizSchema>;
/** What the server works with once the schema has applied defaults. */
export type ImportQuiz = z.output<typeof importQuizSchema>;
