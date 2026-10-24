import { z } from "zod";
import type { QuestionType } from "@buzrr/contract";
import {
  choiceLeaks,
  mentions,
  normalize,
  sameStem,
  telling,
  typedLeaks,
} from "./ai-leak";
import type { AiType } from "./ai-mix";

/**
 * Shape the model must return (sent to the provider as a JSON Schema for
 * structured output, then used to validate the reply). One list per type;
 * correct and wrong answers are separate fields so there is no positional
 * convention to get wrong; options are shuffled before saving.
 */
export const aiQuizOutputSchema = z.object({
  multipleChoice: z.array(
    z.object({
      question: z.string().describe("The question, one concise sentence."),
      correctAnswer: z
        .string()
        .describe("The single correct option. Short: ideally 1-5 words."),
      wrongAnswers: z
        .array(z.string())
        .length(3)
        .describe(
          "Exactly three plausible but wrong options, each about as short as the correct one.",
        ),
    }),
  ),
  trueFalse: z.array(
    z.object({
      statement: z
        .string()
        .describe("A statement that is either true or false."),
      isTrue: z.boolean().describe("Whether the statement is true."),
    }),
  ),
  typeAnswer: z.array(
    z.object({
      question: z.string().describe("The question, one concise sentence."),
      answer: z
        .string()
        .describe("The answer players type: 1-3 words, ideally one."),
      alternatives: z
        .array(z.string())
        .max(4)
        .describe(
          "Other spellings or names that are also right (may be empty).",
        ),
    }),
  ),
});
export type AiQuizOutput = z.infer<typeof aiQuizOutputSchema>;

// `$schema` is dropped: strict structured-output modes reject unknown keys.
const { $schema: _draft, ...aiQuizJsonSchema } =
  z.toJSONSchema(aiQuizOutputSchema);
export const AI_QUIZ_JSON_SCHEMA = {
  name: "quiz_questions",
  schema: aiQuizJsonSchema,
};

/** What each difficulty (1–5) asks the model for. */
export const AI_DIFFICULTY: Record<number, string> = {
  1: "Easy: common knowledge that most people know, in plain wording. Wrong options are clearly wrong to anyone who knows the topic a little.",
  2: "Fairly easy: well-known facts about the topic, for casual players.",
  3: "Medium: a mix of well-known facts and ones that need real knowledge of the topic.",
  4: "Fairly hard: for players who know the topic well. Less obvious facts, and wrong options close to the correct one. The question must give no hint at all towards the answer.",
  5: "Hard: for experts. Specific details and lesser-known facts, with wrong options that are close and plausible. The question must give no hint at all towards the answer.",
};

export interface AiPromptInput {
  title: string;
  description: string;
  language: string;
  time: number;
  difficulty: number;
  counts: Record<AiType, number>;
  /** Questions already taken (a follow-up asks for new ones). */
  avoid?: string[];
  /** Their answers, not to be asked for again. */
  avoidAnswers?: string[];
}

