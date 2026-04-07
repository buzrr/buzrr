"use client";
import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { useAppDispatch } from "@/state/hooks";
import { setScreenStatus, ScreenStatus } from "@/state/player/screenSlice";
import QuestionAndResult from "./QuesAndResult";
import { useSubmitAnswerMutation } from "@/lib/modules/game-sessions/hooks";

interface QuestionWithOptions {
  title?: string;
  timeOut?: number;
  options: { id: string; title: string }[];
}

const Question = (params: {
  question: QuestionWithOptions;
  gameSessionId: string;
  playerId: string;
  socket: Socket;
  currentQuestion: number;
  quizTitle: string;
  gameCode: string;
}) => {
  const dispatch = useAppDispatch();
  const [timer, setTimer] = useState(0);
  const [optionId, setOptionId] = useState("");
  const submitMutation = useSubmitAnswerMutation();

  useEffect(() => {
    const timeout = setTimeout(() => {
      dispatch(setScreenStatus(ScreenStatus.result));
    }, (params.question.timeOut ?? 0) * 1000);

    const interval = setInterval(() => {
      setTimer((t) => t + 0.5);
    }, 500);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [dispatch, params.question.timeOut]);

  const submitAnswer = (optId: string) => {
    setOptionId(optId);
    submitMutation.mutate({
      gameSessionId: params.gameSessionId,
      playerId: params.playerId,
      optionId: optId,
      timeTaken: timer,
    });
    dispatch(setScreenStatus(ScreenStatus.wait));
  };

  return (
    <>
      <QuestionAndResult
        question={params.question}
        quizTitle={params.quizTitle}
        quesTime={params.question.timeOut ?? 0}
        gameCode={params.gameCode}
        screen="question"
        submitAnswer={submitAnswer}
        optionId={optionId}
      />
    </>
  );
};

export default Question;
