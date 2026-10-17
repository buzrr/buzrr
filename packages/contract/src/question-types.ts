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
export const MAX_OPTIONS = 8;
export const MIN_TIME_OUT = 5;
export const DEFAULT_TIME_OUT = 15;

/**
 * A question's optional sound, played on the host screen: from `startMs` for
 * the question's time while it is open, and from `revealMs` (if set) at the
 * reveal.
 */
export const questionAudioSchema = z.object({
  url: z.string(),
  startMs: z.number().int().nonnegative(),
  revealMs: z.number().int().nonnegative().nullable(),
  /** Where it plays; "quiz" follows the quiz's sound setting. */
  playOn: z.enum(["quiz", "host", "players", "both", "off"]).default("quiz"),
});
export type QuestionAudio = z.infer<typeof questionAudioSchema>;

const publicBase = z.object({
  id: z.string(),
  title: z.string(),
  media: z.string().nullable(),
  mediaType: z.string().nullable(),
  /** Seconds to answer. */
  timeOut: z.number().int().positive(),
  audio: questionAudioSchema.nullable().optional(),
});

export const publicOptionSchema = z.object({
  id: z.string(),
  title: z.string(),
});

// -- answer shapes -------------------------------------------------------------
// Shared by the types below. Every one is strict and none overlaps another, so
// the union in `questionAnswerSchema` stays unambiguous; each type's handler
// then checks the answer against the question it is answering.

const optionIdAnswer = z
  .object({ optionId: z.string().min(1).max(64) })
  .strict();
const optionIdsAnswer = z
  .object({
    optionIds: z
      .array(z.string().min(1).max(64))
      .min(1)
      .max(MAX_OPTIONS)
      .refine((ids) => new Set(ids).size === ids.length, "Duplicate option"),
  })
  .strict();

/**
 * Most answers one player can send to a question that takes more than one
 * submission — there is no authored limit, this just bounds the wall.
 */
export const MAX_SUBMISSIONS = 10;
/** Longest word-cloud answer any config allows. */
export const WORD_MAX_LENGTH = 40;
/** Most word-cloud answers any config allows per player. */
export const MAX_WORDS = 3;
/** Longest open-text answer any config allows. */
export const TEXT_MAX_LENGTH = 500;
/** Rating labels (the scale's two ends). */
export const RATING_LABEL_MAX = 40;

const wordsAnswer = z
  .object({
    words: z
      .array(z.string().trim().min(1).max(WORD_MAX_LENGTH))
      .min(1)
      // A single submission takes up to MAX_WORDS; the stored answer of a
      // multi-submission question collects up to MAX_SUBMISSIONS.
      .max(MAX_SUBMISSIONS),
  })
  .strict();
const ratingAnswer = z
  .object({ value: z.number().int().min(1).max(10) })
  .strict();
const textAnswer = z
  .object({
    text: z.string().trim().min(1).max(TEXT_MAX_LENGTH),
    anonymous: z.boolean(),
  })
  .strict();
/** Open text as stored: every response a player sent, oldest first. */
const textsAnswer = z
  .object({
    entries: z
      .array(
        z.object({
          text: z.string().min(1).max(TEXT_MAX_LENGTH),
          anonymous: z.boolean(),
        }),
      )
      .min(1)
      .max(MAX_SUBMISSIONS),
  })
  .strict();

/** Counts plus how many answered — what every option-based reveal carries. */
const optionTally = {
  /** Answer counts aligned with the question's option order. */
  counts: z.array(z.number().int().nonnegative()),
  /** Players who answered (a multi-select answer counts once). */
  responses: z.number().int().nonnegative(),
};

// -- multiple_choice ----------------------------------------------------------
// Single choice by default: exactly one option is correct and a player taps
// to answer (`optionId`). With `multiSelect` one or more options are correct;
// players tick a set and submit it (`optionIds`), and only the exact set
// scores. Options live in the Option table (shared, editable rows with ids).