export function buildAiPrompt(p: AiPromptInput): string {
  const lists = [
    p.counts.multipleChoice > 0 &&
      `- "multipleChoice": exactly ${p.counts.multipleChoice} questions, each with one correct answer and three plausible but wrong answers.`,
    p.counts.trueFalse > 0 &&
      `- "trueFalse": exactly ${p.counts.trueFalse} statements that are either true or false, about half of each. False statements are wrong in a way someone who knows the topic can tell.`,
    p.counts.typeAnswer > 0 &&
      `- "typeAnswer": exactly ${p.counts.typeAnswer} questions that players answer by typing. The answer is unambiguous and short (a name, a place, a number, a term: 1-3 words), with common other spellings or names as alternatives.`,
  ].filter(Boolean);
  const empty = (["multipleChoice", "trueFalse", "typeAnswer"] as const).filter(
    (t) => p.counts[t] === 0,
  );

  return `You are writing questions for a live, timed quiz game. Players read each question on their phones and have ${p.time} seconds to answer (${typedTimeOut(p.time)} seconds for typed answers).

Quiz title: "${p.title}"

Quiz topic, as described by the host:
"""
${p.description}
"""

Write, in ${p.language} (questions and all answers):
${lists.join("\n")}${empty.length > 0 ? `\nLeave ${empty.map((t) => `"${t}"`).join(" and ")} empty.` : ""}

Difficulty: ${AI_DIFFICULTY[p.difficulty] ?? AI_DIFFICULTY[3]}

The most important rule — never give the answer away:
- The correct answer must not appear in its question: not literally, not as a word of it, not as a word stem, translation, abbreviation or obvious paraphrase. Example of what NOT to do: "Which ocean is the Pacific Ocean?" or "Which river is the Danube river?".
- The correct answer must not appear in the quiz title either. If the title names something, ask about other things.
- The question must not hint at the answer through a description that only fits it (e.g. "the city of love" when the answer is Paris) unless that knowledge is exactly what is asked.
- Check every question against these rules before you return it. Questions that break them are thrown away.

Other rules:
- Keep answers SHORT so players can read them within a few seconds: ideally 1-5 words, never more than about 60 characters. Put any needed context in the question, not in the answers.
- Keep each question concise: one sentence where possible, under about 150 characters.
- In multiple choice, make the four options similar in length and style so the correct one doesn't stand out. Options are shuffled, so never use "All of the above", "None of the above" or answers that refer to other options.
- No duplicates: never ask the same fact twice, not even in other words or as another type, and don't use the same answer for two questions.
- No question may name another question's answer: if one asks for the highest mountain, no other question (and no true/false statement) may mention that mountain.
- Cover the topic broadly: no single place, person or thing in more than two questions.${
    p.avoid && p.avoid.length > 0
      ? `\n- These questions already exist; write different ones:\n${p.avoid.map((q) => `  * ${q}`).join("\n")}`
      : ""
  }${
    p.avoidAnswers && p.avoidAnswers.length > 0
      ? `\n- These answers are already used; don't ask for them again: ${p.avoidAnswers.join(", ")}`
      : ""
  }`;
}

/** A generated question as the import path takes it (checked by its type). */
export interface AiDefinition {
  aiType: AiType;
  type: QuestionType;
  title: string;
  options: { title: string; isCorrect: boolean }[];
  config: Record<string, unknown>;
}

function shuffle<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j]!, array[i]!];
  }
  return array;
}

/**
 * The model's reply as question definitions: trimmed, without blanks,
 * repeated options or questions that give their answer away.
 */
export function toDefinitions(
  quizTitle: string,
  out: AiQuizOutput,
): AiDefinition[] {
  const defs: AiDefinition[] = [];
  for (const q of out.multipleChoice) {
    const title = q.question.trim();
    const answers = [q.correctAnswer, ...q.wrongAnswers].map((a) => a.trim());
    const distinct = new Set(answers.map(normalize));
    if (!title || answers.some((a) => !a) || distinct.size !== answers.length)
      continue;
    if (choiceLeaks(quizTitle, title, answers[0]!, answers.slice(1))) continue;
    defs.push({
      aiType: "multipleChoice",
      type: "multiple_choice",
      title,
      options: shuffle(
        answers.map((a, i) => ({ title: a, isCorrect: i === 0 })),
      ),
      config: { multiSelect: false },
    });
  }
  for (const q of out.trueFalse) {
    const title = q.statement.trim();
    if (!title) continue;
    defs.push({
      aiType: "trueFalse",
      type: "true_false",
      title,
      options: [],
      config: { answer: q.isTrue },
    });
  }
  for (const q of out.typeAnswer) {
    const title = q.question.trim();
    const accepted: string[] = [];
    for (const a of [q.answer, ...q.alternatives].map((a) => a.trim())) {
      if (a && !accepted.some((b) => normalize(b) === normalize(a))) {
        accepted.push(a);
      }
    }
    if (!title || accepted.length === 0) continue;
    if (typedLeaks(quizTitle, title, accepted)) continue;
    defs.push({
      aiType: "typeAnswer",
      type: "type_answer",
      title,
      options: accepted.map((a) => ({ title: a, isCorrect: true })),
      config: { ignoreTypos: true, fixedLength: false },
    });
  }
  return defs;
}

/**
 * Picks `counts` of each type from `defs` (in order), skipping repeated
 * questions; a type that came up short is filled from the others' extras.
 */
export function pickQuestions(
  defs: AiDefinition[],
  counts: Record<AiType, number>,
  total: number,
  topic = "",
): AiDefinition[] {
  const unique = dedupe(defs, topic);
  const taken = new Set<AiDefinition>();
  for (const type of Object.keys(counts) as AiType[]) {
    unique
      .filter((d) => d.aiType === type)
      .slice(0, counts[type])
      .forEach((d) => taken.add(d));
  }
  for (const d of unique) {
    if (taken.size >= total) break;
    taken.add(d);
  }
  // Mixed order, so the types don't come in blocks.
  return shuffle([...taken]).slice(0, total);
}

/** The answer a question asks for (true / false: none). */
function answerOf(d: AiDefinition): string | null {
  if (d.aiType === "trueFalse") return null;
  return d.options.find((o) => o.isCorrect)?.title ?? null;
}

/** The answer a question asks for (true / false: none), normalized. */
function answerKey(d: AiDefinition): string | null {
  const answer = answerOf(d);
  return answer ? normalize(answer) : null;
}

/**
 * Whether two questions are the same one twice: the same wording, the same
 * answer (the same fact asked again, or at least a repeated solution), or
 * mostly the same meaningful words.
 */
export function isDuplicate(a: AiDefinition, b: AiDefinition): boolean {
  if (normalize(a.title) === normalize(b.title)) return true;
  const ka = answerKey(a);
  if (ka !== null && ka === answerKey(b)) return true;
  const wa = new Set(telling(a.title));
  const wb = new Set(telling(b.title));
  if (wa.size < 3 || wb.size < 3) return false;
  const shared = [...wa].filter((w) => wb.has(w)).length;
  return shared / (wa.size + wb.size - shared) >= 0.6;
}

/**
 * Whether one question gives another's answer away: "The Zugspitze is
 * Germany's highest mountain." next to "Which is Germany's highest
 * mountain?".
 */
export function givesAway(a: AiDefinition, b: AiDefinition): boolean {
  const aa = answerOf(a);
  const ab = answerOf(b);
  return (
    (aa !== null && mentions(b.title, aa)) ||
    (ab !== null && mentions(a.title, ab))
  );
}

/** A place, person or thing comes up in at most this many questions. */
export const MAX_PER_SUBJECT = 2;

/**
 * What a question is about: its capitalized words of 5+ letters (names; in
 * German also nouns) and its answer's, normalized — the quiz's own topic
 * words left out, as they belong in every question.
 */
function subjectsOf(d: AiDefinition, topic: string[]): string[] {
  const split = (text: string) => text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  // A sentence's first word is capitalized anyway ("Which", "Welcher").
  const inTitle = d.title
    .split(/[.!?:]\s+/)
    .flatMap((sentence) => split(sentence).slice(1));
  const named = [...inTitle, ...split(answerOf(d) ?? "")]
    .filter((w) => w.length >= 5 && /^\p{Lu}/u.test(w))
    .map(normalize)
    .filter((w) => telling(w).length > 0);
  return [...new Set(named)].filter((w) => !topic.some((t) => sameStem(t, w)));
}

/**
 * `defs` without duplicates (the first of each stays), without questions
 * that give a kept question's answer away, and with no subject in more
 * than MAX_PER_SUBJECT questions. `topic`: the quiz's title and description,
 * whose words don't count as subjects.
 */
export function dedupe(defs: AiDefinition[], topic = ""): AiDefinition[] {
  const topicWords = telling(topic).filter((w) => w.length >= 5);
  const kept: AiDefinition[] = [];
  const seen: string[][] = [];
  for (const d of defs) {
    if (kept.some((k) => isDuplicate(k, d) || givesAway(k, d))) continue;
    const subjects = subjectsOf(d, topicWords);
    const crowded = subjects.some(
      (w) =>
        seen.filter((ws) => ws.some((x) => sameStem(x, w))).length >=
        MAX_PER_SUBJECT,
    );
    if (crowded) continue;
    kept.push(d);
    seen.push(subjects);
  }
  return kept;
}

/**
 * Typed answers take longer than a tap: half as much time again, at least
 * 10 s more (at most the editor's 600 s).
 */
export const typedTimeOut = (time: number) =>
  Math.min(600, Math.max(Math.round(time * 1.5), time + 10));

/** Asks for a few spare questions per type, for those that get dropped. */
export function withSpares(
  counts: Record<AiType, number>,
): Record<AiType, number> {
  const spare = (n: number) => (n === 0 ? 0 : n + Math.ceil(n * 0.25));
  return {
    multipleChoice: spare(counts.multipleChoice),
    trueFalse: spare(counts.trueFalse),
    typeAnswer: spare(counts.typeAnswer),
  };
}

// -- review -------------------------------------------------------------------
// After writing, the model checks every question against the rules and
// rewrites the weak ones (agentic: write → review → revise → review again).

const reviewFields = {
  id: z.string().describe("The question's id, unchanged."),
  ok: z
    .boolean()
    .describe(
      "True if the question is good as it is; false if it was rewritten.",
    ),
  problems: z.string().describe("What was wrong (empty when ok)."),
};

/** The review's reply: every question, as it is (ok) or rewritten. */
export const aiReviewOutputSchema = z.object({
  multipleChoice: z.array(
    z.object({
      ...reviewFields,
      ...aiQuizOutputSchema.shape.multipleChoice.element.shape,
    }),
  ),
  trueFalse: z.array(
    z.object({
      ...reviewFields,
      ...aiQuizOutputSchema.shape.trueFalse.element.shape,
    }),
  ),
  typeAnswer: z.array(
    z.object({
      ...reviewFields,
      ...aiQuizOutputSchema.shape.typeAnswer.element.shape,
    }),
  ),
});
export type AiReviewOutput = z.infer<typeof aiReviewOutputSchema>;

const { $schema: _reviewDraft, ...aiReviewJsonSchema } =
  z.toJSONSchema(aiReviewOutputSchema);
export const AI_REVIEW_JSON_SCHEMA = {
  name: "quiz_review",
  schema: aiReviewJsonSchema,
};

/** A definition back in the model's own shape, with an id for the review. */
function toModelItem(def: AiDefinition, id: string) {
  if (def.aiType === "multipleChoice") {
    return {
      id,
      type: def.aiType,
      question: def.title,
      correctAnswer: def.options.find((o) => o.isCorrect)?.title ?? "",
      wrongAnswers: def.options.filter((o) => !o.isCorrect).map((o) => o.title),
    };
  }
  if (def.aiType === "trueFalse") {
    return {
      id,
      type: def.aiType,
      statement: def.title,
      isTrue: def.config.answer === true,
    };
  }
  return {
    id,
    type: def.aiType,
    question: def.title,
    answer: def.options[0]?.title ?? "",
    alternatives: def.options.slice(1).map((o) => o.title),
  };
}

export function buildReviewPrompt(
  p: Omit<AiPromptInput, "counts" | "avoid">,
  defs: AiDefinition[],
): string {
  const items = defs.map((d, i) => toModelItem(d, `q${i + 1}`));
  return `You are the strict editor of a live, timed quiz game. Players have ${p.time} seconds per question, on their phones.

