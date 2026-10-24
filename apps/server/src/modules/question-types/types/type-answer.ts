import {
  MAX_ACCEPTED_ANSWERS,
  TYPE_ANSWER_LIMIT,
  TYPE_ANSWER_MAX_LENGTH,
  answerPattern,
  matchTypedAnswer,
  normalizeTypedAnswer,
  typeAnswer,
} from "@buzrr/contract";
import { computeScore } from "../../../common/utils/compute-score";
import {
  QuestionDefinitionError,
  type LiveQuestion,
  type QuestionTypeHandler,
} from "../question-type";
import { parseConfig } from "./shared";

const acceptedOf = (question: LiveQuestion<"type_answer">) =>
  question.options.map((o) => o.title);

const match = (question: LiveQuestion<"type_answer">, guess: string) =>
  matchTypedAnswer(guess, acceptedOf(question), question.config.ignoreTypos);

/**
 * Players type the answer; up to eight accepted answers (the options, all
 * correct). Scored on speed and accuracy: the usual time-decayed points,
 * scaled by how exact the match was (a forgiven typo earns less).
 */
export const typeAnswerHandler: QuestionTypeHandler<"type_answer"> = {
  type: "type_answer",
  scored: true,

  validateDefinition({ options, config }) {
    const accepted = options.map((o) => o.title.trim()).filter((t) => t !== "");
    if (accepted.length < 1 || accepted.length > MAX_ACCEPTED_ANSWERS) {
      throw new QuestionDefinitionError(
        `An "ask for answer" question needs 1–${MAX_ACCEPTED_ANSWERS} accepted answers`,
      );
    }
    if (accepted.some((t) => t.length > TYPE_ANSWER_MAX_LENGTH)) {
      throw new QuestionDefinitionError(
        `Accepted answers can be at most ${TYPE_ANSWER_MAX_LENGTH} characters`,
      );
    }
    if (accepted.some((t) => normalizeTypedAnswer(t) === "")) {
      throw new QuestionDefinitionError(
        "Accepted answers need letters or digits",
      );
    }
    const parsed = parseConfig(typeAnswer.config, config, "ask for answer");
    if (parsed.fixedLength) {
      // Players see one set of boxes: every accepted answer must fit it.
      const shape = answerPattern(accepted[0]!).join(" ");
      if (accepted.some((a) => answerPattern(a).join(" ") !== shape)) {
        throw new QuestionDefinitionError(
          "With a fixed length, all accepted answers need the same length (letters per word)",
        );
      }
    }
    return {
      options: accepted.map((title) => ({ title, isCorrect: true })),
      config: parsed,
    };
  },

  checkAnswer(question, raw) {
    const parsed = typeAnswer.answer.safeParse(raw);
    if (!parsed.success) return null;
    return {
      answer: parsed.data,
      correct: match(question, parsed.data.guess).correct,
    };
  },

  score(question, check, timeTakenMs) {
    const base = computeScore(check.correct, timeTakenMs, question.timeOut);
    return Math.round(base * match(question, check.answer.guess).precision);
  },

  toPublic(question) {
    return {
      type: "type_answer",
      id: question.id,
      title: question.title,
      media: question.media,
      mediaType: question.mediaType,
      timeOut: question.timeOut,
      maxLength: TYPE_ANSWER_MAX_LENGTH,
      pattern:
        question.config.fixedLength && question.options[0]
          ? answerPattern(question.options[0].title)
          : null,
    };
  },

  summarize(question, entries) {
    const groups = new Map<
      string,
      { text: string; count: number; correct: boolean; precision: number }
    >();
    let correct = 0;
    for (const { answer } of entries) {
      const m = match(question, answer.guess);
      if (m.correct) correct++;
      const key = normalizeTypedAnswer(answer.guess);
      const g = groups.get(key);
      if (g) g.count++;
      else {
        groups.set(key, {
          text: answer.guess,
          count: 1,
          correct: m.correct,
          precision: m.precision,
        });
      }
    }
    return {
      type: "type_answer",
      accepted: acceptedOf(question),
      answers: [...groups.values()]
        .sort(
          (a, b) =>
            b.count - a.count ||
            Number(b.correct) - Number(a.correct) ||
            b.precision - a.precision,
        )
        .slice(0, TYPE_ANSWER_LIMIT),
      responses: entries.length,
      correct,
    };
  },

  sampleAnswer(question, correct) {
    return { guess: correct ? (acceptedOf(question)[0] ?? "?") : "no idea" };
  },

  duelEligible() {
    return false;
  },
};