export const multipleChoice = {
  type: "multiple_choice",
  config: z.object({
    /**
     * Players pick a set. Unset (rows and imports from before the setting
     * existed) means "multiple when more than one option is correct".
     */
    multiSelect: z.boolean().optional(),
  }),
  answer: z.union([optionIdAnswer, optionIdsAnswer]),
  publicQuestion: publicBase.extend({
    type: z.literal("multiple_choice"),
    options: z.array(publicOptionSchema),
    /** Tick every right option, then submit — not a hint at how many. */
    multiSelect: z.boolean(),
  }),
  summary: z.object({
    type: z.literal("multiple_choice"),
    ...optionTally,
    correctOptionIds: z.array(z.string()),
    /** Players whose answer was right. */
    correct: z.number().int().nonnegative(),
  }),
} as const;

// -- true_false ----------------------------------------------------------------
// Two options ("True", "False"), exactly one correct.

export const trueFalse = {
  type: "true_false",
  config: z.object({}),
  answer: optionIdAnswer,
  publicQuestion: publicBase.extend({
    type: z.literal("true_false"),
    options: z.array(publicOptionSchema),
  }),
  summary: z.object({
    type: z.literal("true_false"),
    ...optionTally,
    correctOptionIds: z.array(z.string()),
    correct: z.number().int().nonnegative(),
  }),
} as const;

// -- poll ------------------------------------------------------------------------
// 2–4 options, none correct, not scored.

export const MIN_POLL_OPTIONS = 2;
export const MAX_POLL_OPTIONS = 4;

export const poll = {
  type: "poll",
  config: z.object({ multiSelect: z.boolean().default(false) }),
  answer: optionIdsAnswer,
  publicQuestion: publicBase.extend({
    type: z.literal("poll"),
    options: z.array(publicOptionSchema),
    multiSelect: z.boolean(),
  }),
  summary: z.object({ type: z.literal("poll"), ...optionTally }),
} as const;

// -- word_cloud --------------------------------------------------------------------
// Short answers grouped by frequency, not scored.

export const WORD_CLOUD_LIMIT = 60;

export const wordCloud = {
  type: "word_cloud",
  config: z.object({
    maxAnswers: z.number().int().min(1).max(MAX_WORDS).default(3),
    maxLength: z.union([z.literal(20), z.literal(40)]).default(20),
    /**
     * Players send one word at a time, as often as they like until time is
     * up (`maxAnswers` then doesn't apply).
     */
    multipleSubmissions: z.boolean().default(false),
  }),
  answer: wordsAnswer,
  publicQuestion: publicBase.extend({
    type: z.literal("word_cloud"),
    maxAnswers: z.number().int(),
    maxLength: z.number().int(),
    multipleSubmissions: z.boolean(),
  }),
  summary: z.object({
    type: z.literal("word_cloud"),
    /** Most frequent first, at most `WORD_CLOUD_LIMIT`. */
    words: z.array(
      z.object({ word: z.string(), count: z.number().int().positive() }),
    ),
    responses: z.number().int().nonnegative(),
  }),
} as const;

// -- rating ------------------------------------------------------------------------
// A 1–5 or 1–10 scale (or five stars), not scored.

export const ratingScaleSchema = z.enum(["5", "10", "stars"]);
export type RatingScale = z.infer<typeof ratingScaleSchema>;

/** The highest value a scale allows (its lowest is always 1). */
export function ratingMax(scale: RatingScale): number {
  return scale === "10" ? 10 : 5;
}

export const rating = {
  type: "rating",
  config: z.object({
    scale: ratingScaleSchema.default("5"),
    lowLabel: z.string().trim().max(RATING_LABEL_MAX).default("Not at all"),
    highLabel: z.string().trim().max(RATING_LABEL_MAX).default("Very"),
  }),
  answer: ratingAnswer,
  publicQuestion: publicBase.extend({
    type: z.literal("rating"),
    scale: ratingScaleSchema,
    lowLabel: z.string(),
    highLabel: z.string(),
  }),
  summary: z.object({
    type: z.literal("rating"),
    /** `counts[i]` is how many picked `i + 1`. */
    counts: z.array(z.number().int().nonnegative()),
    responses: z.number().int().nonnegative(),
  }),
} as const;

