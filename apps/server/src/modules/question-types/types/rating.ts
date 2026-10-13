import { rating, ratingMax } from "@buzrr/contract";
import type { QuestionTypeHandler } from "../question-type";
import { checkNoOptions, parseConfig } from "./shared";

/** A 1–5 or 1–10 scale (or five stars); not scored. */
export const ratingHandler: QuestionTypeHandler<"rating"> = {
  type: "rating",
  scored: false,

  validateDefinition({ options, config }) {
    return {
      options: checkNoOptions(options, "rating"),
      config: parseConfig(rating.config, config, "rating"),
    };
  },

  checkAnswer(question, raw) {
    const parsed = rating.answer.safeParse(raw);
    if (!parsed.success) return null;
    if (parsed.data.value > ratingMax(question.config.scale)) return null;
    return { answer: parsed.data, correct: false };
  },

  score() {
    return 0;
  },

  toPublic(question) {
    return {
      type: "rating",
      id: question.id,
      title: question.title,
      media: question.media,
      mediaType: question.mediaType,
      timeOut: question.timeOut,
      scale: question.config.scale,
      lowLabel: question.config.lowLabel,
      highLabel: question.config.highLabel,
    };
  },

  summarize(question, entries) {
    const counts = Array.from(
      { length: ratingMax(question.config.scale) },
      () => 0,
    );
    for (const { answer } of entries) {
      const i = answer.value - 1;
      if (i >= 0 && i < counts.length) counts[i]! += 1;
    }
    return { type: "rating", counts, responses: entries.length };
  },

  sampleAnswer(question, _correct, random) {
    const max = ratingMax(question.config.scale);
    return { value: 1 + Math.floor(random() * max) };
  },

  duelEligible() {
    return false;
  },
};