Quiz title: "${p.title}"
Topic: """
${p.description}
"""
Language: ${p.language}
Difficulty: ${AI_DIFFICULTY[p.difficulty] ?? AI_DIFFICULTY[3]}

Review every question below. A question is NOT ok if any of these is true:
- It gives its answer away: the correct answer (or a word, stem, translation or obvious paraphrase of it) is in the question or in the quiz title, or the question describes it so that only it fits.
- It is factually wrong, outdated or disputed, or more than one option could be argued to be correct (true / false: the statement is not clearly true or clearly false).
- It is ambiguous, confusing or too long to read in a few seconds.
- Multiple choice: a wrong answer is obviously silly, the correct one stands out by length or style, or options overlap.
- Typed answer: the answer is not one short, unambiguous term, or common spellings are missing from the alternatives.
- It does not fit the difficulty, or it repeats another question's fact.
- It names the answer of another question (e.g. a statement about the mountain another question asks for), or it is about the same place, person or thing as two other questions already.

For each question return its id, "ok", what was wrong ("problems") and the question's fields. When ok, repeat the fields unchanged. When not ok, rewrite it so it has none of these problems: reword the question, replace weak wrong answers with plausible ones, fix the answer, or ask about a different fact of the topic if it can't be saved. Keep the type, and write in ${p.language}.

