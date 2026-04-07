"use client";
import { useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import { useAppDispatch } from "@/state/hooks";
import { ScreenStatus, setScreenStatus } from "@/state/player/screenSlice";
import { ResultStatus, setResultStatus } from "@/state/player/resultSlice";

interface UsePlayerSocketOptions {
  playerId: string;
  gameCode: string;
  questions: { id: string; title?: string; options?: { id: string; title: string }[] }[];
  onRemoved?: () => void;
}

interface UsePlayerSocketReturn {
  socket: Socket | null;
  questionIndex: number;
  currentQuestion: UsePlayerSocketOptions["questions"][number] | undefined;
  stats: { position: number | null; score: number };
}

export function usePlayerSocket({
  playerId,
  gameCode,
  questions,
  onRemoved,
}: UsePlayerSocketOptions): UsePlayerSocketReturn {
  const dispatch = useAppDispatch();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [stats, setStats] = useState<{ position: number | null; score: number }>({
    position: null,
    score: 0,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const conn = io(
      `${process.env.NEXT_PUBLIC_SOCKET_URL}/?userType=player&playerId=${playerId}&gameCode=${gameCode}`,
    );

    conn.on("connect", () => {
      setSocket(conn);
    });

    conn.on("player-removed", (player: { id: string }) => {
      if (player.id === playerId) {
        window.localStorage.removeItem("playerId");
        onRemoved?.();
      }
    });

    conn.on("game-started", () => {
      dispatch(setScreenStatus(ScreenStatus.wait));
    });

    conn.on("timer-starts", () => {
      dispatch(setScreenStatus(ScreenStatus.wait));
    });

    conn.on("get-question-index", (index: number) => {
      setQuestionIndex(index);
      dispatch(setScreenStatus(ScreenStatus.question));
    });

    conn.on("displaying-result", (data: { player?: { playerId: string; isCorrect?: boolean }[] }) => {
      const playerAnswers = data.player ?? [];
      const found = playerAnswers.find((p) => p.playerId === playerId);

      if (found) {
        dispatch(
          setResultStatus(
            found.isCorrect ? ResultStatus.correct : ResultStatus.incorrect,
          ),
        );
      } else {
        dispatch(setResultStatus(ResultStatus.timeout));
      }

      dispatch(setScreenStatus(ScreenStatus.result));
    });

    conn.on("game-session-ended", () => {
      dispatch(setScreenStatus(ScreenStatus.lobby));
      onRemoved?.();
    });

    conn.on("displaying-final-leaderboard", (leaderboard: { playerId: string; position: number; score: number }[]) => {
      const entry = leaderboard.find((p) => p.playerId === playerId);
      if (entry) {
        setStats({ position: entry.position, score: entry.score });
      }
      dispatch(setScreenStatus(ScreenStatus.leaderboard));
    });

    return () => {
      conn.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch, gameCode, playerId]);

  return {
    socket,
    questionIndex,
    currentQuestion: questions[questionIndex],
    stats,
  };
}
