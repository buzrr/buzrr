"use client";
import React from "react";
import QuestionAndResult from "./QuesAndResult";
import { useAppSelector } from "@/state/hooks";
import { correctAnswers, describeAnswer } from "@/components/QuestionTypes";
import type { AnswerResultPayload } from "@buzrr/contract";

/**
 * Reveal-phase outcome, rendered from the server-pushed personal result:
 * no answer → timeout; otherwise correct/incorrect with the awarded points.
 * On a miss (wrong answer or timeout) the correct answer and the player's
 * own pick are shown, resolved from the reveal payload.
 */
const Result = (params: {
  you: AnswerResultPayload | null;
  gameCode: string;
  quizTitle: string;
  hideRoomCode?: boolean;
  hostName?: string | null;
  hostImage?: string | null;
}) => {
  const you = params.you;
  const question = useAppSelector((state) => state.game.question);
  const reveal = useAppSelector((state) => state.game.reveal);

  // Both render through the question's type (components/QuestionTypes).
  const correct =
    question && reveal ? correctAnswers(question, reveal.summary) : [];
  const yourAnswer =
    question && you?.answer ? describeAnswer(question, you.answer) : null;

  // Until the personal result lands, "didn't answer" is unknown rather than
  // true — rendering the timeout verdict in that gap flashes a wrong outcome
  // at a player who did answer. The server sends it just ahead of the reveal
  // broadcast, so this placeholder is normally never seen.
  if (!you) {
    return (
      <div className="flex flex-col items-center justify-center h-[85dvh] gap-4">
        <div className="h-14 w-14 rounded-full border-4 border-light-bg dark:border-off-dark border-t-lprimary dark:border-t-dprimary animate-spin" />
        <p className="text-off-dark dark:text-off-white">
          Checking your answer…
        </p>
      </div>
    );
  }

  return (
    <QuestionAndResult
      quizTitle={params.quizTitle}
      gameCode={params.gameCode}
      hideRoomCode={params.hideRoomCode}
      hostName={params.hostName}
      hostImage={params.hostImage}
      screen="result"
      status={
        !you.answered ? "timesout" : you.isCorrect ? "correct" : "incorrect"
      }
      points={you.score}
      yourAnswer={you.answered ? yourAnswer : null}
      correctAnswers={correct}
    />
  );
};

export default Result;
