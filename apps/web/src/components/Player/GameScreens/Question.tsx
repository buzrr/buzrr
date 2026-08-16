"use client";
import { useCallback, useEffect, useRef, useState } from "react";
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
  const you = useAppSelector((state) => state.game.you);
  const deadline = useAppSelector((state) => state.game.deadline);
  const clockOffset = useAppSelector((state) => state.game.clockOffset);
  const [optionId, setOptionId] = useState("");
  const [submitted, setSubmitted] = useState(false);
  /**
   * The pick whose ack has not come back yet. A socket that drops mid-flight
   * never calls it — socket.io discards pending acks on close — so without
   * this the UI would stay locked on an answer the server may never have got.
   */
  const unacked = useRef<string | null>(null);
  /** The question the UI is on, for discarding acks from a previous one. */
  const liveQuestionId = useRef(params.question.id);

  // A new question means a fresh answer state.
  useEffect(() => {
    liveQuestionId.current = params.question.id;
    setOptionId("");
    setSubmitted(false);
    unacked.current = null;
  }, [params.question.id]);

  const send = useCallback(
    (optId: string, opts?: { silent?: boolean }) => {
      const sentFor = liveQuestionId.current;
      unacked.current = optId;
      setOptionId(optId);
      setSubmitted(true);
      params.socket.emit(
        "submit-answer",
        { qIndex, optionId: optId },
        (result) => {
          // An ack that arrives after the question moved on describes a
          // question this screen has left. Acting on it would clobber the new
          // question's state — unlocking an answer already sent for it, or
          // dropping its pending pick — so ignore it entirely.
          if (sentFor !== liveQuestionId.current) return;
          if (result.accepted) {
            unacked.current = null;
            return;
          }
          // The server is the authority on what it stored, so unlock and ask
          // for a snapshot rather than assuming: an answer sent just before a
          // drop may have landed after all, and the sync will re-lock if so.
          unacked.current = null;
          setSubmitted(false);
          setOptionId("");
          if (!opts?.silent) {
            toast.error(result.reason ?? "Answer was not accepted");
          }
          params.socket.emit("request-sync");
        },
      );
    },
    [params.socket, qIndex],
  );

  /**
   * Mid-question, `you` only arrives with a `state-sync` — which the server
   * pushes on every (re)connect. So this is the reconnect reconciliation:
   * whatever the local state thinks, the server's record decides. If it never
   * got the answer, resend it while the question is still open, otherwise
   * unlock so the player can answer again.
   */
  useEffect(() => {
    if (!you) return;
    if (you.answered) {
      unacked.current = null;
      setOptionId(you.optionId ?? "");
      setSubmitted(true);
      return;
    }
    const resend = unacked.current;
    unacked.current = null;
    if (resend && Date.now() + clockOffset < deadline) {
      send(resend, { silent: true });
      return;
    }
    setOptionId("");
    setSubmitted(false);
  }, [you, clockOffset, deadline, send]);

  const submitAnswer = (optId: string) => {
    if (submitted) return;
    send(optId);
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
