import type { ComponentType, ReactNode } from "react";
import type {
  PublicQuestion,
  QuestionAnswer,
  QuestionType,
  RevealSummary,
} from "@buzrr/contract";

/**
 * Everything type-specific about how a question looks. The game screens
 * (player, host, duel) render a question only through these, so a new type
 * is a new renderer here plus a handler on the server — the screens never
 * change. The shapes come from `@buzrr/contract`.
 */
export interface QuestionRenderer<T extends QuestionType> {
  /** The player's input while the question is open. */
  AnswerInput: ComponentType<{
    question: PublicQuestion<T>;
    /** The answer the player has sent (or is sending), if any. */
    selected: QuestionAnswer<T> | null;
    /** Offline or already answered: show the state, take no input. */
    disabled: boolean;
    onSubmit: (answer: QuestionAnswer<T>) => void;
  }>;

  /** The host's big-screen view of the open question. Not interactive. */
  HostPrompt: ComponentType<{ question: PublicQuestion<T> }>;

  /** The host's breakdown of how the room answered. */
  RevealBreakdown: ComponentType<{
    question: PublicQuestion<T>;
    summary: RevealSummary<T>;
  }>;

  /** How many answered, and how many of those were right. */
  revealStats(
    question: PublicQuestion<T>,
    summary: RevealSummary<T>,
  ): { responses: number; correct: number };

  /** A player's answer as shown on their result screen; null if unknown. */
  describeAnswer(
    question: PublicQuestion<T>,
    answer: QuestionAnswer<T>,
  ): ReactNode | null;

  /** The right answer(s), as shown to a player who missed. */
  correctAnswers(
    question: PublicQuestion<T>,
    summary: RevealSummary<T>,
  ): ReactNode[];
}
