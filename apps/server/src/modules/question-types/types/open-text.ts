import {
  MAX_SUBMISSIONS,
  OPEN_TEXT_LIMIT,
  openText,
  type QuestionAnswer,
} from "@buzrr/contract";
import type { QuestionTypeHandler } from "../question-type";
import { checkNoOptions, parseConfig } from "./shared";

type Entry = { text: string; anonymous: boolean };

/** A stored open-text answer as its responses (a lone `{ text }` is one). */
function entriesOf(answer: QuestionAnswer<"open_text">): Entry[] {
  return "entries" in answer ? answer.entries : [answer];
}

/** Free responses shown as a wall; not scored. */
export const openTextHandler: QuestionTypeHandler<"open_text"> = {
  type: "open_text",
  scored: false,

  validateDefinition({ options, config }) {
    return {
      options: checkNoOptions(options, "open text"),
      config: parseConfig(openText.config, config, "open text"),
    };
  },

  /** Players send one response at a time; it is stored as `{ entries }`. */
  checkAnswer(question, raw) {
    const parsed = openText.answer.safeParse(raw);
    if (!parsed.success || !("text" in parsed.data)) return null;
    const { text, anonymous } = parsed.data;
    if (text.length > question.config.maxLength) return null;
    return {
      answer: {
        entries: [
          { text, anonymous: anonymous && question.config.allowAnonymous },
        ],
      },
      correct: false,
    };
  },

  score() {
    return 0;
  },

  toPublic(question) {
    return {
      type: "open_text",
      id: question.id,
      title: question.title,
      media: question.media,
      mediaType: question.mediaType,
      timeOut: question.timeOut,
      maxLength: question.config.maxLength,
      allowAnonymous: question.config.allowAnonymous,
      multipleSubmissions: question.config.multipleSubmissions,
    };
  },

  /**
   * Answers arrive oldest first (by each player's first response); the wall
   * shows the newest first.
   */
  summarize(_question, answers) {
    const all = answers.flatMap(({ answer, author }) =>
      entriesOf(answer).map((entry) => ({ entry, author })),
    );
    return {
      type: "open_text",
      entries: all
        .slice(-OPEN_TEXT_LIMIT)
        .reverse()
        .map(({ entry, author }) => {
          const named = !entry.anonymous && author;
          return {
            text: entry.text,
            name: named ? author.name : null,
            profilePic: named ? author.profilePic : null,
          };
        }),
      responses: answers.length,
    };
  },

  /** What a player would send — bots answer through `checkAnswer` too. */
  sampleAnswer() {
    return { text: "Good one!", anonymous: false };
  },

  duelEligible() {
    return false;
  },

  acceptsMoreAnswers(question) {
    return question.config.multipleSubmissions;
  },

  mergeAnswers(_question, previous, next) {
    const entries = [...entriesOf(previous), ...entriesOf(next)];
    return entries.length > MAX_SUBMISSIONS ? null : { entries };
  },
};
