// Catches AI questions that give their answer away: the answer (or a telling
// word of it) in the question, or the answer in the quiz title. The prompt
// asks for this too, but models slip — especially on hard questions, where a
// leak makes them trivial — so the server checks and drops such questions.

/** Words too common to give an answer away (English and German). */
const STOP_WORDS = new Set([
  "the",
  "and",
  "with",
  "from",
  "that",
  "this",
  "which",
  "what",
  "into",
  "over",
  "under",
  "about",
  "their",
  "there",
  "were",
  "been",
  "have",
  "der",
  "die",
  "das",
  "den",
  "dem",
  "des",
  "und",
  "oder",
  "eine",
  "einen",
  "einem",
  "einer",
  "eines",
  "mit",
  "von",
  "für",
  "fuer",
  "über",
  "ueber",
  "unter",
  "nach",
  "aus",
  "sich",
  "sind",
  "wird",
  "wurde",
  "welche",
  "welcher",
  "welches",
  "nicht",
]);

/** Lower case, no accents or punctuation, single spaces. */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Whether `needle` appears in `hay` as whole words. */
export function containsPhrase(hay: string, needle: string): boolean {
  const n = normalize(needle);
  return n.length > 0 && ` ${normalize(hay)} `.includes(` ${n} `);
}

/** The words of an answer (or question) that carry its meaning. */
export function telling(answer: string): string[] {
  return normalize(answer)
    .split(" ")
    .filter((w) => (w.length >= 4 || /^\d+$/.test(w)) && !STOP_WORDS.has(w));
}

/**
 * Whether two (normalized) words share a stem: the same word, one inside the
 * other ("watzmann" / "watzmannhaus", at least 5 letters) or a long common
 * start ("zugspitze" / "zugspitzbahn").
 */
export function sameStem(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length <= b.length ? [a, b] : [b, a];
  if (short.length < 5) return false;
  if (long.includes(short)) return true;
  let i = 0;
  while (i < short.length && a[i] === b[i]) i++;
  return i >= 5 && i >= short.length * 0.8;
}

const words = (text: string) => normalize(text).split(" ").filter(Boolean);

/** Whether `text` has a word sharing a stem with `word`. */
const hasStem = (text: string[], word: string) =>
  text.some((t) => sameStem(t, word));

/**
 * Whether `text` names `answer`: the answer as a phrase, or every telling
 * word of it by its stem ("Die Zugspitze …" names "Zugspitze").
 */
export function mentions(text: string, answer: string): boolean {
  if (containsPhrase(text, answer)) return true;
  const key = telling(answer).filter((w) => w.length >= 5);
  const tw = words(text);
  return key.length > 0 && key.every((w) => hasStem(tw, w));
}

/**
 * Multiple choice: the correct answer is in the question or the quiz title,
 * or the question shares a telling word (or its stem: "Zugspitze" gives
 * away "Zugspitzbahn") with the correct answer that no wrong answer has
 * ("Pacific Ocean" against "Atlantic Ocean" tells nothing by "ocean", but
 * "Pacific" does).
 */
export function choiceLeaks(
  quizTitle: string,
  question: string,
  correct: string,
  wrong: string[],
): boolean {
  if (containsPhrase(question, correct) || containsPhrase(quizTitle, correct)) {
    return true;
  }
  const qw = words(question);
  const inWrong = wrong.flatMap(words);
  return telling(correct).some((w) => hasStem(qw, w) && !hasStem(inWrong, w));
}

/**
 * Typed answers: any accepted answer in the question or the quiz title, or
 * a telling word of the main answer (or its stem) in the question.
 */
export function typedLeaks(
  quizTitle: string,
  question: string,
  accepted: string[],
): boolean {
  if (
    accepted.some(
      (a) => containsPhrase(question, a) || containsPhrase(quizTitle, a),
    )
  ) {
    return true;
  }
  const qw = words(question);
  return telling(accepted[0] ?? "").some((w) => hasStem(qw, w));
}
