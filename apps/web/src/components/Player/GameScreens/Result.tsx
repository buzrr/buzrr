import React from "react";
import QuestionAndResult from "./QuesAndResult";
import type { AnswerResultPayload } from "@/types/socket-events";

/**
 * Reveal-phase outcome, rendered from the server-pushed personal result:
 * no answer → timeout; otherwise correct/incorrect with the awarded points.
 */
const Result = (params: {
  you: AnswerResultPayload | null;
  gameCode: string;
  quizTitle: string;
}) => {
  const you = params.you;

  return (
    <>
      {!you || !you.answered ? (
        <QuestionAndResult
          quizTitle={params.quizTitle}
          gameCode={params.gameCode}
          screen="result"
          status="timesout"
          message="You ran out of time"
        />
      ) : you.isCorrect ? (
        <QuestionAndResult
          quizTitle={params.quizTitle}
          gameCode={params.gameCode}
          screen="result"
          status="correct"
          message={you.score ? `+${you.score} points` : "Your answer was correct"}
        />
      ) : (
        <QuestionAndResult
          quizTitle={params.quizTitle}
          gameCode={params.gameCode}
          screen="result"
          status="incorrect"
          message="Your answer was wrong"
        />
      )}
    </>
  );
};

export default Result;