Return every question exactly once, in the list of its type.

Questions (JSON):
${JSON.stringify(items, null, 1)}`;
}

/**
 * Applies a review, position by position: a kept question (or one the
 * review left out) stays; a rewrite replaces it if it passes the same checks
 * as new questions and keeps the type (the host chose the mix), else the
 * question is dropped (null).
 */
export function applyReview(
  quizTitle: string,
  defs: AiDefinition[],
  review: AiReviewOutput,
): { defs: (AiDefinition | null)[]; revised: boolean[] } {
  const rewrites = new Map<string, Partial<AiQuizOutput>>();
  for (const { id, ok, problems: _p, ...q } of review.multipleChoice) {
    if (!ok) rewrites.set(id, { multipleChoice: [q] });
  }
  for (const { id, ok, problems: _p, ...q } of review.trueFalse) {
    if (!ok) rewrites.set(id, { trueFalse: [q] });
  }
  for (const { id, ok, problems: _p, ...q } of review.typeAnswer) {
    if (!ok) rewrites.set(id, { typeAnswer: [q] });
  }
  const revised = defs.map((_, i) => rewrites.has(`q${i + 1}`));
  const out = defs.map((def, i) => {
    const single = rewrites.get(`q${i + 1}`);
    if (!single) return def;
    const [next] = toDefinitions(quizTitle, {
      multipleChoice: [],
      trueFalse: [],
      typeAnswer: [],
      ...single,
    });
    return next && next.aiType === def.aiType ? next : null;
  });
  return { defs: out, revised };
}
