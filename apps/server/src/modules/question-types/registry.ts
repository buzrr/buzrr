import {
  DEFAULT_QUESTION_TYPE,
  isQuestionType,
  type AuthoredOption,
  type PublicQuestion,
  type QuestionAnswer,
  type QuestionType,
  type RevealSummary,
} from "@buzrr/contract";
import {
  QuestionDefinitionError,
  type AnswerCheck,
  type AnswerEntry,
  type LiveQuestion,
  type QuestionDefinition,
  type QuestionTypeHandler,
} from "./question-type";
import { multipleChoiceHandler } from "./types/multiple-choice";
import { openTextHandler } from "./types/open-text";
import { pollHandler } from "./types/poll";
import { ratingHandler } from "./types/rating";
import { trueFalseHandler } from "./types/true-false";
import { wordCloudHandler } from "./types/word-cloud";

/**
 * One handler per type. The mapped type makes this exhaustive: adding a type
 * to the contract without registering its handler here fails to compile.
 */
const HANDLERS: { [K in QuestionType]: QuestionTypeHandler<K> } = {
  multiple_choice: multipleChoiceHandler,
  true_false: trueFalseHandler,
  poll: pollHandler,
  word_cloud: wordCloudHandler,
  rating: ratingHandler,
  open_text: openTextHandler,
};

/**
 * The handlers as the engine calls them — on a question of *some* type. Each
 * handler is typed against its own shapes; this erases that once, here, so
 * callers never cast.
 */
type ErasedHandler = QuestionTypeHandler<QuestionType>;

function handlerFor(type: QuestionType): ErasedHandler {
  return HANDLERS[type] as unknown as ErasedHandler;
}

export function validateDefinition(
  type: string,
  input: { options: AuthoredOption[]; config: unknown },
): QuestionDefinition {
  if (!isQuestionType(type)) {
    throw new QuestionDefinitionError(`Unknown question type "${type}"`);
  }
  return handlerFor(type).validateDefinition(input);
}

export function checkAnswer(
  question: LiveQuestion,
  raw: unknown,
): AnswerCheck | null {
  return handlerFor(question.type).checkAnswer(question, raw);
}

export function scoreAnswer(
  question: LiveQuestion,
  check: AnswerCheck,
  timeTakenMs: number,
): number {
  return handlerFor(question.type).score(question, check, timeTakenMs);
}

export function toPublicQuestion(question: LiveQuestion): PublicQuestion {
  // The sound is the same for every type, so it is added here rather than in
  // each handler's `toPublic`.
  return {
    ...handlerFor(question.type).toPublic(question),
    audio: publicAudio(question.audio),
  };
}

/** What devices get: the encrypted clips (question key only), or the file. */
function publicAudio(audio: LiveQuestion["audio"]): PublicQuestion["audio"] {
  if (!audio) return null;
  if (!audio.clipUrl || !audio.clipKey) {
    return {
      url: audio.url,
      startMs: audio.startMs,
      revealMs: audio.revealMs,
      playOn: audio.playOn,
    };
  }
  return {
    url: audio.clipUrl,
    startMs: 0,
    revealMs: audio.revealClipUrl ? 0 : null,
    playOn: audio.playOn,
    encrypted: true,
    key: audio.clipKey,
    revealUrl: audio.revealClipUrl ?? null,
  };
}

/** The clips to download ahead of a question (no keys). */
export function preloadUrls(question: LiveQuestion | undefined): string[] {
  const a = question?.audio;
  return a?.clipUrl
    ? [a.clipUrl, ...(a.revealClipUrl ? [a.revealClipUrl] : [])]
    : [];
}

/** `entries` oldest first — types that list answers show the newest first. */
export function summarizeAnswers(
  question: LiveQuestion,
  entries: AnswerEntry[],
): RevealSummary {
  return handlerFor(question.type).summarize(question, entries);
}

/** Whether a player may keep answering this question after their first. */
export function acceptsMoreAnswers(question: LiveQuestion): boolean {
  return handlerFor(question.type).acceptsMoreAnswers?.(question) ?? false;
}

