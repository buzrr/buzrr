"use client";

import type { ReactNode } from "react";
import type {
  PublicQuestion,
  QuestionAnswer,
  QuestionType,
  RevealSummary,
} from "@buzrr/contract";
import { multipleChoiceRenderer } from "./MultipleChoice";
import { openTextRenderer } from "./OpenText";
import { pollRenderer } from "./Poll";
import { ratingRenderer } from "./Rating";
import { trueFalseRenderer } from "./TrueFalse";
import { typeAnswerRenderer } from "./TypeAnswer";
import { wordCloudRenderer } from "./WordCloud";
import type { QuestionRenderer } from "./types";

/**
 * One renderer per question type. The mapped type makes this exhaustive:
 * a type added to `@buzrr/contract` without a renderer fails to compile.
 */
const RENDERERS: { [K in QuestionType]: QuestionRenderer<K> } = {
  multiple_choice: multipleChoiceRenderer,
  true_false: trueFalseRenderer,
  type_answer: typeAnswerRenderer,
  poll: pollRenderer,
  word_cloud: wordCloudRenderer,
  rating: ratingRenderer,
  open_text: openTextRenderer,
};

/**
 * Renderers are typed against their own shapes; screens hold a question of
 * *some* type. This erases that once, here, so screens never cast.
 */
function rendererFor(type: QuestionType): QuestionRenderer<QuestionType> {
  return RENDERERS[type] as unknown as QuestionRenderer<QuestionType>;
}

export { isScoredType } from "@buzrr/contract";

/** Whether players may keep answering after their first submission. */
export function acceptsMoreAnswers(question: PublicQuestion): boolean {
  return "multipleSubmissions" in question && question.multipleSubmissions;
}
export {
  QUESTION_TYPE_META,
  QUESTION_TYPE_ORDER,
  QuestionTypeIcon,
  QuestionTypePill,
} from "./meta";

/**
 * Keyed by question so a type's local draft (ticked options, typed words)
 * never carries over to the next question.
 */
export function AnswerInput(props: {
  question: PublicQuestion;
  selected: QuestionAnswer | null;
  disabled: boolean;
  onSubmit: (answer: QuestionAnswer) => void;
}) {
  const { AnswerInput: Input } = rendererFor(props.question.type);
  return <Input key={props.question.id} {...props} />;
}

/** `live`: the running summary of an unscored question, if one arrived. */
export function HostPrompt({
  question,
  live = null,
}: {
  question: PublicQuestion;
  live?: RevealSummary | null;
}) {
  const { HostPrompt: Prompt } = rendererFor(question.type);
  // Same rule as the reveal: a summary for another question is dropped.
  return (
    <Prompt
      question={question}
      live={live && live.type === question.type ? live : null}
    />
  );
}

export function RevealBreakdown(props: {
  question: PublicQuestion;
  summary: RevealSummary;
}) {
  // The reveal belongs to the question on screen; a mismatch can only be a
  // snapshot caught mid-transition, so render nothing rather than nonsense.
  if (props.summary.type !== props.question.type) return null;
  const { RevealBreakdown: Breakdown } = rendererFor(props.question.type);
  return <Breakdown {...props} />;
}

export function revealStats(
  question: PublicQuestion,
  summary: RevealSummary,
): { responses: number; correct: number } {
  if (summary.type !== question.type) return { responses: 0, correct: 0 };
  return rendererFor(question.type).revealStats(question, summary);
}

export function describeAnswer(
  question: PublicQuestion,
  answer: QuestionAnswer,
): ReactNode | null {
  return rendererFor(question.type).describeAnswer(question, answer);
}

export function correctAnswers(
  question: PublicQuestion,
  summary: RevealSummary,
): ReactNode[] {
  if (summary.type !== question.type) return [];
  return rendererFor(question.type).correctAnswers(question, summary);
}
