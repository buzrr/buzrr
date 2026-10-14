import { MAX_OPTIONS, MIN_OPTIONS, multipleChoice } from "@buzrr/contract";
import { computeScore } from "../../../common/utils/compute-score";
import {
  QuestionDefinitionError,
  type LiveQuestion,
  type QuestionTypeHandler,
} from "../question-type";
import {
  checkOptions,
  countOptions,
  parseConfig,
  pickOne,
  pickedOptionIds,
} from "./shared";

function correctIds(question: LiveQuestion<"multiple_choice">): string[] {
  return question.options.filter((o) => o.isCorrect).map((o) => o.id);
}

/** Whether players pick a set rather than tap one option. */
function isMulti(question: LiveQuestion<"multiple_choice">): boolean {
  return question.config.multiSelect ?? correctIds(question).length > 1;
}

/**
 * Single choice (the default): tap the one right option (`optionId`).
 * Multiple choice (`config.multiSelect`): tick every right option and submit
 * the set (`optionIds`); only the exact set scores.
 */
export const multipleChoiceHandler: QuestionTypeHandler<"multiple_choice"> = {
  type: "multiple_choice",
  scored: true,

  validateDefinition({ options, config }) {
    const trimmed = checkOptions(options, {
      min: MIN_OPTIONS,
      max: MAX_OPTIONS,
      label: "multiple choice",
    });
    const parsed = parseConfig(
      multipleChoice.config,
      config,
      "multiple choice",
    );
    const correct = trimmed.filter((o) => o.isCorrect).length;
    const multiSelect = parsed.multiSelect ?? correct > 1;
    if (multiSelect ? correct === 0 : correct !== 1) {
      throw new QuestionDefinitionError(
        multiSelect
          ? "A multiple choice question needs at least one correct option"
          : "A single-answer question needs exactly one correct option",
      );
    }
    return { options: trimmed, config: { multiSelect } };
  },

  checkAnswer(question, raw) {
    const parsed = multipleChoice.answer.safeParse(raw);
    if (!parsed.success) return null;
    const picked = pickedOptionIds(parsed.data);
    const known = new Set(question.options.map((o) => o.id));
    if (picked.some((id) => !known.has(id))) return null;
    const right = correctIds(question);
    if (isMulti(question)) {
      const chosen = new Set(picked);
      return {
        answer: { optionIds: [...chosen] },
        correct:
          chosen.size === right.length && right.every((id) => chosen.has(id)),
      };
    }
    // One right answer: one pick, whichever shape it came in.
    if (picked.length !== 1) return null;
    const optionId = picked[0]!;
    return { answer: { optionId }, correct: right[0] === optionId };
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
      multiSelect: isMulti(question),
    };
  },

  summarize(question, entries) {
    const answers = entries.map((e) => e.answer);
    const right = correctIds(question);
    const isRight = (ids: string[]) =>
      ids.length === right.length && right.every((id) => ids.includes(id));
    return {
      type: "multiple_choice",
      counts: countOptions(question.options, answers),
      responses: answers.length,
      correctOptionIds: right,
      correct: answers.filter((a) => isRight([...new Set(pickedOptionIds(a))]))
        .length,
    };
  },

  sampleAnswer(question, correct, random) {
    const right = correctIds(question);
    if (isMulti(question)) {
      if (correct) return { optionIds: right };
      // Any wrong option spoils the set; failing that, a strict subset does.
      const wrong = question.options.filter((o) => !o.isCorrect);
      return {
        optionIds: [
          wrong.length ? pickOne(wrong, random).id : (right[0] ?? ""),
        ],
      };
    }
    let pool = question.options.filter((o) => o.isCorrect === correct);
    // A question with no wrong option (or no right one) still needs an answer.
    if (pool.length === 0) pool = question.options;
    return { optionId: pool.length ? pickOne(pool, random).id : "" };
  },

  duelEligible({ options, config }) {
    return (
      !config.multiSelect && options.filter((o) => o.isCorrect).length === 1
    );
  },
};
