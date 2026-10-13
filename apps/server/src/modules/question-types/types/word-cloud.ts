import { MAX_SUBMISSIONS, WORD_CLOUD_LIMIT, wordCloud } from "@buzrr/contract";
import type { QuestionTypeHandler } from "../question-type";
import { checkNoOptions, parseConfig, pickOne } from "./shared";

/** Case and spacing don't split a word: "Great ", "great" are one entry. */
function normalizeWord(word: string): string {
  return word.trim().toLowerCase().replace(/\s+/g, " ");
}

const BOT_WORDS = ["fun", "great", "tricky", "easy", "wow"] as const;

/** Short answers grouped by how often they come up; not scored. */
export const wordCloudHandler: QuestionTypeHandler<"word_cloud"> = {
  type: "word_cloud",
  scored: false,

  validateDefinition({ options, config }) {
    return {
      options: checkNoOptions(options, "word cloud"),
      config: parseConfig(wordCloud.config, config, "word cloud"),
    };
  },

  checkAnswer(question, raw) {
    const parsed = wordCloud.answer.safeParse(raw);
    if (!parsed.success) return null;
    const words = [...new Set(parsed.data.words.map(normalizeWord))];
    const { maxAnswers, maxLength, multipleSubmissions } = question.config;
    // With multiple submissions each one is a single word.
    const limit = multipleSubmissions ? 1 : maxAnswers;
    if (words.length === 0 || words.length > limit) return null;
    if (words.some((w) => w === "" || w.length > maxLength)) return null;
    return { answer: { words }, correct: false };
  },

  score() {
    return 0;
  },

  toPublic(question) {
    return {
      type: "word_cloud",
      id: question.id,
      title: question.title,
      media: question.media,
      mediaType: question.mediaType,
      timeOut: question.timeOut,
      maxAnswers: question.config.maxAnswers,
      maxLength: question.config.maxLength,
      multipleSubmissions: question.config.multipleSubmissions,
    };
  },

  summarize(_question, entries) {
    const counts = new Map<string, number>();
    for (const { answer } of entries) {
      for (const word of new Set(answer.words.map(normalizeWord))) {
        if (word) counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
    const words = [...counts]
      .map(([word, count]) => ({ word, count }))
      .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
      .slice(0, WORD_CLOUD_LIMIT);
    return { type: "word_cloud", words, responses: entries.length };
  },

  sampleAnswer(_question, _correct, random) {
    return { words: [pickOne(BOT_WORDS, random)] };
  },

  duelEligible() {
    return false;
  },

  acceptsMoreAnswers(question) {
    return question.config.multipleSubmissions;
  },

  /** Adds the new word; a repeat of one already sent changes nothing. */
  mergeAnswers(_question, previous, next) {
    const words = [...new Set([...previous.words, ...next.words])];
    return words.length > MAX_SUBMISSIONS ? null : { words };
  },
};