/** A further answer folded into the stored one; null if it can't be. */
export function mergeAnswers(
  question: LiveQuestion,
  previous: QuestionAnswer,
  next: QuestionAnswer,
): QuestionAnswer | null {
  const handler = handlerFor(question.type);
  if (!handler.acceptsMoreAnswers?.(question) || !handler.mergeAnswers) {
    return null;
  }
  return handler.mergeAnswers(question, previous, next);
}

/** Whether the type awards points (and keeps its results for the reveal). */
export function isScored(type: QuestionType): boolean {
  return handlerFor(type).scored;
}

/**
 * Whether authored content may be played in ranked duels. Unknown types and
 * content that fails its type's checks are not.
 */
export function isDuelEligible(
  type: string,
  input: { options: AuthoredOption[]; config: unknown },
): boolean {
  if (!isQuestionType(type)) return false;
  try {
    const handler = handlerFor(type);
    return handler.duelEligible(handler.validateDefinition(input));
  } catch (err) {
    if (err instanceof QuestionDefinitionError) return false;
    throw err;
  }
}

export function sampleAnswer(
  question: LiveQuestion,
  correct: boolean,
  random: () => number = Math.random,
): QuestionAnswer {
  return handlerFor(question.type).sampleAnswer(question, correct, random);
}

/** A stored question row, as Prisma returns it with its options. */
export interface QuestionRecord {
  id: string;
  type: string;
  title: string;
  media: string | null;
  mediaType: string | null;
  timeOut: number;
  config: unknown;
  options: LiveOption[];
  audio?: string | null;
  audioStartMs?: number | null;
  audioRevealMs?: number | null;
  audioPlayOn?: string | null;
  audioClip?: string | null;
  audioClipKey?: string | null;
  audioRevealClip?: string | null;
  audioRevealKey?: string | null;
}

type LiveOption = LiveQuestion["options"][number];

/**
 * Turns a database row into a playable question, or null when it can't be
 * played — an unknown type (e.g. one removed from this build) or content that
 * no longer passes its type's checks. Callers skip nulls rather than failing
 * the whole game over one bad row.
 */
const AUDIO_PLAY_ON = ["host", "players", "both", "off"] as const;
function audioPlayOn(
  raw: string | null | undefined,
): "quiz" | (typeof AUDIO_PLAY_ON)[number] {
  return AUDIO_PLAY_ON.find((v) => v === raw) ?? "quiz";
}

export function toLiveQuestion(row: QuestionRecord): LiveQuestion | null {
  if (!isQuestionType(row.type)) return null;
  try {
    const { config } = handlerFor(row.type).validateDefinition({
      options: row.options,
      config: row.config,
    });
    return {
      id: row.id,
      type: row.type,
      title: row.title,
      media: row.media,
      mediaType: row.mediaType,
      timeOut: row.timeOut,
      options: row.options.map((o) => ({
        id: o.id,
        title: o.title,
        isCorrect: o.isCorrect,
      })),
      config,
      audio: row.audio
        ? {
            url: row.audio,
            startMs: row.audioStartMs ?? 0,
            revealMs: row.audioRevealMs ?? null,
            playOn: audioPlayOn(row.audioPlayOn),
            clipUrl: row.audioClip ?? null,
            clipKey: row.audioClipKey ?? null,
            revealClipUrl: row.audioRevealClip ?? null,
            revealKey: row.audioRevealKey ?? null,
          }
        : null,
    };
  } catch (err) {
    if (err instanceof QuestionDefinitionError) return null;
    throw err;
  }
}

/**
 * Questions written to Redis before `type`/`config` existed are multiple
 * choice; a deploy mid-game must not strand them.
 */
export function normalizeLiveQuestion(
  question: Omit<LiveQuestion, "type" | "config"> &
    Partial<Pick<LiveQuestion, "type" | "config">>,
): LiveQuestion {
  return {
    ...question,
    type: question.type ?? DEFAULT_QUESTION_TYPE,
    config: question.config ?? {},
  };
}
