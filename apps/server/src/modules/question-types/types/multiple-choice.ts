import { MAX_OPTIONS, MIN_OPTIONS, multipleChoice } from "@buzrr/contract";
import { computeScore } from "../../../common/utils/compute-score";
import {
  QuestionDefinitionError,
  type QuestionTypeHandler,
} from "../question-type";

/** Pick one option; exactly one option is correct. */
export const multipleChoiceHandler: QuestionTypeHandler<"multiple_choice"> = {
  type: "multiple_choice",

  validateDefinition({ options, config }) {
    const trimmed = options.map((o) => ({
      title: o.title.trim(),
      isCorrect: o.isCorrect,
    }));
    if (trimmed.length < MIN_OPTIONS || trimmed.length > MAX_OPTIONS) {
      throw new QuestionDefinitionError(
        `A multiple choice question needs ${MIN_OPTIONS}–${MAX_OPTIONS} options`,
      );
    }
    if (trimmed.some((o) => o.title === "")) {
      throw new QuestionDefinitionError("Options can't be empty");
    }
    if (trimmed.filter((o) => o.isCorrect).length !== 1) {
      throw new QuestionDefinitionError(
        "A multiple choice question needs exactly one correct option",
      );
    }
    const parsed = multipleChoice.config.safeParse(config ?? {});
    if (!parsed.success) {
      throw new QuestionDefinitionError("Invalid multiple choice settings");
    }
    return { options: trimmed, config: parsed.data };
  },

  checkAnswer(question, raw) {
    const parsed = multipleChoice.answer.safeParse(raw);
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
      type: "multiple_choice",
      id: question.id,
      title: question.title,
      media: question.media,
      mediaType: question.mediaType,
      timeOut: question.timeOut,
      options: question.options.map((o) => ({ id: o.id, title: o.title })),
    };
  },

  summarize(question, answers) {
    return {
      type: "multiple_choice",
      counts: question.options.map(
        (o) => answers.filter((a) => a.optionId === o.id).length,
      ),
      correctOptionIds: question.options
        .filter((o) => o.isCorrect)
        .map((o) => o.id),
    };
  },

  sampleAnswer(question, correct, random) {
    let pool = question.options.filter((o) => o.isCorrect === correct);
    // A question with no wrong option (or no right one) still needs an answer.
    if (pool.length === 0) pool = question.options;
    const pick = pool[Math.floor(random() * pool.length)] ?? pool[0];
    return { optionId: pick?.id ?? "" };
  },
};
