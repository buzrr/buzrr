"use client";
import React from "react";
import QuestionAndResult from "./QuesAndResult";
import { useAppSelector } from "@/state/hooks";
import type { AnswerResultPayload } from "@/types/socket-events";

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
}) => {
  const you = params.you;
  const question = useAppSelector((state) => state.game.question);
  const reveal = useAppSelector((state) => state.game.reveal);

  const optionTitle = (id: string | null | undefined) =>
    question?.options?.find((o) => o.id === id)?.title;

  const correctAnswer =
    reveal?.correctOptionIds
      ?.map((id) => optionTitle(id))
      .filter(Boolean)
      .join(", ") || undefined;

  return (
    <>
      {!you || !you.answered ? (
        <QuestionAndResult
          quizTitle={params.quizTitle}
          gameCode={params.gameCode}
          screen="result"
          status="timesout"
          message="Time Limit Exceeded"
          correctAnswer={correctAnswer}
          yourAnswer={null}
        />
      ) : you.isCorrect ? (
        <QuestionAndResult
          quizTitle={params.quizTitle}
          gameCode={params.gameCode}
          screen="result"
          status="correct"
          message={
            you.score ? `+${you.score} points` : "Your answer was correct"
          }
        />
      ) : (
        <QuestionAndResult
          quizTitle={params.quizTitle}
          gameCode={params.gameCode}
          screen="result"
          status="incorrect"
          message="Your answer was wrong"
          correctAnswer={correctAnswer}
          yourAnswer={optionTitle(you.optionId) ?? null}
        />
      )}
    </>
  );
};

export default Result;
