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

/** The words of an answer that could give it away. */
function telling(answer: string): string[] {
  return normalize(answer)
    .split(" ")
    .filter((w) => (w.length >= 4 || /^\d+$/.test(w)) && !STOP_WORDS.has(w));
}

/**
 * Multiple choice: the correct answer is in the question or the quiz title,
 * or the question shares a telling word with the correct answer that no
 * wrong answer has ("Pacific Ocean" against "Atlantic Ocean" tells nothing
 * by "ocean", but "Pacific" does).
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
  const words = new Set(normalize(question).split(" "));
  const inWrong = new Set(wrong.flatMap((w) => normalize(w).split(" ")));
  return telling(correct).some((w) => words.has(w) && !inWrong.has(w));
}

/**
 * Typed answers: any accepted answer in the question or the quiz title, or
 * a telling word of the main answer in the question.
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
  const words = new Set(normalize(question).split(" "));
  return telling(accepted[0] ?? "").some((w) => words.has(w));
}
