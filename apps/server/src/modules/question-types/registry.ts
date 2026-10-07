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
  type LiveQuestion,
  type QuestionDefinition,
  type QuestionTypeHandler,
} from "./question-type";
import { multipleChoiceHandler } from "./types/multiple-choice";

/**
 * One handler per type. The mapped type makes this exhaustive: adding a type
 * to the contract without registering its handler here fails to compile.
 */
const HANDLERS: { [K in QuestionType]: QuestionTypeHandler<K> } = {
  multiple_choice: multipleChoiceHandler,
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
  return handlerFor(question.type).toPublic(question);
}

export function summarizeAnswers(
  question: LiveQuestion,
  answers: QuestionAnswer[],
): RevealSummary {
  return handlerFor(question.type).summarize(question, answers);
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
}

type LiveOption = LiveQuestion["options"][number];

/**
 * Turns a database row into a playable question, or null when it can't be
 * played — an unknown type (e.g. one removed from this build) or content that
 * no longer passes its type's checks. Callers skip nulls rather than failing
 * the whole game over one bad row.
 */
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
