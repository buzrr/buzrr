"use client";
import { useEffect, useState } from "react";
import { useAppSelector } from "@/state/hooks";
import { toast } from "react-toastify";
import QuestionAndResult from "./QuesAndResult";
import type { GameSocket, PublicQuestion } from "@/types/socket-events";

/**
 * Answers go over the socket and the server measures the time taken; the
 * client no longer reports its own clock. The screen stays on the question
 * until the server pushes the reveal.
 */
const Question = (params: {
  question: PublicQuestion;
  socket: GameSocket;
  quizTitle: string;
  gameCode: string;
  hideRoomCode?: boolean;
  hostName?: string | null;
  hostImage?: string | null;
}) => {
  const qIndex = useAppSelector((state) => state.game.qIndex);
  const [optionId, setOptionId] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // A new question means a fresh answer state.
  useEffect(() => {
    setOptionId("");
    setSubmitted(false);
  }, [params.question.id]);

  const submitAnswer = (optId: string) => {
    if (submitted) return;
    setOptionId(optId);
    setSubmitted(true);
    params.socket.emit(
      "submit-answer",
      { qIndex, optionId: optId },
      (result) => {
        if (!result.accepted) {
          setSubmitted(false);
          setOptionId("");
          toast.error(result.reason ?? "Answer was not accepted");
        }
      },
    );
  };

  return (
    <>
      <QuestionAndResult
        question={params.question}
        quizTitle={params.quizTitle}
        gameCode={params.gameCode}
        hideRoomCode={params.hideRoomCode}
        hostName={params.hostName}
        hostImage={params.hostImage}
        screen="question"
        submitAnswer={submitAnswer}
        optionId={optionId}
        locked={submitted}
      />
    </>
  );
};

export default Question;
