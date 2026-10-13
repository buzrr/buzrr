import { trueFalse } from "@buzrr/contract";
import { computeScore } from "../../../common/utils/compute-score";
import {
  QuestionDefinitionError,
  type QuestionTypeHandler,
} from "../question-type";
import { checkOptions, countOptions, parseConfig, pickOne } from "./shared";

/** Two options — "True" and "False" — exactly one correct. */
export const trueFalseHandler: QuestionTypeHandler<"true_false"> = {
  type: "true_false",
  scored: true,

  validateDefinition({ options, config }) {
    const trimmed = checkOptions(options, {
      min: 2,
      max: 2,
      label: "true / false",
    });
    if (trimmed.filter((o) => o.isCorrect).length !== 1) {
      throw new QuestionDefinitionError(
        "A true / false question needs exactly one correct answer",
      );
    }
    return {
      options: trimmed,
      config: parseConfig(trueFalse.config, config, "true / false"),
    };
  },

  checkAnswer(question, raw) {
    const parsed = trueFalse.answer.safeParse(raw);
    if (!parsed.success) return null;
    const option = question.options.find((o) => o.id === parsed.data.optionId);
    if (!option) return null;
    return { answer: parsed.data, correct: option.isCorrect };
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
      options: question.options.map((o) => ({ id: o.id, title: o.title })),
    };
  },

  summarize(question, entries) {
    const answers = entries.map((e) => e.answer);
    const right = new Set(
      question.options.filter((o) => o.isCorrect).map((o) => o.id),
    );
    return {
      type: "true_false",
      counts: countOptions(question.options, answers),
      responses: answers.length,
      correctOptionIds: [...right],
      correct: answers.filter((a) => right.has(a.optionId)).length,
    };
  },

  sampleAnswer(question, correct, random) {
    let pool = question.options.filter((o) => o.isCorrect === correct);
    if (pool.length === 0) pool = question.options;
    return { optionId: pool.length ? pickOne(pool, random).id : "" };
  },

  duelEligible() {
    return true;
  },
};
