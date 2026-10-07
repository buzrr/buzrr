"use client";

import type { ReactNode } from "react";
import type {
  PublicQuestion,
  QuestionAnswer,
  QuestionType,
  RevealSummary,
} from "@buzrr/contract";
import { multipleChoiceRenderer } from "./MultipleChoice";
import type { QuestionRenderer } from "./types";

/**
 * One renderer per question type. The mapped type makes this exhaustive:
 * a type added to `@buzrr/contract` without a renderer fails to compile.
 */
const RENDERERS: { [K in QuestionType]: QuestionRenderer<K> } = {
  multiple_choice: multipleChoiceRenderer,
};

/**
 * Renderers are typed against their own shapes; screens hold a question of
 * *some* type. This erases that once, here, so screens never cast.
 */
function rendererFor(type: QuestionType): QuestionRenderer<QuestionType> {
  return RENDERERS[type] as unknown as QuestionRenderer<QuestionType>;
}

export function AnswerInput(props: {
  question: PublicQuestion;
  selected: QuestionAnswer | null;
  disabled: boolean;
  onSubmit: (answer: QuestionAnswer) => void;
}) {
  const { AnswerInput: Input } = rendererFor(props.question.type);
  return <Input {...props} />;
}

export function HostPrompt({ question }: { question: PublicQuestion }) {
  const { HostPrompt: Prompt } = rendererFor(question.type);
  return <Prompt question={question} />;
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
