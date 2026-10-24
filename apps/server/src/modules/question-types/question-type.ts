import type {
  AuthoredOption,
  PublicQuestion,
  QuestionAnswer,
  QuestionAudio,
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
  /** Optional sound (see `questionAudioSchema`); server-side with the clip keys. */
  audio?: LiveAudio | null;
}

/**
 * A question's sound as the engine holds it: the original's cues plus the
 * encrypted clips and their keys, which never leave the server except the
 * question key with the question and the reveal key with the reveal.
 */
export interface LiveAudio {
  url: string;
  startMs: number;
  revealMs: number | null;
  playOn: QuestionAudio["playOn"];
  clipUrl?: string | null;
  clipKey?: string | null;
  revealClipUrl?: string | null;
  revealKey?: string | null;
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

/** Who gave an answer, for types whose reveal names people (open text). */
export interface AnswerAuthor {
  name: string;
  profilePic: string | null;
}

/** A stored answer, with its author when the roster still knows them. */
export interface AnswerEntry<T extends QuestionType = QuestionType> {
  answer: QuestionAnswer<T>;
  author: AnswerAuthor | null;
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
   * Whether the type awards points. Unscored types (polls, word clouds, …)
   * never mark an answer correct, and the host sees their results live.
   */
  readonly scored: boolean;

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
    entries: AnswerEntry<T>[],
  ): RevealSummary<T>;

  /**
   * Whether a checked definition may be played in ranked 1v1 duels — a
   * single right answer that a head-to-head score can be built on. Anything
   * else is kept out of moderation and the duel pool.
   */
  duelEligible(definition: QuestionDefinition<T>): boolean;

  /**
   * Whether a player who has answered may send more while the question is
   * open. Such questions don't close early once everyone has answered.
   * Omitted: one answer each, first one wins.
   */
  acceptsMoreAnswers?(question: LiveQuestion<T>): boolean;

  /**
   * Folds a further checked answer into the one already stored. Null when
   * the stored answer can't take more (the per-player cap).
   */
  mergeAnswers?(
    question: LiveQuestion<T>,
    previous: QuestionAnswer<T>,
    next: QuestionAnswer<T>,
  ): QuestionAnswer<T> | null;

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
