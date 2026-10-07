import { z } from "zod";

// ---------------------------------------------------------------------------
// Question types.
//
// Every question type declares four wire shapes here, and nothing else in the
// contract is type-specific:
//
//   config          authored, type-specific settings (stored in Question.config)
//   answer          what a player submits
//   publicQuestion  what players see while the question is open — never
//                   anything that gives the answer away
//   summary         what everyone sees at the reveal
//
// The behaviour behind these shapes lives in one handler per type on the
// server (`apps/server/src/modules/question-types/`) and one renderer per type
// on the web (`apps/web/src/components/QuestionTypes/`). Adding a type means
// adding a block below, a handler, and a renderer — the engine never changes.
// See CONTRIBUTING.md § Adding a question type.
// ---------------------------------------------------------------------------

/** Authoring bounds shared by every option-based type. */
export const MIN_OPTIONS = 2;
export const MAX_OPTIONS = 6;
export const MIN_TIME_OUT = 5;
export const DEFAULT_TIME_OUT = 15;

const publicBase = z.object({
  id: z.string(),
  title: z.string(),
  media: z.string().nullable(),
  mediaType: z.string().nullable(),
  /** Seconds to answer. */
  timeOut: z.number().int().positive(),
});

export const publicOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
});

// -- multiple_choice ----------------------------------------------------------
// Pick one option; exactly one is correct. Options live in the Option table
// (they are shared, editable rows with ids), so there is no config yet.

export const multipleChoice = {
  type: "multiple_choice",
  config: z.object({}),
  answer: z.object({ optionId: z.string().min(1).max(64) }).strict(),
  publicQuestion: publicBase.extend({
    type: z.literal("multiple_choice"),
    options: z.array(publicOptionSchema),
  }),
  summary: z.object({
    type: z.literal("multiple_choice"),
    /** Answer counts aligned with the question's option order. */
    counts: z.array(z.number().int().nonnegative()),
    correctOptionIds: z.array(z.string()),
  }),
} as const;

// -- registry -------------------------------------------------------------------

export const QUESTION_TYPES = [multipleChoice.type] as const;
export const questionTypeSchema = z.enum(QUESTION_TYPES);
export type QuestionType = z.infer<typeof questionTypeSchema>;

/** Rows written before Question.type existed — and any unset type — mean this. */
export const DEFAULT_QUESTION_TYPE: QuestionType = "multiple_choice";

export const publicQuestionSchema = z.discriminatedUnion("type", [
  multipleChoice.publicQuestion,
]);
export const revealSummarySchema = z.discriminatedUnion("type", [
  multipleChoice.summary,
]);
/**
 * Any type's answer. The gateway checks this shape; the question's own
 * handler then checks it against the question it is answering.
 */
export const questionAnswerSchema = z.union([multipleChoice.answer]);

/** Per-type shapes, for code that narrows on `type`. */
export interface QuestionTypeMap {
  multiple_choice: {
    config: z.infer<typeof multipleChoice.config>;
    answer: z.infer<typeof multipleChoice.answer>;
    publicQuestion: z.infer<typeof multipleChoice.publicQuestion>;
    summary: z.infer<typeof multipleChoice.summary>;
  };
}

export type QuestionConfig<T extends QuestionType = QuestionType> =
  QuestionTypeMap[T]["config"];
export type QuestionAnswer<T extends QuestionType = QuestionType> =
  QuestionTypeMap[T]["answer"];
export type PublicQuestion<T extends QuestionType = QuestionType> =
  QuestionTypeMap[T]["publicQuestion"];
export type RevealSummary<T extends QuestionType = QuestionType> =
  QuestionTypeMap[T]["summary"];
export type PublicOption = z.infer<typeof publicOptionSchema>;

export function isQuestionType(value: unknown): value is QuestionType {
  return questionTypeSchema.safeParse(value).success;
}