// -- open_text ----------------------------------------------------------------------
// Free responses shown as a wall, not scored.

export const OPEN_TEXT_LIMIT = 100;

export const openText = {
  type: "open_text",
  config: z.object({
    maxLength: z
      .union([z.literal(100), z.literal(200), z.literal(500)])
      .default(200),
    allowAnonymous: z.boolean().default(true),
    /** Players can keep sending responses until time is up. */
    multipleSubmissions: z.boolean().default(false),
  }),
  /** Players send one `{ text }`; it is stored as `{ entries }`. */
  answer: z.union([textAnswer, textsAnswer]),
  publicQuestion: publicBase.extend({
    type: z.literal("open_text"),
    maxLength: z.number().int(),
    allowAnonymous: z.boolean(),
    multipleSubmissions: z.boolean(),
  }),
  summary: z.object({
    type: z.literal("open_text"),
    /** Newest first, at most `OPEN_TEXT_LIMIT`; no name when anonymous. */
    entries: z.array(
      z.object({
        text: z.string(),
        name: z.string().nullable(),
        profilePic: z.string().nullable(),
      }),
    ),
    responses: z.number().int().nonnegative(),
  }),
} as const;

// -- registry -------------------------------------------------------------------

export const QUESTION_TYPES = [
  multipleChoice.type,
  trueFalse.type,
  poll.type,
  wordCloud.type,
  rating.type,
  openText.type,
] as const;
export const questionTypeSchema = z.enum(QUESTION_TYPES);
export type QuestionType = z.infer<typeof questionTypeSchema>;

/** Types that award points; the rest collect opinions and score nothing. */
export const SCORED_TYPES: readonly QuestionType[] = [
  "multiple_choice",
  "true_false",
];

export function isScoredType(type: QuestionType): boolean {
  return SCORED_TYPES.includes(type);
}

/** Rows written before Question.type existed — and any unset type — mean this. */
export const DEFAULT_QUESTION_TYPE: QuestionType = "multiple_choice";

export const publicQuestionSchema = z.discriminatedUnion("type", [
  multipleChoice.publicQuestion,
  trueFalse.publicQuestion,
  poll.publicQuestion,
  wordCloud.publicQuestion,
  rating.publicQuestion,
  openText.publicQuestion,
]);
export const revealSummarySchema = z.discriminatedUnion("type", [
  multipleChoice.summary,
  trueFalse.summary,
  poll.summary,
  wordCloud.summary,
  rating.summary,
  openText.summary,
]);
/**
 * Any type's answer. The gateway checks this shape; the question's own
 * handler then checks it against the question it is answering.
 */
export const questionAnswerSchema = z.union([
  optionIdAnswer,
  optionIdsAnswer,
  wordsAnswer,
  ratingAnswer,
  textAnswer,
  textsAnswer,
]);

type Shapes<
  B extends {
    config: z.ZodType;
    answer: z.ZodType;
    publicQuestion: z.ZodType;
    summary: z.ZodType;
  },
> = {
  config: z.infer<B["config"]>;
  answer: z.infer<B["answer"]>;
  publicQuestion: z.infer<B["publicQuestion"]>;
  summary: z.infer<B["summary"]>;
};

/** Per-type shapes, for code that narrows on `type`. */
export interface QuestionTypeMap {
  multiple_choice: Shapes<typeof multipleChoice>;
  true_false: Shapes<typeof trueFalse>;
  poll: Shapes<typeof poll>;
  word_cloud: Shapes<typeof wordCloud>;
  rating: Shapes<typeof rating>;
  open_text: Shapes<typeof openText>;
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
