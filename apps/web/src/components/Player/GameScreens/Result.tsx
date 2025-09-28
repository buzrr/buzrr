import React from "react";
import { ResultStatus } from "@/state/player/resultSlice";
import QuestionAndResult from "./QuesAndResult";

const Result = (params: {
  result: ResultStatus;
  points?: number;
  gameCode: string;
  quizTitle: string;
}) => {
  return (
    <>
      {params.result === ResultStatus.timeout ? (
        <QuestionAndResult
          quizTitle={params.quizTitle}
          quesTime={0}
          gameCode={params.gameCode}
          screen="result"
          status="timesout"
          message="You ran out of time"
        />
      ) : params.result === ResultStatus.correct ? (
        <QuestionAndResult
          quizTitle={params.quizTitle}
          quesTime={0}
          gameCode={params.gameCode}
          screen="result"
          status="correct"
          message={
            params.points ? `${params.points}` : "Your answer was correct"
          }
        />
      ) : (
        <QuestionAndResult
          quizTitle={params.quizTitle}
          quesTime={0}
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
