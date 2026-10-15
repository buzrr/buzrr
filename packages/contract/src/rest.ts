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

/** A question can be tagged with at most this many categories. */
export const MAX_QUESTION_CATEGORIES = 5;

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

/** Category ids for a question (zero or more). Only admins tag questions. */
export const questionCategoryIdsSchema = z
  .array(z.string().min(1))
  .max(MAX_QUESTION_CATEGORIES);

/**
 * `POST /api/quizzes/import` — a whole generated quiz in one transaction
 * (Buzrr-AI Knowledge Spaces). Questions without a `type` are multiple choice.
 */
export const importQuizSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional(),
  questions: z.array(questionDefinitionSchema).min(1).max(100),
});

/**
 * `POST /api/questions` — standalone questions (no quiz), e.g. a bulk upload
 * of duel-pool content. Admin-only; every question enters moderation.
 */
export const createStandaloneQuestionsSchema = z.object({
  questions: z
    .array(
      questionDefinitionSchema.extend({
        categoryIds: questionCategoryIdsSchema.optional(),
      }),
    )
    .min(1)
    .max(500),
});

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export const categorySchema = z.object({
  id: z.string(),
  slug: z.string(),
  name: z.string(),
  /** OKLCH hue (0–360) for the category swatch. */
  hue: z.number().int(),
});

/** `POST /api/categories` and `PATCH /api/categories/:id` (admin). */
export const upsertCategorySchema = z.object({
  name: z.string().trim().min(1).max(60),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "slug must be kebab-case")
    .optional(),
  hue: z.number().int().min(0).max(360).optional(),
});

/** `PATCH /api/moderation/questions/:id/categories` (admin). */
export const setQuestionCategoriesSchema = z.object({
  categoryIds: questionCategoryIdsSchema,
});

// ---------------------------------------------------------------------------
// Moderation (admin): status tabs and bulk actions
// ---------------------------------------------------------------------------

/** The moderation states an admin lists; `draft` never reaches moderation. */
export const MODERATION_LIST_STATUSES = [
  "pending",
  "approved",
  "unapproved",
] as const;
export const moderationListStatusSchema = z.enum(MODERATION_LIST_STATUSES);

/** Bulk endpoints take at most this many question ids per request. */
export const MAX_BULK_MODERATION_IDS = 100;

const bulkQuestionIdsSchema = z
  .array(z.string().min(1))
  .min(1)
  .max(MAX_BULK_MODERATION_IDS);

/** `PATCH /api/moderation/questions/approve` and `.../unapprove`. */
export const bulkModerationSchema = z.object({ ids: bulkQuestionIdsSchema });

/** `PATCH /api/moderation/questions/categories` — retag many questions. */
export const bulkSetCategoriesSchema = z.object({
  ids: bulkQuestionIdsSchema,
  categoryIds: questionCategoryIdsSchema,
  /** add: tag on top of existing; remove: untag; replace: exactly these. */
  mode: z.enum(["add", "remove", "replace"]),
});

/** What a bulk moderation call did; skipped ids say why. */
export const bulkModerationResultSchema = z.object({
  updated: z.number().int(),
  skipped: z.array(z.object({ id: z.string(), reason: z.string() })),
});

/** `GET /api/moderation/questions/counts`. */
export const moderationCountsSchema = z.object({
  pending: z.number().int(),
  approved: z.number().int(),
  unapproved: z.number().int(),
});

// ---------------------------------------------------------------------------
// Duel profile, categories and daily streak
// ---------------------------------------------------------------------------

/** `GET /api/duel/categories` — categories with enough duel questions. */
export const duelCategoriesResponseSchema = z.object({
  /** Finished duels without a category ("Random"). */
  randomPlays: z.number().int(),
  categories: z.array(categorySchema.extend({ plays: z.number().int() })),
});

export const duelRecordSchema = z.object({
  rating: z.number().int(),
  /** Rated duels behind the rating (drives the K-factor). */
  ratedDuels: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
  draws: z.number().int(),
});

export const dailyStreakSchema = z.object({
  /** Current streak, already decayed to 0 if a day was missed. */
  current: z.number().int(),
  best: z.number().int(),
  /** A duel already counted today (in the user's time zone). */
  playedToday: z.boolean(),
  /** Today in the user's time zone, `YYYY-MM-DD`. */
  today: z.string(),
});

/** `GET /api/duel/me`. */
export const duelProfileSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  image: z.string().nullable(),
  eloRating: z.number().int(),
  duelsPlayed: z.number().int(),
  timeZone: z.string().nullable(),
  streak: dailyStreakSchema,
  /** Record for Random (category-less) duels, rated by `eloRating`. */
  random: duelRecordSchema,
  /** One entry per category the user has played. */
  categories: z.array(duelRecordSchema.extend({ categoryId: z.string() })),
});

/** `POST /api/duel/invites` — the challenge's category (null = Random). */
export const createDuelInviteSchema = z
  .object({ categoryId: z.string().min(1).nullable().optional() })
  .default({});

/** `PUT /api/duel/me/timezone`. */
export const setTimeZoneSchema = z.object({
  timeZone: z.string().min(1).max(64),
});

/** `GET /api/duel/streak?month=YYYY-MM`. */
export const streakMonthQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "month must be YYYY-MM"),
});

export const streakMonthSchema = z.object({
  month: z.string(),
  /** Days of the month (1-based) with a finished duel. */
  days: z.array(z.number().int()),
});

export type AuthoredOption = z.infer<typeof authoredOptionSchema>;
export type QuestionDefinition = z.infer<typeof questionDefinitionSchema>;
export type QuestionDefinitionInput = z.input<typeof questionDefinitionSchema>;
/** What a client sends (defaults optional). */
export type ImportQuizBody = z.input<typeof importQuizSchema>;
/** What the server works with once the schema has applied defaults. */
export type ImportQuiz = z.output<typeof importQuizSchema>;
export type CreateStandaloneQuestions = z.output<
  typeof createStandaloneQuestionsSchema
>;
export type CreateStandaloneQuestionsBody = z.input<
  typeof createStandaloneQuestionsSchema
>;
export type Category = z.infer<typeof categorySchema>;
export type UpsertCategory = z.infer<typeof upsertCategorySchema>;
export type SetQuestionCategories = z.infer<typeof setQuestionCategoriesSchema>;
export type ModerationListStatus = z.infer<typeof moderationListStatusSchema>;
export type BulkModeration = z.infer<typeof bulkModerationSchema>;
export type BulkSetCategories = z.infer<typeof bulkSetCategoriesSchema>;
export type BulkModerationResult = z.infer<typeof bulkModerationResultSchema>;
export type ModerationCounts = z.infer<typeof moderationCountsSchema>;
export type DuelCategoriesResponse = z.infer<
  typeof duelCategoriesResponseSchema
>;
export type DuelCategory = DuelCategoriesResponse["categories"][number];
export type DuelRecord = z.infer<typeof duelRecordSchema>;
export type DailyStreak = z.infer<typeof dailyStreakSchema>;
export type DuelProfile = z.infer<typeof duelProfileSchema>;
export type CreateDuelInvite = z.output<typeof createDuelInviteSchema>;
export type SetTimeZone = z.infer<typeof setTimeZoneSchema>;
export type StreakMonth = z.infer<typeof streakMonthSchema>;
