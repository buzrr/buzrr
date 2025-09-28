"use client";
import { cssOptionColors } from "@/utils/optionColors";
import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { useDispatch } from "react-redux";
import { setScreenStatus, ScreenStatus } from "@/state/player/screenSlice";
import submitAnswerAction from "@/actions/SubmitAnswerAction";
import Image from "next/image";
import QuestionAndResult from "./QuesAndResult";

const Question = (params: {
  question: any;
  gameSessionId: string;
  playerId: string;
  socket: Socket;
  currentQuestion: number;
  quizTitle: string;
  gameCode: string;
}) => {
  const options = params.question.options;
  const dispatch = useDispatch();
  const [timer, setTimer] = useState(0);
  const [optionId, setOptionId] = useState("");

  console.log(params.question);

  useEffect(() => {
    const timeout = setTimeout(() => {
      console.log("time up");
      dispatch(setScreenStatus(ScreenStatus.result));
    }, params.question.timeOut * 1000);

    const interval = setInterval(() => {
      setTimer(timer + 0.5);
    }, 500);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [dispatch, params.question.timeOut, timer]);

  const submitAnswer = (optionId: string) => {
    console.log("submitting answer", optionId);
    setOptionId(optionId);
    // Socket submit Answer
    // params.socket.emit("submit-answer", params.gameSessionId, params.playerId, optionId, timer);
    submitAnswerAction({
      gameSessionId: params.gameSessionId,
      playerId: params.playerId,
      optionId: optionId,
      timeTaken: timer,
    });
    dispatch(setScreenStatus(ScreenStatus.wait));
  };

  return (
    <>
      <QuestionAndResult
        question={params.question}
        quizTitle={params.quizTitle}
        quesTime={params.question.timeOut}
        gameCode={params.gameCode}
        screen="question"
        submitAnswer={submitAnswer}
        optionId={optionId}
      />
    </>
  );
};

export default Question;
