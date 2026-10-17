import { trueFalse, type AuthoredOption } from "@buzrr/contract";
import { computeScore } from "../../../common/utils/compute-score";
import {
  QuestionDefinitionError,
  type QuestionTypeHandler,
} from "../question-type";
import { checkNoOptions, checkOptions, parseConfig } from "./shared";

/**
 * The key from the old shape: a "True" and a "False" option, one correct.
 * Rows written before `config.answer` existed (until the migration drops
 * them) and older clients still send it.
 */
function legacyAnswer(options: AuthoredOption[]): boolean {
  const trimmed = checkOptions(options, {
    min: 2,
    max: 2,
    label: "true / false",
  });
  const correct = trimmed.filter((o) => o.isCorrect);
  const title = correct[0]?.title.toLowerCase();
  if (correct.length !== 1 || (title !== "true" && title !== "false")) {
    throw new QuestionDefinitionError(
      "A true / false question needs exactly one correct answer",
    );
  }
  return title === "true";
}

/** A statement that is true or false; the key is `config.answer`, no options. */
export const trueFalseHandler: QuestionTypeHandler<"true_false"> = {
  type: "true_false",
  scored: true,

  validateDefinition({ options, config }) {
    const raw = (config ?? {}) as Record<string, unknown>;
    if (raw.answer === undefined && options.length > 0) {
      return { options: [], config: { answer: legacyAnswer(options) } };
    }
    return {
      options: checkNoOptions(options, "true / false"),
      config: parseConfig(trueFalse.config, config, "true / false"),
    };
  },

  checkAnswer(question, raw) {
    const parsed = trueFalse.answer.safeParse(raw);
    if (!parsed.success) return null;
    return {
      answer: parsed.data,
      correct: parsed.data.value === question.config.answer,
    };
  },

  score(question, check, timeTakenMs) {
    return computeScore(check.correct, timeTakenMs, question.timeOut);
  },

  toPublic(question) {
    return {
      type: "true_false",
      id: question.id,
      title: question.title,
      media: question.media,
      mediaType: question.mediaType,
      timeOut: question.timeOut,
    };
  },

  summarize(question, entries) {
    // An `{ optionId }` stored by the old shape mid-deploy counts as neither.
    const values = entries
      .map((e) => e.answer.value as unknown)
      .filter((v): v is boolean => typeof v === "boolean");
    const trueCount = values.filter((v) => v).length;
    return {
      type: "true_false",
      trueCount,
      falseCount: values.length - trueCount,
      responses: values.length,
      answer: question.config.answer,
      correct: values.filter((v) => v === question.config.answer).length,
    };
  },

  sampleAnswer(question, correct) {
    return { value: correct === question.config.answer };
  },

  duelEligible() {
    return true;
  },
};
