import type {
  AuthoredOption,
  PublicQuestion,
  QuestionAnswer,
  QuestionConfig,
  QuestionType,
  RevealSummary,
} from "@buzrr/contract";

export interface LiveOption {
  id: string;
  title: string;
  isCorrect: boolean;
}

/**
 * A question as the engine holds it in Redis for the length of a game —
 * including the answer key, so it never leaves the server as-is (see
 * `toPublic`). `options` is the generic Option-table data every type may use;
 * anything else a type needs lives in `config`.
 */
export interface LiveQuestion<T extends QuestionType = QuestionType> {
  id: string;
  type: T;
  title: string;
  media: string | null;
  mediaType: string | null;
  /** Seconds to answer. */
  timeOut: number;
  options: LiveOption[];
  config: QuestionConfig<T>;
}

/** A submitted answer that made sense for its question, and its verdict. */
export interface AnswerCheck<T extends QuestionType = QuestionType> {
  answer: QuestionAnswer<T>;
  correct: boolean;
}

/** What a type stores for authored content once its handler has checked it. */
export interface QuestionDefinition<T extends QuestionType = QuestionType> {
  options: AuthoredOption[];
  config: QuestionConfig<T>;
}

/** Authored content the type can't accept; the message is user-facing. */
export class QuestionDefinitionError extends Error {}

/**
 * Everything type-specific about a question. The engine, the question
 * editor's API and the duel pool call these and nothing else, so a new type
 * is a new handler plus a renderer on the web — never an engine change.
 *
 * Handlers must be pure: no I/O, no clocks, randomness only through the
 * `random` argument. That keeps them trivially testable and lets the pure
 * engine core (`game-engine/core`) call them directly.
 */
export interface QuestionTypeHandler<T extends QuestionType = QuestionType> {
  readonly type: T;

  /**
   * Checks authored options + config and returns the normalised form to
   * store. Throws `QuestionDefinitionError` with a user-facing message.
   */
  validateDefinition(input: {
    options: AuthoredOption[];
    config: unknown;
  }): QuestionDefinition<T>;

  /**
   * Parses a player's raw answer against the question. Returns null when the
   * answer is malformed or doesn't fit this question (e.g. an unknown option).
   */
  checkAnswer(question: LiveQuestion<T>, raw: unknown): AnswerCheck<T> | null;

  /** Points for a checked answer, given the server-measured time it took. */
  score(
    question: LiveQuestion<T>,
    check: AnswerCheck<T>,
    timeTakenMs: number,
  ): number;

  /** The question as players see it while it is open — no answer key. */
  toPublic(question: LiveQuestion<T>): PublicQuestion<T>;

  /** What the reveal shows, from every answer that was stored. */
  summarize(
    question: LiveQuestion<T>,
    answers: QuestionAnswer<T>[],
  ): RevealSummary<T>;

  /**
   * A plausible answer that is (or isn't) correct — how duel bots play the
   * type. Must always return something: a bot that stays silent stops a duel
   * question from closing early.
   */
  sampleAnswer(
    question: LiveQuestion<T>,
    correct: boolean,
    random: () => number,
  ): QuestionAnswer<T>;
}
