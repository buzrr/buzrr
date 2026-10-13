import { MAX_POLL_OPTIONS, MIN_POLL_OPTIONS, poll } from "@buzrr/contract";
import type { QuestionTypeHandler } from "../question-type";
import { checkOptions, countOptions, parseConfig, pickOne } from "./shared";

/** Collect opinions: 2–4 options, no right answer, not scored. */
export const pollHandler: QuestionTypeHandler<"poll"> = {
  type: "poll",
  scored: false,

  validateDefinition({ options, config }) {
    const trimmed = checkOptions(options, {
      min: MIN_POLL_OPTIONS,
      max: MAX_POLL_OPTIONS,
      label: "poll",
    });
    return {
      // A poll has no right answer, whatever the author ticked.
      options: trimmed.map((o) => ({ ...o, isCorrect: false })),
      config: parseConfig(poll.config, config, "poll"),
    };
  },

  checkAnswer(question, raw) {
    const parsed = poll.answer.safeParse(raw);
    if (!parsed.success) return null;
    const { optionIds } = parsed.data;
    if (!question.config.multiSelect && optionIds.length !== 1) return null;
    const known = new Set(question.options.map((o) => o.id));
    if (optionIds.some((id) => !known.has(id))) return null;
    return { answer: { optionIds }, correct: false };
  },

  score() {
    return 0;
  },

  toPublic(question) {
    return {
      type: "poll",
      id: question.id,
      title: question.title,
      media: question.media,
      mediaType: question.mediaType,
      timeOut: question.timeOut,
      options: question.options.map((o) => ({ id: o.id, title: o.title })),
      multiSelect: question.config.multiSelect,
    };
  },

  summarize(question, entries) {
    const answers = entries.map((e) => e.answer);
    return {
      type: "poll",
      counts: countOptions(question.options, answers),
      responses: answers.length,
    };
  },

  sampleAnswer(question, _correct, random) {
    const option = question.options.length
      ? pickOne(question.options, random)
      : null;
    return { optionIds: [option?.id ?? ""] };
  },

  duelEligible() {
    return false;
  },
};
